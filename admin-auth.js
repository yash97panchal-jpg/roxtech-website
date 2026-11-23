import { createRemoteJWKSet, jwtVerify } from 'jose';

export const ADMIN_ORIGIN = 'https://roxtech.online';
export const GOOGLE_CALLBACK = '/api/auth/google/callback';
const GOOGLE_REDIRECT_URI = ADMIN_ORIGIN + GOOGLE_CALLBACK;
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const FLOW_COOKIE = '__Host-roxtech-admin-flow';
const SESSION_COOKIE = '__Host-roxtech-admin-session';
const FLOW_TTL = 10 * 60;
const SESSION_TTL = 8 * 60 * 60;
const VERIFIED_SESSION_TTL = 30 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const encoder = new TextEncoder();

export const adminHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

export function epochSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function tokenDigest(env, purpose, token) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}:${token}`));
  return base64url(new Uint8Array(digest));
}

function cookieToken(request, name) {
  const prefix = `${name}=`;
  const matches = (request.headers.get('Cookie') ?? '').split(';').map(item => item.trim())
    .filter(item => item.startsWith(prefix));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(prefix.length);
  return tokenPattern.test(token) ? token : null;
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function redirect(location, ...cookies) {
  const headers = new Headers({ ...adminHeaders, Location: location });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}

function adminEmail(env) {
  return env.ADMIN_EMAIL?.trim().toLowerCase();
}

export function oauthConfigured(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET?.length >= 32 && adminEmail(env));
}

export function sameAdminOrigin(request) {
  return request.headers.get('Origin') === ADMIN_ORIGIN;
}

export async function startGoogleSignIn(env) {
  const browserToken = randomToken();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const browserDigest = await tokenDigest(env, 'flow', browserToken);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
  const now = epochSeconds();

  await env.BOOKINGS.batch([
    env.BOOKINGS.prepare('DELETE FROM admin_oauth_flows WHERE expires_at <= ?').bind(now),
    env.BOOKINGS.prepare(`
      INSERT INTO admin_oauth_flows (browser_digest, state, nonce, verifier, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(browserDigest, state, nonce, verifier, now + FLOW_TTL),
  ]);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return redirect(url.toString(), cookie(FLOW_COOKIE, browserToken, FLOW_TTL));
}

async function googleIdentity(env, code, flow) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
      code,
      code_verifier: flow.verifier,
    }),
  });
  if (response.status >= 300 && response.status < 400) return { stage: 'token_exchange_redirected' };
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    const allowedErrors = ['invalid_client', 'invalid_grant', 'unauthorized_client', 'invalid_request'];
    const stage = allowedErrors.includes(result?.error) ? result.error : 'token_exchange_rejected';
    return { stage };
  }

  const { id_token: idToken } = await response.json();
  if (typeof idToken !== 'string') return { stage: 'id_token_missing' };
  const verified = await jwtVerify(idToken, googleKeys, {
    issuer: GOOGLE_ISSUERS,
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'nonce', 'email', 'email_verified'],
    maxTokenAge: FLOW_TTL,
    clockTolerance: 30,
  }).catch(error => {
    const keyErrors = ['ERR_JWKS_TIMEOUT', 'ERR_JWKS_NO_MATCHING_KEY', 'ERR_JWKS_INVALID', 'ERR_JOSE_GENERIC'];
    return { stage: keyErrors.includes(error.code) ? 'google_signing_keys_unavailable' : 'id_token_verification_failed' };
  });
  if (!verified.payload) return verified;

  const { payload } = verified;
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const domain = email.split('@')[1];
  const authoritativeEmail = domain === 'gmail.com' || (domain && payload.hd === domain);
  if (payload.nonce !== flow.nonce || typeof payload.sub !== 'string' || !payload.sub ||
      (Array.isArray(payload.aud) && payload.aud.length !== 1) ||
      (payload.azp !== undefined && payload.azp !== env.GOOGLE_CLIENT_ID)) return { stage: 'id_token_claims_rejected' };
  if (payload.email_verified !== true || !authoritativeEmail || email !== adminEmail(env)) {
    return { stage: 'admin_identity_rejected' };
  }
  return { email };
}

export async function completeGoogleSignIn(request, env, params) {
  const clearFlow = cookie(FLOW_COOKIE, '', 0);
  const fail = () => redirect('/admin?error=signin', clearFlow);
  const browserToken = cookieToken(request, FLOW_COOKIE);
  const state = params.get('state');
  if (!browserToken || !tokenPattern.test(state ?? '') || params.getAll('state').length !== 1) return fail();

  const now = epochSeconds();
  const browserDigest = await tokenDigest(env, 'flow', browserToken);
  const flow = await env.BOOKINGS.prepare(`
    DELETE FROM admin_oauth_flows
    WHERE browser_digest = ? AND state = ? AND expires_at > ?
    RETURNING nonce, verifier
  `).bind(browserDigest, state, now).first();
  const code = params.get('code');
  if (!flow || params.has('error') || !code || code.length > 2048 || params.getAll('code').length !== 1) return fail();

  const { email, stage } = await googleIdentity(env, code, flow)
    .catch(() => ({ stage: 'google_request_failed' }));
  if (!email) {
    // Keep only the last failure category. Provider responses can contain credentials.
    await env.BOOKINGS.prepare(`
      INSERT INTO admin_oauth_diagnostics (id, stage, observed_at) VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET stage = excluded.stage, observed_at = excluded.observed_at
    `).bind(stage, now).run();
    return fail();
  }

  const token = randomToken();
  const digest = await tokenDigest(env, 'session', token);
  const priorToken = cookieToken(request, SESSION_COOKIE);
  const statements = [env.BOOKINGS.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now)];
  if (priorToken) {
    const priorDigest = await tokenDigest(env, 'session', priorToken);
    statements.push(env.BOOKINGS.prepare('DELETE FROM admin_sessions WHERE token_digest = ?').bind(priorDigest));
  }
  statements.push(env.BOOKINGS.prepare(`
    INSERT INTO admin_sessions (token_digest, email, expires_at) VALUES (?, ?, ?)
  `).bind(digest, email, now + SESSION_TTL));
  await env.BOOKINGS.batch(statements);
  return redirect('/admin', clearFlow, cookie(SESSION_COOKIE, token, SESSION_TTL));
}

export async function getAdminSession(request, env) {
  const token = cookieToken(request, SESSION_COOKIE);
  if (!token || !oauthConfigured(env)) return null;
  const digest = await tokenDigest(env, 'session', token);
  return env.BOOKINGS.prepare(`
    SELECT s.token_digest, s.email, s.expires_at,
           NOT EXISTS (
             SELECT 1 FROM admin_passkeys k WHERE k.email = s.email AND k.approved_at IS NOT NULL
           ) OR EXISTS (
             SELECT 1 FROM admin_passkey_verifications v
             JOIN admin_passkeys k ON k.credential_id = v.credential_id
             WHERE v.session_digest = s.token_digest AND k.email = s.email
               AND k.approved_at IS NOT NULL AND k.revoked_at IS NULL
           ) AS authorized
    FROM admin_sessions s
    WHERE s.token_digest = ? AND s.email = ? AND s.expires_at > ?
  `).bind(digest, adminEmail(env), epochSeconds()).first();
}

export async function hasAdminSession(request, env) {
  return Boolean((await getAdminSession(request, env))?.authorized);
}

export async function verifyAdminPasskeySession(env, session, credential, newCounter) {
  const token = randomToken();
  const digest = await tokenDigest(env, 'session', token);
  const now = epochSeconds();
  const expiry = Math.min(session.expires_at, now + VERIFIED_SESSION_TTL);
  if (expiry <= now) return null;
  const db = env.BOOKINGS;
  // Issue a new cookie so a copied Google-only cookie can never become an admin session.
  await db.batch([
    db.prepare(`
      INSERT INTO admin_sessions (token_digest, email, expires_at)
      SELECT ?, s.email, ? FROM admin_sessions s JOIN admin_passkeys k ON k.email = s.email
      WHERE s.token_digest = ? AND s.expires_at > ? AND k.credential_id = ?
        AND k.counter = ? AND k.approved_at IS NOT NULL AND k.revoked_at IS NULL
    `).bind(digest, expiry, session.token_digest, now, credential.credential_id, credential.counter),
    db.prepare(`
      INSERT INTO admin_passkey_verifications (session_digest, credential_id)
      SELECT token_digest, ? FROM admin_sessions WHERE token_digest = ?
    `).bind(credential.credential_id, digest),
    db.prepare(`
      UPDATE admin_passkeys SET counter = ? WHERE credential_id = ?
        AND EXISTS (SELECT 1 FROM admin_sessions WHERE token_digest = ?)
    `).bind(newCounter, credential.credential_id, digest),
    db.prepare(`
      DELETE FROM admin_sessions WHERE token_digest = ?
        AND EXISTS (SELECT 1 FROM admin_sessions WHERE token_digest = ?)
    `).bind(session.token_digest, digest),
  ]);
  const verified = await db.prepare('SELECT 1 FROM admin_passkey_verifications WHERE session_digest = ?')
    .bind(digest).first();
  return verified ? cookie(SESSION_COOKIE, token, expiry - now) : null;
}

export async function signOut(request, env) {
  const token = cookieToken(request, SESSION_COOKIE);
  if (token && env.SESSION_SECRET) {
    const digest = await tokenDigest(env, 'session', token);
    await env.BOOKINGS.prepare('DELETE FROM admin_sessions WHERE token_digest = ?').bind(digest).run();
  }
  return redirect('/admin', cookie(SESSION_COOKIE, '', 0), cookie(FLOW_COOKIE, '', 0));
}

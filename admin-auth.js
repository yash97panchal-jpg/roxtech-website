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
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const encoder = new TextEncoder();

export const adminHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

function epochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function base64url(bytes) {
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
    redirect: 'error',
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
  if (!response.ok) return null;

  const { id_token: idToken } = await response.json();
  if (typeof idToken !== 'string') return null;
  const { payload } = await jwtVerify(idToken, googleKeys, {
    issuer: GOOGLE_ISSUERS,
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'nonce', 'email', 'email_verified'],
    maxTokenAge: FLOW_TTL,
    clockTolerance: 30,
  });

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const domain = email.split('@')[1];
  const authoritativeEmail = domain === 'gmail.com' || (domain && payload.hd === domain);
  if (payload.nonce !== flow.nonce || payload.email_verified !== true || !authoritativeEmail ||
      email !== adminEmail(env) || typeof payload.sub !== 'string' || !payload.sub ||
      (Array.isArray(payload.aud) && payload.aud.length !== 1) ||
      (payload.azp !== undefined && payload.azp !== env.GOOGLE_CLIENT_ID)) return null;
  return email;
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

  let email;
  try {
    email = await googleIdentity(env, code, flow);
  } catch {
    // Google responses can contain tokens or credentials. Keep provider errors private.
    return fail();
  }
  if (!email) return fail();

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

export async function hasAdminSession(request, env) {
  const token = cookieToken(request, SESSION_COOKIE);
  if (!token || !oauthConfigured(env)) return false;
  const digest = await tokenDigest(env, 'session', token);
  const session = await env.BOOKINGS.prepare(`
    SELECT email FROM admin_sessions WHERE token_digest = ? AND expires_at > ?
  `).bind(digest, epochSeconds()).first();
  return session?.email === adminEmail(env);
}

export async function signOut(request, env) {
  const token = cookieToken(request, SESSION_COOKIE);
  if (token && env.SESSION_SECRET) {
    const digest = await tokenDigest(env, 'session', token);
    await env.BOOKINGS.prepare('DELETE FROM admin_sessions WHERE token_digest = ?').bind(digest).run();
  }
  return redirect('/admin', cookie(SESSION_COOKIE, '', 0), cookie(FLOW_COOKIE, '', 0));
}

import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  ADMIN_ORIGIN, adminHeaders, base64url, epochSeconds, getAdminSession,
  sameAdminOrigin, verifyAdminPasskeySession,
} from './admin-auth.js';

const RP_ID = new URL(ADMIN_ORIGIN).hostname;
const ALGORITHMS = [-7, -257];
const CHALLENGE_TTL = 5 * 60;
const APPROVAL_TTL = 30 * 60;
const MAX_RESPONSE_BYTES = 16_384;
const encoder = new TextEncoder();

function result(data, status = 200, headers) {
  return Response.json(data, { status, headers: { ...adminHeaders, ...headers } });
}

function decodeKey(key) {
  return Uint8Array.from(atob(key.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

async function readCredential(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(MAX_RESPONSE_BYTES);
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (size + value.length > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    bytes.set(value, size);
    size += value.length;
  }
  const credential = JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)));
  return typeof credential?.id === 'string' && /^[A-Za-z0-9_-]{1,1364}$/.test(credential.id) &&
    credential.type === 'public-key' && credential.response ? credential : null;
}

async function beginPasskey(db, session, operation) {
  const { results: credentials } = await db.prepare(`
    SELECT credential_id FROM admin_passkeys
    WHERE email = ? AND approved_at IS NOT NULL AND revoked_at IS NULL
  `).bind(session.email).all();
  const allowed = credentials.map(key => ({ id: key.credential_id }));
  if (operation === 'authenticate' && !allowed.length) {
    return result({ message: 'Your setup must be approved before you can verify your passkey.' }, 409);
  }
  const options = operation === 'register'
    ? await generateRegistrationOptions({
        rpName: 'RoxTech Admin',
        rpID: RP_ID,
        userName: session.email,
        userID: new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(session.email))),
        excludeCredentials: allowed,
        supportedAlgorithmIDs: ALGORITHMS,
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      })
    : await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: allowed,
        userVerification: 'required',
      });
  const now = epochSeconds();
  await db.batch([
    db.prepare('DELETE FROM admin_passkey_challenges WHERE expires_at <= ?').bind(now),
    db.prepare(`
      INSERT INTO admin_passkey_challenges (session_digest, operation, challenge, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (session_digest, operation)
      DO UPDATE SET challenge = excluded.challenge, expires_at = excluded.expires_at
    `).bind(session.token_digest, operation, options.challenge, Math.min(now + CHALLENGE_TTL, session.expires_at)),
  ]);
  return result({ options });
}

async function requestApproval(db, session, response, expectedChallenge, now) {
  const verified = await verifyRegistrationResponse({
    response, expectedChallenge, expectedOrigin: ADMIN_ORIGIN, expectedRPID: RP_ID,
    requireUserVerification: true, supportedAlgorithmIDs: ALGORITHMS,
  }).catch(() => null);
  if (!verified?.verified) return null;
  const { credential } = verified.registrationInfo;
  // This reference identifies a request. Only the site operator can approve it in D1.
  const reference = crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase();
  await db.prepare('DELETE FROM admin_passkeys WHERE approved_at IS NULL AND pending_until <= ?').bind(now).run();
  const saved = await db.prepare(`
    INSERT INTO admin_passkeys (credential_id, email, public_key, counter, approval_reference, pending_until)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE (SELECT COUNT(*) FROM admin_passkeys WHERE email = ? AND approved_at IS NULL) < 4
    ON CONFLICT (credential_id) DO NOTHING
    RETURNING approval_reference
  `).bind(credential.id, session.email, base64url(credential.publicKey), credential.counter,
    reference, now + APPROVAL_TTL, session.email).first();
  return saved ? result({ approvalReference: saved.approval_reference }) :
    result({ message: 'This passkey is already registered or too many setups are pending.' }, 409);
}

async function authenticatePasskey(env, session, response, expectedChallenge) {
  const credential = await env.BOOKINGS.prepare(`
    SELECT credential_id, public_key, counter FROM admin_passkeys
    WHERE credential_id = ? AND email = ? AND approved_at IS NOT NULL AND revoked_at IS NULL
  `).bind(response.id, session.email).first();
  if (!credential) return null;
  const verified = await verifyAuthenticationResponse({
    response, expectedChallenge, expectedOrigin: ADMIN_ORIGIN, expectedRPID: RP_ID,
    requireUserVerification: true,
    credential: {
      id: credential.credential_id, publicKey: decodeKey(credential.public_key), counter: credential.counter,
    },
  }).catch(() => null);
  if (!verified?.verified) return null;
  const cookie = await verifyAdminPasskeySession(env, session, credential, verified.authenticationInfo.newCounter);
  return cookie ? result({ success: true }, 200, { 'Set-Cookie': cookie }) : null;
}

export async function handleAdminPasskey(request, env, pathname) {
  const route = pathname.match(/^\/api\/admin\/passkey\/(register|authenticate)\/(start|finish)$/);
  if (!route) return result({ message: 'This endpoint is unavailable.' }, 404);
  if (request.method !== 'POST') return result({ message: 'Use POST.' }, 405, { Allow: 'POST' });
  if (!sameAdminOrigin(request)) return result({ message: 'Invalid origin.' }, 403);
  const session = await getAdminSession(request, env);
  if (!session) return result({ message: 'Sign in with your approved Google account first.' }, 401);
  const [, operation, step] = route;
  if (step === 'start') return beginPasskey(env.BOOKINGS, session, operation);

  const response = await readCredential(request).catch(() => null);
  if (!response) return result({ message: 'Invalid passkey response.' }, 400);
  const now = epochSeconds();
  const challenge = await env.BOOKINGS.prepare(`
    DELETE FROM admin_passkey_challenges
    WHERE session_digest = ? AND operation = ? AND expires_at > ?
    RETURNING challenge
  `).bind(session.token_digest, operation, now).first();
  if (!challenge) return result({ message: 'The request expired. Try again.' }, 400);
  const answer = operation === 'register'
    ? await requestApproval(env.BOOKINGS, session, response, challenge.challenge, now)
    : await authenticatePasskey(env, session, response, challenge.challenge);
  return answer ?? result({ message: 'Passkey verification failed. Try again.' }, 403);
}

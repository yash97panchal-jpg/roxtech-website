import assert from 'node:assert/strict';
import { createHash, createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { isoCBOR } from '@simplewebauthn/server/helpers';

const htmlLoader = registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.html')) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))}`,
    };
  },
});
const { default: worker } = await import('../worker.js');
htmlLoader.deregister();

const origin = 'https://roxtech.online';
const callback = '/api/auth/google/callback';
const settings = {
  GOOGLE_CLIENT_ID: 'test-client.example',
  GOOGLE_CLIENT_SECRET: 'test-client-credential',
  SESSION_SECRET: 'test-session-credential-not-for-production',
  ADMIN_EMAIL: 'owner@gmail.com',
};
const signInHeaders = { Origin: origin };
const now = () => Math.floor(Date.now() / 1000);

function fixture(t, overrides = {}) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  for (const file of ['booking-schema.sql', 'admin-schema.sql', 'inquiry-schema.sql']) {
    sql.exec(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  const env = {
    ...settings,
    ...overrides,
    ASSETS: { fetch: request => new Response(`asset ${new URL(request.url).pathname}`) },
    BOOKINGS: {
      prepare(query) {
        const bind = (...parameters) => ({
          first: () => sql.prepare(query).get(...parameters),
          all: () => ({ results: sql.prepare(query).all(...parameters) }),
          run: () => sql.prepare(query).run(...parameters),
        });
        return { ...bind(), bind };
      },
      batch(statements) {
        sql.exec('BEGIN');
        try {
          for (const statement of statements) statement.run();
          sql.exec('COMMIT');
        } catch (error) {
          sql.exec('ROLLBACK');
          throw error;
        }
      },
    },
  };
  return { sql, request: (path, options) => worker.fetch(new Request(new URL(path, origin), options), env) };
}

async function beginLogin(request) {
  const response = await request('/api/admin/google', { method: 'POST', headers: signInHeaders });
  assert.equal(response.status, 303);
  const authorize = new URL(response.headers.get('Location'));
  const flowCookie = response.headers.get('Set-Cookie');
  assert.match(flowCookie, /^__Host-roxtech-admin-flow=.*; Max-Age=600; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
  assert.equal(authorize.origin, 'https://accounts.google.com');
  assert.equal(authorize.searchParams.get('redirect_uri'), origin + callback);
  assert.equal(authorize.searchParams.get('scope'), 'openid email');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorize.searchParams.get('code_challenge').length, 43);
  assert.equal(authorize.searchParams.has('client_secret'), false);
  return { authorize, flowCookie: flowCookie.split(';')[0] };
}

function callbackWithState(request, login, state = login.authorize.searchParams.get('state')) {
  return request(`${callback}?code=test-code&state=${encodeURIComponent(state)}`, {
    headers: { Cookie: login.flowCookie },
  });
}

test('admin HTML and data routes require the production-host session', async t => {
  const { request } = fixture(t);
  const page = await request('/admin');
  assert.match(await page.text(), /Continue with Google/);
  assert.match(page.headers.get('Cache-Control'), /no-store/);
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal((await request('/admin.html')).headers.get('Location'), origin + '/admin');
  assert.equal((await request('/admin/')).headers.get('Location'), origin + '/admin');
  assert.equal((await request('https://www.roxtech.online/admin')).headers.get('Location'), origin + '/admin');
  assert.equal((await request('https://www.roxtech.online/api/bookings')).status, 404);
  for (const path of ['/api/bookings', '/api/stats', '/api/contact', '/api/orders', '/api/quote',
    '/api/customers', '/api/careers/applications', '/api/newsletter', '/api/admin/resumes/example.pdf']) {
    assert.equal((await request(path)).status, 401, path);
  }
  assert.equal((await request('/api/bookings/1', { method: 'PATCH' })).status, 401);
  assert.equal((await request('/api/admin/google')).status, 405);
  assert.equal((await request('/api/admin/google', { method: 'POST' })).status, 403);
  const invalid = await request(callback + '?error=access_denied');
  assert.equal(invalid.headers.get('Location'), '/admin?error=signin');
  assert.match(await (await request(invalid.headers.get('Location'))).text(), /role="alert"/);
});

test('Google callback checks PKCE, signature, claims and single-use state; session enables admin bookings and can be revoked', async t => {
  const { request, sql } = fixture(t);
  sql.exec(`INSERT INTO consultations (booking_date, booking_time, name, email, service)
    VALUES ('2026-11-24', '10:00', 'Example', 'booking@example.com', 'Web development')`);

  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256' };
  let login;
  let claims = {};
  let tokenCalls = 0;
  let malformedSignature = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') {
      return Response.json({ keys: [jwk] });
    }
    assert.equal(String(url), 'https://oauth2.googleapis.com/token');
    tokenCalls++;
    const params = options.body;
    assert.equal(params.get('client_secret'), settings.GOOGLE_CLIENT_SECRET);
    assert.equal(params.get('redirect_uri'), origin + callback);
    const challenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(params.get('code_verifier')));
    assert.equal(Buffer.from(challenge).toString('base64url'), login.authorize.searchParams.get('code_challenge'));
    let token = await new SignJWT({
      email: settings.ADMIN_EMAIL,
      email_verified: true,
      nonce: login.authorize.searchParams.get('nonce'),
      iss: 'https://accounts.google.com',
      aud: settings.GOOGLE_CLIENT_ID,
      sub: 'google-user-id',
      iat: now(),
      exp: now() + 300,
      ...claims,
    }).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).sign(privateKey);
    if (malformedSignature) {
      const parts = token.split('.');
      parts[2] = (parts[2].startsWith('A') ? 'B' : 'A') + parts[2].slice(1);
      token = parts.join('.');
    }
    return Response.json({ id_token: token });
  });

  login = await beginLogin(request);
  const wrongState = await callbackWithState(request, login, 'Z'.repeat(43));
  assert.equal(wrongState.headers.get('Location'), '/admin?error=signin');
  const wrongBrowser = await request(`${callback}?code=test-code&state=${login.authorize.searchParams.get('state')}`);
  assert.equal(wrongBrowser.headers.get('Location'), '/admin?error=signin');
  assert.equal(tokenCalls, 0);
  sql.exec('UPDATE admin_oauth_flows SET expires_at = 0');
  assert.equal((await callbackWithState(request, login)).headers.get('Location'), '/admin?error=signin');
  assert.equal(tokenCalls, 0);

  for (const overrides of [
    { email: 'somebody-else@gmail.com' }, { email_verified: false }, { nonce: 'wrong' },
    { aud: 'different-app' }, { iss: 'https://wrong.example' }, { exp: now() - 60 },
    { azp: 'different-app' },
  ]) {
    login = await beginLogin(request);
    claims = overrides;
    assert.equal((await callbackWithState(request, login)).headers.get('Location'), '/admin?error=signin');
  }
  claims = {};
  malformedSignature = true;
  login = await beginLogin(request);
  assert.equal((await callbackWithState(request, login)).headers.get('Location'), '/admin?error=signin');
  malformedSignature = false;

  login = await beginLogin(request);
  const outcomes = await Promise.all([callbackWithState(request, login), callbackWithState(request, login)]);
  const successful = outcomes.find(response => response.headers.get('Location') === '/admin');
  assert.ok(successful);
  assert.equal(outcomes.filter(response => response.headers.get('Location') === '/admin?error=signin').length, 1);
  assert.equal(tokenCalls, 9);
  const sessionCookie = successful.headers.getSetCookie().find(value => value.startsWith('__Host-roxtech-admin-session='));
  assert.match(sessionCookie, /Max-Age=28800; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
  const authenticated = { Cookie: sessionCookie.split(';')[0] };
  const dashboard = await request('/admin', { headers: authenticated });
  assert.match(await dashboard.text(), /Sync Data/);

  const updateOptions = {
    method: 'PATCH',
    headers: { ...authenticated, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed' }),
  };
  assert.equal((await request('/api/bookings/1', updateOptions)).status, 403);
  updateOptions.headers.Origin = origin;
  assert.equal((await request('/api/bookings/99', updateOptions)).status, 404);
  assert.equal((await request('/api/bookings/1', updateOptions)).status, 200);
  const bookings = await (await request('/api/bookings', { headers: authenticated })).json();
  assert.equal(bookings.data[0].email, 'booking@example.com');
  assert.equal(bookings.data[0].status, 'confirmed');
  assert.equal((await request('/api/customers', { headers: authenticated })).status, 404);
  assert.equal((await request('/api/admin/logout', { method: 'POST', headers: authenticated })).status, 403);
  const logout = await request('/api/admin/logout', { method: 'POST', headers: { ...authenticated, Origin: origin } });
  assert.equal(logout.headers.get('Location'), '/admin');
  assert.match(logout.headers.getSetCookie()[0], /Max-Age=0/);
  assert.equal((await request('/api/bookings', { headers: authenticated })).status, 401);

  login = await beginLogin(request);
  const renewed = await callbackWithState(request, login);
  const expired = renewed.headers.getSetCookie().find(value => value.startsWith('__Host-roxtech-admin-session=')).split(';')[0];
  sql.exec('UPDATE admin_sessions SET expires_at = 0');
  assert.equal((await request('/api/bookings', { headers: { Cookie: expired } })).status, 401);
});

test('missing configuration fails closed while public pages and bookings still work', async t => {
  const { request } = fixture(t, { GOOGLE_CLIENT_SECRET: undefined });
  assert.equal((await request('/api/admin/google', { method: 'POST', headers: signInHeaders })).status, 503);
  assert.equal(await (await request('/')).text(), 'asset /');

  const indiaTomorrow = new Date(Date.now() + 330 * 60_000 + 86_400_000);
  while ([0, 6].includes(indiaTomorrow.getUTCDay())) indiaTomorrow.setUTCDate(indiaTomorrow.getUTCDate() + 1);
  const date = indiaTomorrow.toISOString().slice(0, 10);
  const path = `/api/bookings/availability?date=${date}`;
  const listSlots = async () => (await (await request(path)).json()).slots;
  assert.equal((await listSlots())[0].booked, false);
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ booking_date: date, booking_time: '10:00', name: 'Public Client',
      email: 'client@example.com', service: 'Web development' }),
  };
  assert.equal((await request('/api/bookings', options)).status, 201);
  assert.equal((await request('/api/bookings', options)).status, 409);
  assert.equal((await listSlots())[0].booked, true);
});

test('an approved passkey protects the dashboard and API, rotates the session, and can be revoked', async t => {
  const { request, sql } = fixture(t);
  const googleToken = randomBytes(32).toString('base64url');
  const digest = createHmac('sha256', settings.SESSION_SECRET).update('session:' + googleToken).digest('base64url');
  sql.prepare('INSERT INTO admin_sessions (token_digest, email, expires_at) VALUES (?, ?, ?)')
    .run(digest, settings.ADMIN_EMAIL, now() + 3600);
  const googleCookie = '__Host-roxtech-admin-session=' + googleToken;
  const googleHeaders = { Cookie: googleCookie, Origin: origin, 'Content-Type': 'application/json' };
  const endpoint = '/api/admin/passkey/';
  const post = (route, response, headers = googleHeaders) => request(endpoint + route, {
    method: 'POST', headers, body: response ? JSON.stringify(response) : undefined,
  });
  assert.equal((await post('register/start', undefined, { Origin: origin })).status, 401);
  assert.equal((await post('register/start', undefined, { ...googleHeaders, Origin: 'https://example.com' })).status, 403);
  assert.equal((await request('/admin/passkey/setup')).headers.get('Location'), '/admin');
  const setupPage = await request('/admin/passkey/setup', { headers: googleHeaders });
  const setupHtml = await setupPage.text();
  assert.match(setupHtml, /Set up your admin passkey/);
  const nonce = setupHtml.match(/<script nonce="([^"]+)">/)[1];
  assert.ok(setupPage.headers.get('Content-Security-Policy').includes("'nonce-" + nonce + "'"));

  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const rpHash = createHash('sha256').update('roxtech.online').digest();
  const credentialId = randomBytes(32);
  const id = credentialId.toString('base64url');
  const responseBase = { id, rawId: id, type: 'public-key', clientExtensionResults: {} };
  const encode = value => Buffer.from(isoCBOR.encode(value)).toString('base64url');
  const clientData = (type, challenge, requestOrigin = origin) =>
    Buffer.from(JSON.stringify({ type, challenge, origin: requestOrigin, crossOrigin: false }));

  const { options: registration } = await (await post('register/start')).json();
  assert.equal(registration.authenticatorSelection.userVerification, 'required');
  const publicData = isoCBOR.encode(new Map([
    [1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')],
  ]));
  const attested = Buffer.concat([
    rpHash, Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), Buffer.from([0, credentialId.length]),
    credentialId, publicData,
  ]);
  const enrollment = await post('register/finish', {
    ...responseBase,
    response: {
      clientDataJSON: clientData('webauthn.create', registration.challenge).toString('base64url'),
      attestationObject: encode(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', attested]])),
    },
  });
  assert.equal(enrollment.status, 200);
  const { approvalReference } = await enrollment.json();
  assert.match(approvalReference, /^[A-F0-9]{16}$/);
  assert.equal((await post('authenticate/start')).status, 409);
  assert.equal((await request('/api/bookings', { headers: googleHeaders })).status, 200);

  const approved = sql.prepare(`
    UPDATE admin_passkeys SET approved_at = ?
    WHERE approval_reference = ? AND email = ? AND approved_at IS NULL AND pending_until > ?
  `).run(now(), approvalReference, settings.ADMIN_EMAIL, now());
  assert.equal(approved.changes, 1);
  assert.equal((await request('/admin', { headers: googleHeaders })).headers.get('Location'), '/admin/passkey');
  assert.equal((await request('/api/bookings', { headers: googleHeaders })).status, 401);

  async function assertion(options, flags, requestOrigin = origin) {
    const client = clientData('webauthn.get', options.challenge, requestOrigin);
    const authenticatorData = Buffer.concat([rpHash, Buffer.from([flags, 0, 0, 0, 1])]);
    const signature = sign('sha256', Buffer.concat([authenticatorData, createHash('sha256').update(client).digest()]), privateKey);
    return post('authenticate/finish', {
      ...responseBase,
      response: {
        clientDataJSON: client.toString('base64url'),
        authenticatorData: authenticatorData.toString('base64url'),
        signature: signature.toString('base64url'),
      },
    });
  }
  const { options: mismatchedOrigin } = await (await post('authenticate/start')).json();
  assert.equal((await assertion(mismatchedOrigin, 0x05, 'https://www.roxtech.online')).status, 403);
  const { options: missingVerification } = await (await post('authenticate/start')).json();
  assert.equal((await assertion(missingVerification, 0x01)).status, 403);
  assert.equal((await assertion(missingVerification, 0x05)).status, 400);

  const { options: authentication } = await (await post('authenticate/start')).json();
  assert.equal(authentication.userVerification, 'required');
  const elevated = await assertion(authentication, 0x05);
  assert.equal(elevated.status, 200);
  const verifiedCookie = elevated.headers.get('Set-Cookie');
  assert.match(verifiedCookie, /Max-Age=1800; Path=\/; Secure; HttpOnly; SameSite=Lax/);
  assert.notEqual(verifiedCookie.split(';')[0], googleCookie);
  const verifiedHeaders = { Cookie: verifiedCookie.split(';')[0] };
  assert.match(await (await request('/admin', { headers: verifiedHeaders })).text(), /Sync Data/);
  assert.equal((await request('/api/bookings', { headers: verifiedHeaders })).status, 200);
  assert.equal((await request('/api/bookings', { headers: googleHeaders })).status, 401);

  sql.prepare('UPDATE admin_passkeys SET revoked_at = ? WHERE credential_id = ?').run(now(), id);
  assert.equal((await request('/api/bookings', { headers: verifiedHeaders })).status, 401);
  assert.equal((await request('/admin', { headers: verifiedHeaders })).headers.get('Location'), '/admin/passkey');
});

test('public project inquiries are validated, persisted once, and private', async t => {
  const { request, sql } = fixture(t, {
    PUBLIC_RATE_LIMIT: { limit: async ({ key }) => ({ success: !key.endsWith(':192.0.2.1') }) },
  });
  const submission = {
    request_id: 'c1cc962e-7d46-4d8e-81a6-420e86a159c3',
    name: 'Test Person', email: 'Test@example.com', phone: '+91 12345 67890',
    message: 'An inquiry for the test project.', service: 'Web development',
  };
  const submit = (path, data, headers = {}) => request(path, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  assert.equal((await submit('/api/contact', submission, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await submit('/api/contact', submission, { 'CF-Connecting-IP': '192.0.2.1' })).status, 429);
  assert.equal((await submit('/api/contact', { ...submission, phone: '555' })).status, 400);
  assert.equal((await submit('/api/contact', { ...submission, message: 'a'.repeat(9000) })).status, 413);
  assert.equal((await submit('/api/contact', submission)).status, 201);
  assert.equal((await submit('/api/contact', submission)).status, 200);
  assert.equal((await submit('/api/contact', { ...submission, message: 'A different project.' })).status, 409);
  assert.equal((await submit('/api/leads', { ...submission, request_id: crypto.randomUUID(), estimated_budget: '₹50,000' })).status, 201);
  const rows = sql.prepare('SELECT source, email FROM project_inquiries ORDER BY source').all();
  assert.deepEqual(rows.map(row => [row.source, row.email]), [['contact', 'test@example.com'], ['estimator', 'test@example.com']]);
  assert.equal((await request('/api/contact')).status, 401);
  assert.equal((await request('/api/health')).status, 200);
});

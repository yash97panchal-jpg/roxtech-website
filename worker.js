import dashboard from './admin.html';
import signInPage from './admin-login.html';
import passkeyPage from './admin-passkey.html';
import {
  ADMIN_ORIGIN, GOOGLE_CALLBACK, adminHeaders, completeGoogleSignIn,
  getAdminSession, hasAdminSession, oauthConfigured, sameAdminOrigin, signOut, startGoogleSignIn,
} from './admin-auth.js';
import { handleAdminPasskey } from './admin-passkey.js';

const HOUR_SLOTS = Array.from({ length: 8 }, (_, hour) => `${hour + 10}:00`);
const SERVICES = [
  'Web development', 'ERP & custom software', 'Mobile apps',
  'Cloud and DevOps', 'AI and automation', 'Data services'
];
const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;
const ADMIN_DOCUMENTS = new Set(['/admin', '/admin.html', '/admin/', '/admin/passkey', '/admin/passkey/setup']);
const ADMIN_READ_PATHS = new Set([
  '/api/stats', '/api/contact', '/api/orders', '/api/quote', '/api/customers',
  '/api/careers/applications', '/api/newsletter',
]);

function todayInIndia(now) {
  return new Date(now.getTime() + IST_OFFSET).toISOString().slice(0, 10);
}

function bookableDate(date, now) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) return false;
  const today = Date.parse(`${todayInIndia(now)}T00:00:00Z`);
  const daysAhead = (day.getTime() - today) / DAY;
  return daysAhead >= 1 && daysAhead <= 14 && ![0, 6].includes(day.getUTCDay());
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

function field(data, key, maxLength, required = true) {
  const value = data[key];
  if (!required && value == null) return '';
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value.trim();
}

const inquiryPaths = new Map([['/api/contact', 'contact'], ['/api/leads', 'estimator']]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    return { error: json({ success: false, message: 'Expected JSON.' }, 415) };
  }
  const reader = request.body?.getReader();
  const bytes = new Uint8Array(8192);
  let length = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    if (length + value.length > bytes.length) {
      await reader.cancel();
      return { error: json({ success: false, message: 'Request is too large.' }, 413) };
    }
    bytes.set(value, length);
    length += value.length;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)));
    if (data && !Array.isArray(data) && typeof data === 'object') return { data };
  } catch {
    // The caller returns the same error for invalid JSON and invalid top-level types.
  }
  return { error: json({ success: false, message: 'Invalid request.' }, 400) };
}

async function limitPublicRequest(request, env, path) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!env.PUBLIC_RATE_LIMIT || !ip) return null;
  const { success } = await env.PUBLIC_RATE_LIMIT.limit({ key: `${path}:${ip}` });
  return success ? null : json({ success: false, message: 'Too many requests. Try again in a minute.' }, 429,
    { 'Retry-After': '60' });
}

async function saveInquiry(request, env, url) {
  if (request.headers.get('Origin') !== url.origin) {
    return json({ success: false, message: 'Invalid origin.' }, 403);
  }
  const limited = await limitPublicRequest(request, env, url.pathname);
  if (limited) return limited;
  const { data, error } = await readJson(request);
  if (error) return error;

  const id = field(data, 'request_id', 36);
  const name = field(data, 'name', 100);
  const email = field(data, 'email', 254)?.toLowerCase();
  const phone = field(data, 'phone', 40);
  const company = field(data, 'company', 120, false);
  const service = field(data, 'service', 120, false);
  const budget = field(data, 'estimated_budget', 100, false);
  const message = field(data, 'message', 2000);
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (!UUID.test(id ?? '') || !name || name.length < 2 || !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !/^[\d+().\s-]+$/.test(phone) ||
    digits.length < 10 || digits.length > 15 || !message || message.length < 5 ||
    [company, service, budget].includes(null)) {
    return json({ success: false, message: 'Check your contact and project details, then try again.' }, 400);
  }
  const source = inquiryPaths.get(url.pathname);
  const idLower = id.toLowerCase();
  const inserted = await env.BOOKINGS.prepare(`
    INSERT INTO project_inquiries (id, source, name, email, phone, company, service, budget, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING RETURNING id
  `).bind(idLower, source, name, email, phone, company, service, budget, message).first();
  if (inserted) return json({ success: true, reference: inserted.id }, 201);
  const existing = await env.BOOKINGS.prepare(`
    SELECT id FROM project_inquiries WHERE id = ? AND source = ? AND name = ? AND email = ?
      AND phone = ? AND company = ? AND service = ? AND budget = ? AND message = ?
  `).bind(idLower, source, name, email, phone, company, service, budget, message).first();
  return existing
    ? json({ success: true, reference: existing.id })
    : json({ success: false, message: 'The submission reference was already used.' }, 409);
}

async function bookingApi(request, db, url, now) {
  if (url.pathname === '/api/bookings/availability') {
    if (request.method !== 'GET') return json({ success: false }, 405, { Allow: 'GET' });
    const date = url.searchParams.get('date');
    if (!bookableDate(date, now)) return json({ success: false, message: 'Choose a weekday within the next 14 days.' }, 400);

    const { results } = await db.prepare('SELECT booking_time FROM consultations WHERE booking_date = ?').bind(date).all();
    const booked = new Set(results.map(row => row.booking_time));
    return json({
      success: true,
      date,
      timezone: 'Asia/Kolkata',
      slots: HOUR_SLOTS.map(time => ({ time, booked: booked.has(time) }))
    });
  }

  if (request.method !== 'POST') return json({ success: false }, 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ success: false, message: 'Invalid origin.' }, 403);
  const { data, error } = await readJson(request);
  if (error) return error;

  const date = data.booking_date;
  const time = data.booking_time;
  const name = field(data, 'name', 100);
  const email = field(data, 'email', 254);
  const phone = field(data, 'phone', 40, false);
  const service = field(data, 'service', 80);
  const note = field(data, 'note', 1000, false);
  if (!bookableDate(date, now) || !HOUR_SLOTS.includes(time) || !name || name.length < 2 ||
      !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone === null ||
      !SERVICES.includes(service) || note === null) {
    return json({ success: false, message: 'Check the consultation date, time and contact details.' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO consultations (booking_date, booking_time, name, email, phone, service, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (booking_date, booking_time) DO NOTHING
    RETURNING id
  `).bind(date, time, name, email.toLowerCase(), phone, service, note).first();

  if (!result) return json({ success: false, message: 'That time has just been booked. Please choose another slot.' }, 409);
  return json({ success: true, id: result.id }, 201);
}

function adminJson(data, status, headers) {
  return json(data, status, { ...adminHeaders, ...headers });
}

function adminPage(body, authenticated, nonce) {
  const formTargets = authenticated ? "'self'" : "'self' https://accounts.google.com";
  const scriptTargets = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  return new Response(body, {
    headers: {
      ...adminHeaders,
      'Referrer-Policy': 'same-origin',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': `default-src 'none'; script-src ${scriptTargets}; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; form-action ${formTargets}; frame-ancestors 'none'; base-uri 'none'`,
    },
  });
}

function adminRedirect(location) {
  return new Response(null, { status: 302, headers: { ...adminHeaders, Location: location } });
}

function renderPasskeyPage(request, setup) {
  const nonce = crypto.randomUUID();
  const page = passkeyPage
    .replace('PASSKEY_NONCE', nonce)
    .replace('PASSKEY_OPERATION', setup ? 'register' : 'authenticate')
    .replace('PASSKEY_HEADING', setup ? 'Set up your admin passkey' : 'Verify your admin passkey')
    .replace('PASSKEY_INSTRUCTION', setup
      ? 'Create a passkey with your phone, computer, or security key. The setup requires approval.'
      : 'Unlock your approved passkey with your screen lock or security key to open the admin dashboard.')
    .replace('PASSKEY_BUTTON', setup ? 'Create passkey' : 'Verify passkey')
    .replace('PASSKEY_LINK_URL', setup ? '/admin' : '/admin/passkey/setup')
    .replace('PASSKEY_LINK_TEXT', setup ? 'Back to admin' : 'Set up a replacement passkey');
  return adminPage(request.method === 'HEAD' ? null : page, true, nonce);
}

function methodNotAllowed(allow) {
  return adminJson({ success: false }, 405, { Allow: allow });
}

function adminNotFound() {
  return adminJson({ success: false, message: 'This endpoint is unavailable.' }, 404);
}

async function manageBookings(request, db, path) {
  if (path === '/api/bookings') {
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed('GET, HEAD, POST');
    if (request.method === 'HEAD') return new Response(null, { headers: adminHeaders });
    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.email, c.phone, c.service, c.booking_date, c.booking_time,
             COALESCE(s.status, 'pending') AS status
      FROM consultations c LEFT JOIN consultation_admin_status s ON s.consultation_id = c.id
      ORDER BY c.booking_date DESC, c.booking_time DESC, c.id DESC
    `).all();
    return adminJson({ success: true, data: results });
  }

  const id = Number(path.match(/^\/api\/bookings\/([1-9]\d*)$/)?.[1]);
  if (!Number.isSafeInteger(id)) return adminNotFound();
  if (request.method !== 'PATCH') return methodNotAllowed('PATCH');
  if (!sameAdminOrigin(request)) return adminJson({ success: false, message: 'Invalid origin.' }, 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    return adminJson({ success: false }, 415);
  }
  const data = await request.json().catch(() => null);
  const status = data?.status;
  if (!['confirmed', 'cancelled'].includes(status)) {
    return adminJson({ success: false, message: 'Invalid booking status.' }, 400);
  }

  const stored = await db.prepare(`
    INSERT INTO consultation_admin_status (consultation_id, status)
    SELECT id, ? FROM consultations WHERE id = ?
    ON CONFLICT (consultation_id) DO UPDATE SET status = excluded.status
    RETURNING consultation_id
  `).bind(status, id).first();
  if (!stored) return adminNotFound();
  return adminJson({ success: true });
}

async function adminRequest(request, env, url) {
  const path = url.pathname;
  const isDocument = ADMIN_DOCUMENTS.has(path);
  if (url.origin !== ADMIN_ORIGIN) {
    return isDocument ? Response.redirect(`${ADMIN_ORIGIN}/admin`, 302) : adminNotFound();
  }
  if (isDocument) {
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed('GET, HEAD');
    if (path === '/admin.html' || path === '/admin/') return adminRedirect(`${ADMIN_ORIGIN}/admin`);
    const session = await getAdminSession(request, env);
    if (path !== '/admin') {
      if (!session) return adminRedirect('/admin');
      return renderPasskeyPage(request, path === '/admin/passkey/setup');
    }
    if (session && !session.authorized) return adminRedirect('/admin/passkey');
    const authenticated = Boolean(session);
    const error = url.searchParams.get('error') === 'signin';
    const page = authenticated ? dashboard : signInPage.replace('<!-- SIGN_IN_ERROR -->', error
      ? '<p role="alert" class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">Sign-in could not be completed. Try again with the authorized Google account.</p>' : '');
    return adminPage(request.method === 'HEAD' ? null : page, authenticated);
  }

  if (path.startsWith('/api/admin/passkey/')) return handleAdminPasskey(request, env, path);

  if (path === '/api/admin/google' || path === GOOGLE_CALLBACK) {
    const isCallback = path === GOOGLE_CALLBACK;
    const method = isCallback ? 'GET' : 'POST';
    if (request.method !== method) return methodNotAllowed(method);
    if (!isCallback && !sameAdminOrigin(request)) return adminJson({ success: false, message: 'Invalid origin.' }, 403);
    if (!oauthConfigured(env)) return adminJson({ success: false, message: 'Admin sign-in is temporarily unavailable.' }, 503);
    return isCallback ? completeGoogleSignIn(request, env, url.searchParams) : startGoogleSignIn(env);
  }

  if (path === '/api/admin/logout') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    if (!sameAdminOrigin(request)) return adminJson({ success: false, message: 'Invalid origin.' }, 403);
    return signOut(request, env);
  }

  if (!await hasAdminSession(request, env)) {
    return adminJson({ success: false, message: 'Admin sign-in required.' }, 401);
  }
  if (path === '/api/bookings' || path.startsWith('/api/bookings/')) return manageBookings(request, env.BOOKINGS, path);
  if (path === '/api/contact') {
    if (request.method === 'HEAD') return new Response(null, { headers: adminHeaders });
    const { results } = await env.BOOKINGS.prepare(`
      SELECT id, source, name, email, phone, company, service, budget, message, created_at,
             COUNT(*) OVER () AS total
      FROM project_inquiries ORDER BY created_at DESC, id DESC LIMIT 100
    `).all();
    return adminJson({ success: true, total: results[0]?.total ?? 0, data: results }, 200);
  }
  return adminNotFound();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed('GET, HEAD');
      return request.method === 'HEAD'
        ? new Response(null, { headers: { 'Cache-Control': 'no-store' } })
        : json({ success: true });
    }
    if (inquiryPaths.has(path) && request.method === 'POST') {
      try {
        return await saveInquiry(request, env, url);
      } catch {
        console.error('Project inquiry storage failed');
        return json({ success: false, message: 'Inquiry service is temporarily unavailable.' }, 503);
      }
    }
    if (path === '/api/bookings/availability' || (path === '/api/bookings' && request.method === 'POST')) {
      try {
        if (request.method === 'POST') {
          const limited = await limitPublicRequest(request, env, path);
          if (limited) return limited;
        }
        return await bookingApi(request, env.BOOKINGS, url, new Date());
      } catch (error) {
        console.error('Consultation booking request failed', error?.name);
        return json({ success: false, message: 'Booking service is temporarily unavailable.' }, 503);
      }
    }
    if (ADMIN_DOCUMENTS.has(path) || path === GOOGLE_CALLBACK || path === '/api/admin' || path.startsWith('/api/admin/') ||
        path === '/api/bookings' || path.startsWith('/api/bookings/') ||
        (ADMIN_READ_PATHS.has(path) && ['GET', 'HEAD'].includes(request.method))) {
      try {
        return await adminRequest(request, env, url);
      } catch {
        console.error('Admin request could not be completed');
        return adminJson({ success: false, message: 'Admin service is temporarily unavailable.' }, 503);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

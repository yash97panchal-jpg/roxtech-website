import dashboard from './admin.html';
import signInPage from './admin-login.html';
import {
  ADMIN_ORIGIN, GOOGLE_CALLBACK, adminHeaders, completeGoogleSignIn,
  hasAdminSession, oauthConfigured, sameAdminOrigin, signOut, startGoogleSignIn,
} from './admin-auth.js';

const HOUR_SLOTS = Array.from({ length: 8 }, (_, hour) => `${hour + 10}:00`);
const SERVICES = [
  'Web development', 'ERP & custom software', 'Mobile apps',
  'Cloud and DevOps', 'AI and automation', 'Data services'
];
const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;
const ADMIN_DOCUMENTS = new Set(['/admin', '/admin.html', '/admin/']);
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
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return json({ success: false }, 415);
  const reader = request.body?.getReader();
  const bytes = new Uint8Array(8192);
  let length = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    if (length + value.length > bytes.length) {
      await reader.cancel();
      return json({ success: false, message: 'Request is too large.' }, 413);
    }
    bytes.set(value, length);
    length += value.length;
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)));
  } catch {
    return json({ success: false, message: 'Invalid request.' }, 400);
  }
  if (!data || Array.isArray(data) || typeof data !== 'object') return json({ success: false }, 400);

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

function adminPage(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...adminHeaders,
      'Referrer-Policy': 'same-origin',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
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
    if (path !== '/admin') return Response.redirect(`${ADMIN_ORIGIN}/admin`, 302);
    const authenticated = await hasAdminSession(request, env);
    const error = url.searchParams.get('error') === 'signin';
    const page = authenticated ? dashboard : signInPage.replace('<!-- SIGN_IN_ERROR -->', error
      ? '<p role="alert" class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">Sign-in could not be completed. Try again with the authorized Google account.</p>' : '');
    return adminPage(request.method === 'HEAD' ? null : page);
  }

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
  return adminNotFound();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/bookings/availability' || (path === '/api/bookings' && request.method === 'POST')) {
      try {
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

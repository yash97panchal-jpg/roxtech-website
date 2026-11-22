const HOUR_SLOTS = Array.from({ length: 8 }, (_, hour) => `${hour + 10}:00`);
const SERVICES = [
  'Web development', 'ERP & custom software', 'Mobile apps',
  'Cloud and DevOps', 'AI and automation', 'Data services'
];
const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api/bookings', '/api/bookings/availability'].includes(url.pathname)) {
      return env.ASSETS.fetch(request);
    }
    try {
      return await bookingApi(request, env.BOOKINGS, url, new Date());
    } catch (error) {
      console.error('Consultation booking request failed', error?.name);
      return json({ success: false, message: 'Booking service is temporarily unavailable.' }, 503);
    }
  }
};

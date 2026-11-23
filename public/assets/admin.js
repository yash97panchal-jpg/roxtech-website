const tabButtons = [...document.querySelectorAll('[data-admin-tab]')];
const bookingsTable = document.getElementById('table-bookings');
const inquiriesTable = document.getElementById('table-inquiries');
const syncButton = document.getElementById('sync-admin-data');
const statusMessage = document.getElementById('admin-status');
const tabStyle = 'px-4 py-2 rounded-lg text-xs font-bold transition-colors';
const statusStyle = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    for (const tab of tabButtons) {
      const active = tab === button;
      tab.setAttribute('aria-pressed', String(active));
      tab.className = `${tabStyle} ${active ? 'bg-[#0B1B3D] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`;
      document.getElementById(tab.getAttribute('aria-controls')).classList.toggle('hidden', !active);
    }
  });
}

function announce(message) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('hidden', !message);
}

function addText(parent, tag, value, className) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderBookings(bookings) {
  bookingsTable.replaceChildren();
  if (bookings.length === 0) {
    const cell = addText(bookingsTable.insertRow(), 'td', 'No consultation bookings found.', 'p-6 text-center text-slate-400');
    cell.colSpan = 7;
    return;
  }

  for (const booking of bookings) {
    const row = bookingsTable.insertRow();
    row.className = 'hover:bg-slate-50 transition-colors';
    addText(row, 'td', `#BKG-${booking.id}`, 'p-4 font-mono text-[#0AA5E6] font-bold');
    const contact = addText(row, 'td', '', 'p-4');
    addText(contact, 'div', booking.name, 'font-bold text-slate-900');
    addText(contact, 'div', booking.email, 'text-[11px] text-slate-500 font-mono');
    if (booking.phone) addText(contact, 'div', booking.phone, 'text-[10px] text-slate-400 font-mono');
    addText(row, 'td', booking.service, 'p-4 font-semibold text-slate-800');
    addText(row, 'td', booking.booking_date, 'p-4 font-medium text-slate-900');
    addText(row, 'td', `${booking.booking_time} IST`, 'p-4 font-mono text-[#0AA5E6] font-semibold');
    const status = addText(row, 'td', '', 'p-4');
    addText(status, 'span', booking.status, `px-2.5 py-1 rounded-full text-[10px] font-semibold font-mono border ${statusStyle[booking.status]}`);
    const actions = addText(addText(row, 'td', '', 'p-4'), 'div', '', 'flex items-center gap-1.5');

    for (const [value, label, style] of [
      ['confirmed', 'Confirm', 'bg-emerald-600 text-white hover:bg-emerald-700'],
      ['cancelled', 'Cancel', 'bg-red-50 text-red-700 hover:bg-red-100'],
    ]) {
      if (booking.status === value) continue;
      const button = addText(actions, 'button', label, `px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${style}`);
      button.type = 'button';
      button.addEventListener('click', () => updateBooking(booking.id, value, actions));
    }
  }
}

function renderInquiries(inquiries, total) {
  inquiriesTable.replaceChildren();
  document.getElementById('stat-inquiries').textContent = total;
  if (inquiries.length === 0) {
    addText(inquiriesTable.insertRow(), 'td', 'No project inquiries found.', 'p-6 text-center text-slate-400').colSpan = 7;
    return;
  }
  for (const inquiry of inquiries) {
    const row = inquiriesTable.insertRow();
    addText(row, 'td', inquiry.id.slice(0, 8), 'p-4 font-mono');
    const contact = addText(row, 'td', inquiry.name, 'p-4 font-semibold');
    addText(contact, 'div', inquiry.email, 'text-slate-600');
    addText(contact, 'div', inquiry.phone, 'text-slate-600');
    addText(row, 'td', inquiry.company || '—', 'p-4');
    addText(row, 'td', [inquiry.service, inquiry.budget].filter(Boolean).join(' · ') || '—', 'p-4');
    addText(row, 'td', inquiry.message, 'p-4 whitespace-pre-wrap break-words');
    addText(row, 'td', inquiry.source === 'estimator' ? 'Estimator' : 'Quote form', 'p-4');
    addText(row, 'td', inquiry.created_at + ' UTC', 'p-4 whitespace-nowrap');
  }
}

async function adminRequest(path, options) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', redirect: 'error' });
  if (response.status === 401) {
    bookingsTable.replaceChildren();
    inquiriesTable.replaceChildren();
    window.location.replace('/admin');
    return null;
  }
  if (!response.ok) throw new Error('Admin request failed');
  return response.json();
}

async function loadDashboard() {
  syncButton.disabled = true;
  announce('');
  try {
    const results = await Promise.allSettled([
      adminRequest('/api/bookings').then(result => { if (result) renderBookings(result.data); }),
      adminRequest('/api/contact').then(result => { if (result) renderInquiries(result.data, result.total); }),
    ]);
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [index ? 'inquiries' : 'bookings'] : []);
    if (failed.length) announce(`Could not load ${failed.join(' and ')}. Use Sync Data to try again.`);
  } finally {
    syncButton.disabled = false;
  }
}

async function updateBooking(id, status, actions) {
  for (const button of actions.children) button.disabled = true;
  try {
    const result = await adminRequest(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (result?.success) await loadDashboard();
  } catch {
    announce('Could not update this booking. Try again.');
  } finally {
    for (const button of actions.children) button.disabled = false;
  }
}

syncButton.addEventListener('click', loadDashboard);
window.addEventListener('pageshow', event => {
  if (event.persisted) window.location.reload();
});
loadDashboard();

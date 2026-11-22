CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (booking_date, booking_time)
);

# RoxTech production website

Cloudflare Worker `lingering-mountain-bef0` serves [roxtech.online](https://roxtech.online/) from `public/` and handles consultation bookings and admin access in `worker.js`. Cloudflare Workers Builds deploys the `main` branch with `npm run deploy`.

## Admin Google sign-in

Use a Google OAuth web application client with this exact authorized redirect URI.

```text
https://roxtech.online/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (at least 32 characters of cryptographically random data), and `ADMIN_EMAIL` in the production Worker's **Variables and Secrets**. The admin email must be a Gmail address or a Google Workspace address Google can verify. For an OAuth app in Testing, include this account in Google's test users.

Apply `booking-schema.sql` followed by `admin-schema.sql` to a new environment's `BOOKINGS` database before deploying. For an existing bookings database, apply `admin-schema.sql` before deploying. Both files can be reapplied safely.

Run `npm ci`, `npm test` (Node.js 22.15 or later), and `npm run deploy -- --dry-run` to validate changes. The admin sign-in page is at [roxtech.online/admin](https://roxtech.online/admin).

## Admin passkey

The approved Google account can enroll a device at [roxtech.online/admin/passkey/setup](https://roxtech.online/admin/passkey/setup). The device must verify its user. The Worker stores only the public credential and a setup reference that expires in 30 minutes.

Verify the owner requested the exact reference through a trusted channel. In the production `BOOKINGS` database, approve the matching pending reference and owner email using bound parameters.

```sql
UPDATE admin_passkeys SET approved_at = unixepoch()
WHERE approval_reference = ? AND email = ?
  AND approved_at IS NULL AND revoked_at IS NULL AND pending_until > unixepoch()
RETURNING approval_reference;
```

The first approval turns on passkey checks for the owner. The owner then verifies the passkey at [roxtech.online/admin/passkey](https://roxtech.online/admin/passkey). Successful passkey verification creates a new, 30-minute admin session and invalidates the Google-only session. Use the same approval process to enroll a backup or replace a lost passkey. Set `revoked_at` on a lost key to disable it and its sessions while retaining enforcement.

## Inquiries and releases

Apply `inquiry-schema.sql` once to the `BOOKINGS` database before deploying the inquiry endpoints. Homepage and contact inquiries use `POST /api/contact`, and estimator requests use `POST /api/leads`. The authenticated Inquiries tab shows the newest 100 requests. Saving an inquiry does not send an email.

Run `npm test` before merging. For a local copy with isolated D1 data, run the following commands from the repository root.

```sh
npx wrangler@4.166.0 d1 execute BOOKINGS --local --file booking-schema.sql
npx wrangler@4.166.0 d1 execute BOOKINGS --local --file admin-schema.sql
npx wrangler@4.166.0 d1 execute BOOKINGS --local --file inquiry-schema.sql
npx wrangler@4.166.0 dev --local
```

Use `/api/health` for HTTP uptime checks. Workers Logs captures explicit application errors. Automatic per-request logging is disabled.

In **Workers & Pages → lingering-mountain-bef0 → Deployments**, select a known-good deployment to roll back code. Match the Worker version to the database schema. D1 Time Travel is a separate recovery mechanism. Record the current D1 bookmark before a restore and verify the expected timestamp, because restoring changes the production database. Keep OAuth credentials separate from Git in Cloudflare secrets and the owner's password manager.

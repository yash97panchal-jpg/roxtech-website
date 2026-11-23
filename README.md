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

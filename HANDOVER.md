# Klasora tenant deployment handover

Last updated: 2026-10-06

## Goal and guardrails

Continue the Klasora multi-tenant school portal without changing its existing
UI. Preserve the current shared Neon database, `schools` / `memberships`
tenant model, Managed Neon Auth integration, and Vercel app-domain links with
`?tenant=<subdomain>`. Ask before introducing a new database, schema, identity
provider, custom domain, or user-facing redesign.

Do not copy the attached integration notes as current architecture. Those notes
describe a different/single-school schema (`school_profile`, `auth_credentials`,
and no tenant membership model). The checked-out repository and connected
database use the school-scoped schema instead.

## Repository and current revision

- Repository: `akwasijulian515-crypto/quick-sketch-pages`
- Branch: `main`
- Latest pushed commit: `a8624586bfe32652df08f6236c33124978b5562d`
- Commit subject: `Fix platform auth and tenant portal links`
- Worktree was clean after that commit. `.env.local` is gitignored; never stage,
print, or share its values.
- The Vercel project was imported from this repository's `main` branch, so
  subsequent pushes to `main` should trigger deployments through its Git
  integration.

## Done

### Database and tenant model

- Reused the already-existing Neon project/database; no duplicate database was
  created.
- Neon project: `lmsss` (`restless-snow-10784481`), default branch
  `production` (`br-cool-resonance-b4xb9f9g`), database `neondb`.
- The database contains the current tenant tables including `schools`,
  `memberships`, and operational tables. The `schema_migrations` table showed
  the current `0001` through `0010` migrations and historical `001_` through
  `007_` migration records. Do not run migrations against production without
  reviewing the runner, migration ordering, and ledger first.
- Existing records were observed, including `Happy Home Academy`; do not treat
  production as an empty database or run cleanup/seed scripts.

### Vercel deployment

- Created a separate Vercel project named `klasora-tenant-portal` under the
  existing Vercel team.
- Deployed commit `a862458`.
- Main app URL: <https://klasora-tenant-portal.vercel.app>
- A deployment-specific URL also appeared during setup:
  `klasora-tenant-portal-3eozbvki8-broke8.vercel.app`.
- Kept the existing Neon database; did not add the optional Vercel Neon
  integration because it would provision/connect a separate integration rather
  than reuse the existing setup.
- At project creation, the user imported the local environment variables into
  Vercel and removed `ROOT_DOMAIN` for the chosen `?tenant=` URL approach.
  Variable values were not inspected or retained in this file.
- Production `GET /api/auth/config` returned HTTP 200 with an Auth URL present
  and no root domain configured. This is expected for Vercel app-domain links.
- Neon Auth trusted domain list was updated to include
  `https://klasora-tenant-portal.vercel.app`.

### Tenant portal links and production smoke test

- The Super Admin school directory now shows an actual tenant login URL with
  copy/open actions. The onboarding list also displays a tenant URL.
- With `ROOT_DOMAIN` unset, links use the current app origin and
  `?tenant=<subdomain>`. With a real configured `ROOT_DOMAIN`, the helper can
  generate subdomain links; custom subdomains are not part of the current plan.
- Production smoke check passed:
  `https://klasora-tenant-portal.vercel.app/login?tenant=happy-home-academy`
  rendered Happy Home Academy branding.
- `GET /api/school?tenant=happy-home-academy` returned HTTP 200 with that
  school's record.
- No UI redesign was made.

### Super Admin and local token

- The Neon Auth user that had been associated with the global Super Admin was
  deleted from the production branch at the user's request. The app-side
  `users` record and its global `super_admin` membership were left in place.
- The app supports the legacy `PLATFORM_ADMIN_TOKEN` sign-in at `/admin`.
- Fixed local env loading in `src/server/database.ts`; the normal dev server
  had previously missed `.env.local` when Auth URL variables were already
  present.
- Local token sign-in was verified with HTTP 200 after restarting the dev
  server on port 8080. At the time of the last check, the local token was a
  short numeric value. Do not reuse it in production; rotate to a long,
  randomly generated secret.
- The deployed production token was not independently tested. Do not assume
  that Vercel has the intended high-entropy token until its environment
  settings and `/admin` sign-in are verified.

## Not done / not verified

1. **Production Super Admin access:** Verify the Vercel
   `PLATFORM_ADMIN_TOKEN` is present, strong, and accepted at
   `https://klasora-tenant-portal.vercel.app/admin`. Set/rotate it in Vercel
   without exposing it in chat, source, logs, or this handover. The deleted
   Neon Auth Super Admin login must be recreated through the supported Auth
   flow if account-based Super Admin access is wanted again.
2. **School account sign-in on production:** No actual school admin, teacher,
   parent, student, or finance credentials were used to test production login.
   Test one authorized account and protected pages without sharing credentials.
3. **Tenant isolation:** Smoke testing confirmed tenant branding and one
   tenant lookup only. Run an end-to-end authorization matrix to ensure an
   account in tenant A cannot read or mutate tenant B data through any API
   route. Tenant query parameters are selectors, not authorization; server
   membership checks must remain authoritative.
4. **Tenant application workflows:** Test create school, approval, first
   School Admin activation, staff creation, student creation, attendance,
   grades, fees, and sign-out/session expiry on the deployed app.
5. **Invitation email delivery:** Production Resend configuration and actual
   delivery were not confirmed. Set `RESEND_API_KEY` and
   `RESEND_FROM_EMAIL` in Vercel only if invitation email is required, verify
   the sender domain with Resend, then test delivery.
6. **Vercel env audit:** Confirm production and preview scopes for
   `DATABASE_URL` (pooled runtime connection), `NEON_AUTH_URL`,
   `VITE_NEON_AUTH_URL`, and a strong `PLATFORM_ADMIN_TOKEN`. Never copy
   `.env.local` contents into a report or source file. Keep
   `ROOT_DOMAIN` unset for the current Vercel URL approach.
7. **Migration reproducibility:** Before using a clean database, inspect
   `scripts/migrate.mjs` and every migration in `database/migrations/`.
   Current database records include both zero-prefixed and historical
   migration naming series; verify a fresh ordered run in a disposable
   database/branch. Do not run cleanup or migration steps against production
   without explicit approval.
8. **Domain configuration:** No custom domain or wildcard DNS was set up.
   Continue with the Vercel app domain and query-based tenant links unless the
   user explicitly asks to add a custom domain.

## Configuration reference (names only; never put values in this file)

Expected production settings for the selected approach:

- `DATABASE_URL` — existing Neon pooled connection string for `neondb`.
- `NEON_AUTH_URL` — existing Neon Auth URL.
- `VITE_NEON_AUTH_URL` — same Auth URL needed by the browser auth client.
- `PLATFORM_ADMIN_TOKEN` — long randomly generated secret, distinct from local
  or previously shared values.
- `ROOT_DOMAIN` — leave unset for Vercel links using `?tenant=`.
- Optional invitations: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

Use only server-side variables for database/admin secrets. Never prefix secrets
with `VITE_`.

## Useful URLs

- Vercel app: <https://klasora-tenant-portal.vercel.app>
- Super Admin route: <https://klasora-tenant-portal.vercel.app/admin>
- Tenant example: <https://klasora-tenant-portal.vercel.app/login?tenant=happy-home-academy>
- Vercel project dashboard:
  <https://vercel.com/broke8/klasora-tenant-portal>
- Neon project dashboard:
  <https://console.neon.tech/app/projects/restless-snow-10784481/branches/br-cool-resonance-b4xb9f9g>

## Verification already run

- `npm.cmd exec tsc -- --noEmit` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed before commit.
- Production tenant login page rendered tenant-specific branding.
- Production tenant lookup and Auth config endpoints returned HTTP 200.
- Local platform token sign-in returned HTTP 200 after env-loader fix.
- Production token sign-in and real account-based sign-in remain unverified.

## Suggested next action

Start with the Vercel project environment settings: rotate/configure a strong
production `PLATFORM_ADMIN_TOKEN` and confirm the production database/Auth
variables are set. Then test `/admin` token access and one school's activation
and login flow. Do not change the UI or run production migrations during this
verification.

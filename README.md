# Relive

Relive is a production-oriented credit-score workflow prototype with a Next.js/Vinext frontend, Express API, shared Zod contracts, Prisma, and two logically separate PostgreSQL databases on Neon.

## Run locally

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: `http://127.0.0.1:5173`
- API health: `http://127.0.0.1:4100/health`
### Test logins (`OTP_PROVIDER=mock`, OTP `123456`)

`npm run db:seed` resets these every time it runs:

| Mobile | Case | Lands on |
|---|---|---|
| `9876543210` | Existing user, profile complete | Dashboard |
| `9876543211` | Existing user, details saved, no report yet | Fetch score (resumes onboarding) |
| `9876543212` | New user | Enter PAN (any valid PAN, e.g. `ABCDE1234F`) |

Any other valid mobile number also works as a new user. PAN `AAAAA0000A` simulates a failed PAN lookup. Three wrong OTPs lock the number for 15 minutes; re-seed to clear it.

## Login / signup journey

1. **Mobile (as linked to PAN) + one consent checkbox** covering terms/privacy and OTP, credit-bureau report fetch, and marketing ("Read more" expands the text). Stored per purpose (`LOGIN`, `CREDIT_REPORT`, `MARKETING`) with the consent version, IP and user agent, before the OTP is sent.
2. **OTP** send + verify. Resend after 10s (cancels the previous OTP); max 5 sends / 30 min; 3 wrong OTPs per user → 15-minute lockout and back to the mobile step.
3. **Existing user** (any saved report) → dashboard. Otherwise onboarding continues in the same dialog, resuming where the user left off:
   - **PAN** → PAN API fills the name (incl. middle name) and DOB → report is fetched immediately (no extra consent step).
   - PAN not found / PAN service off / 5 PAN tries per day → "Enter your name as on PAN". PAN already linked to another mobile → log in with that number.

## Referrals

The referral code is the referrer's mobile number, entered (optionally) under PAN or in the name-as-on-PAN form. A company agent's number earns the agent a benefit; any other Relive user's number is recorded without one. Unknown numbers and the user's own number are rejected; a user's first referral is kept. Each agent has a QR code that opens the login with their number filled in and locked.

**Staff (no terminal):** open `/admin/agents` on the website (e.g. `https://relive.co.in/admin/agents`) and enter the admin password. There you add an agent (name + mobile) or many at once from a CSV file (a name column and a mobile column; a template is on the page; bad rows are listed by row number and re-uploading is safe), download their QR code, see how many users each referred and how many of those came through their QR code, and deactivate or reactivate them. There is one shared password (8+ characters), stored readable in the database (`admin_password` table, `password` column; anyone with database access can see it), so it is the same for the live site and any local copy using the same database. Staff change it on the page (**Password**, top right); a developer sets the first one, or resets a forgotten one, with `npm run admin-password -w backend` (makes up a strong random password and prints it) or `npm run admin-password -w backend -- "<new password>"`. Changing it signs everyone else out. Sign-ins, wrong passwords and every change are written to the audit log.

**Developers** can do the same from the terminal:

```powershell
npm run agent -w backend -- add 9876500001 "Priya Nair"   # add an agent; writes their QR code to backend/exports/agent-qr/
npm run agent -w backend -- list                          # agents, users each referred, and how many via their QR code
npm run agent -w backend -- qr 9876500001                 # write the QR code again
npm run agent -w backend -- deactivate 9876500001         # their number stops counting as an agent's
```

QR codes link to `https://relive.co.in/?login=1&ref=<number>`; add `--site <url>` for another address. `npm run db:seed` adds a test agent, `9876500000`.

Referrals are stored in `referrals` with the referrer's number as `agent_mobile_hash` (plus last 4 and encrypted), `source` = `QR` or `MANUAL`, and `agent_user_id` when the referrer has a Relive account. Users signed up through each agent's QR code, straight from the database:

```sql
SELECT a.name, a.mobile_last4, a.active,
       count(r.id) FILTER (WHERE r.source = 'QR') AS users_via_qr,
       count(r.id) AS total_referrals
FROM agents a
LEFT JOIN referrals r ON r.agent_mobile_hash = a.mobile_hash AND r.created_at >= a.created_at  -- only since they became an agent
GROUP BY a.id
ORDER BY users_via_qr DESC, a.name;
```

## Audit trail

Every login and onboarding step is recorded in the audit database (`audit_logs` events plus one `onboarding_journeys` row per user). See [docs/login-onboarding-flow.md](docs/login-onboarding-flow.md). `npm run journey -w backend` lists unfinished onboardings; add a mobile number to see one user's timeline.

## Credit report (Experian → CRIF)

Right after the profile is known (consent was given at signup), the API calls IndiConnect **Bureau(A) V2 / Experian** with the profile name and mobile. If Experian fails for any reason (no record, error, timeout), it calls **Bureau C / CRIF**. Only when **both** answer "no record" → 422 `NO_CREDIT_RECORD` (UI: "Edit my name as on PAN" or "Use a different mobile number"); any outage or timeout → 503 `REPORT_UNAVAILABLE` (UI: "Try again"). Max 3 report attempts per user per 24h (`REPORT_ATTEMPT_LIMIT`). Bureau calls are billable, so they are never retried automatically, and a current report (30 days) is reused instead of pulling again. The full bureau payload is stored in `credit_reports.raw_response` and never sent to the browser. PAN is optional: bureaus match on name + mobile.

In mock mode, send `x-relive-mock-scenario: business_failure` to `/credit/report` to make Experian fail and exercise the CRIF fallback.

Each service switches independently in `backend/.env`: `OTP_PROVIDER`, `PAN_PROVIDER`, `BUREAU_PROVIDER` = `mock` | `indiconnect`, plus `INDICONNECT_*` credentials (see `.env.example`). With `PAN_PROVIDER=mock` and `BUREAU_PROVIDER=indiconnect`, the PAN step reports "not available" so users continue without PAN and enter their real name (a fake PAN identity must never reach a billed bureau pull). Production refuses to start with any mock provider or default secrets.

## Workspace

- `frontend/`: landing page, legal pages, secure login modal, workflow portal, and Experian dashboard.
- `backend/`: Express API, sessions, consent/OTP/KYC/report workflows, provider adapters, audit writer, and Prisma migrations.
- `shared/`: Zod request contracts and shared workflow types.

The backend loads Neon connection values from `frontend/.env.local`, which is generated by the Neon CLI and ignored by Git. `relive_audit` is derived from the same branch endpoint but is a separate PostgreSQL database. Override it with `AUDIT_DATABASE_URL_UNPOOLED` when needed.

## Provider mode

In mock mode OTP, PAN and Experian use `MOCK_*` adapters. Every adapter goes through the same timeout, controlled retry, business-failure, technical-failure, invalid-response, transaction-log, and recovery layer. The development-only `x-relive-mock-scenario` header can be `success`, `business_failure`, `technical_failure`, `timeout`, or `invalid_response`.

Manual profile details are stored as `MANUAL_UNVERIFIED`. Experian cannot run without successful KYC and a recorded credit-report authorization. A current saved report routes the member directly to the dashboard.

## Verification

```powershell
npm test
npm run build
npm audit --omit=dev
```

The end-to-end suite runs against the isolated Neon development branch and covers validation, consent, OTP failure/success, session protection, provider retry/recovery, NSDL profile, PAN/KYC, report authorization, idempotent Experian retrieval, dashboard isolation, logout, and the separate audit database.

# Relive API: cURL reference

Every request the app makes, ready to paste into a terminal (bash / Git Bash) or into Postman (**Import → Raw text → paste the cURL**).

- **Part 1:** the Relive backend's own API, in the order a user goes through signup.
- **Part 2:** the third-party calls the backend makes (IndiConnect, Cloudflare). Most of these are **billed**.

No real keys are in this file. Values like `{{serviceKey}}` are Postman variables; set them in a Postman environment (see below) or replace them by hand.

---

## Postman environment

| Variable | Value |
|---|---|
| `baseUrl` | `http://127.0.0.1:4100/api/v1` (local backend) |
| `transactionId` | filled in by the script on **Request OTP** |
| `sessionToken` | filled in by the script on **Verify OTP** |
| `indiconnectUrl` | `https://api.ccs.indiconnect.in` (live) |
| `serviceKey` | `sk_live_…` (IndiConnect → Configuration → Service Keys → BizStack) |
| `indcSecretKey` | `indc_live_…` (IndiConnect → API keys → Secret Key) |
| `acAccessKey` | `ac_live_…` (IndiConnect → API keys → Access Key) |
| `providerCode` | IndiConnect → Provider Codes → BizStack → Verification Service V4 |
| `indiconnectAppId` | `verification_v1` |
| `turnstileSecret` | Cloudflare Turnstile secret key |

The real values live in `backend/.env`. Mark the key variables as **secret** in Postman, and don't share the environment.

---

## Part 1: Relive backend

### How login works
1. **Request OTP** returns a `transactionId`.
2. **Verify OTP** sets a `relive_session` cookie (httpOnly, valid 8 hours).
3. Every other `/api/v1/*` call needs that cookie. The cURLs below send it as `Cookie: relive_session={{sessionToken}}`. Postman also keeps cookies automatically per domain, so after Verify OTP you can delete that header if you prefer.

### Rules that apply to every call
- **Errors** always look like this:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Enter a valid PAN", "retryable": false } }
  ```
- **Rate limits** (per IP, per 10 minutes): 20 requests on the OTP/login endpoints, 30 on the other sensitive endpoints. Over the limit you get `429`.
- **Mock providers.** When a provider is set to `mock` in `backend/.env`, you can force an outcome with the header `x-relive-mock-scenario`. Values: `success` (default), `business_failure`, `technical_failure`, `timeout`, `invalid_response`, `no_record`. The header is ignored for live (`indiconnect`) providers.

### Health check
No login needed. Shows whether both databases are reachable, and which providers are mock or live.
It sits outside `/api/v1`:
```bash
curl --location 'http://127.0.0.1:4100/health'
```
Response: `{ "status": "ok", "services": {…}, "providers": { "otp": "mock", "pan": "indiconnect", "bureau": "indiconnect" } }`

### 1. Request OTP
Starts login or signup. New numbers are allowed.
```bash
curl --location '{{baseUrl}}/auth/request-otp' \
--header 'Content-Type: application/json' \
--data '{
  "mobile": "9876543210",
  "consent": true,
  "consentVersion": "relive-consent-v2",
  "turnstileToken": "XXXX.DUMMY.TOKEN.XXXX"
}'
```
- **Response `201`:** `{ "transactionId": "…uuid…", "mobileLast4": "3210", "expiresInSeconds": 300, "resendAfterSeconds": 10, "devOtp": "123456" }`. `devOtp` only appears with the mock OTP provider, outside production.
- **Resend** is the same call again, once `resendAfterSeconds` has passed.
- **Captcha:** when `TURNSTILE_SECRET_KEY` is set in `backend/.env`, `turnstileToken` must be a real Cloudflare token, which Postman can't produce. For local Postman testing, set `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (Cloudflare's "always passes" test secret) and send the dummy token above. Put the real secret back afterwards. In production, the real secret rejects the dummy token.

Postman **Scripts → Post-response**:
```js
pm.environment.set("transactionId", pm.response.json().transactionId);
```

### 2. Verify OTP
Logs the user in and sets the `relive_session` cookie.
```bash
curl --location '{{baseUrl}}/auth/verify-otp' \
--header 'Content-Type: application/json' \
--data '{
  "transactionId": "{{transactionId}}",
  "otp": "123456"
}'
```
- **Response `200`:** the workflow (see step 4), e.g. `{ "stage": "PROFILE", "mobileLast4": "3210", … }`. `stage` tells you what's next: `PROFILE` (PAN or details) → `REPORT` (fetch the credit report) → `DASHBOARD` (done).
- **Common errors:** `INVALID_OTP`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` (3 wrong tries locks the number).

Postman **Scripts → Post-response**:
```js
pm.environment.set("sessionToken", pm.cookies.get("relive_session"));
```

### 3. Session check
Is this cookie still logged in? Never fails: returns `{ "authenticated": false }` when not.
```bash
curl --location '{{baseUrl}}/auth/session' \
--header 'Cookie: relive_session={{sessionToken}}'
```
Response: `{ "authenticated": true, "stage": "REPORT", "expiresAt": "2026-11-16T20:00:00.000Z" }`

### 4. Workflow (where the user is in signup)
```bash
curl --location '{{baseUrl}}/workflow' \
--header 'Cookie: relive_session={{sessionToken}}'
```
Response: `{ "stage": "PROFILE" | "REPORT" | "DASHBOARD", "mobileLast4": "3210", "profile": { "firstName": "…", "lastName": "…", "email": "", "dateOfBirth": "1992-06-14", "source": "PAN_VERIFIED", "verified": true } | null, "kycStatus": "…", "reportStatus": "…" }`

### 5a. Verify PAN (live PAN check, **billed**)
Fetches the name and date of birth from the PAN and saves them as the profile. With `PAN_PROVIDER=indiconnect`, this calls IndiConnect PAN Premium (Part 2).
```bash
curl --location '{{baseUrl}}/kyc/verify' \
--header 'Content-Type: application/json' \
--header 'Cookie: relive_session={{sessionToken}}' \
--data '{ "pan": "ABCDE1234F" }'
```
- **Response `200`:** the workflow, now with `stage: "REPORT"` and the PAN profile.
- **Common errors:**
  - `PAN_NOT_VERIFIED` (`422`): PAN not found.
  - `PAN_ALREADY_LINKED`: this PAN belongs to another account.
  - `PAN_MOBILE_MISMATCH`: the PAN's record has a different mobile.
  - `PAN_ATTEMPT_LIMIT`: too many PAN tries.

### 5b. Enter details without PAN
The alternative to 5a: the user types their name and date of birth exactly as on their PAN.
```bash
curl --location '{{baseUrl}}/profile/manual' \
--header 'Content-Type: application/json' \
--header 'Cookie: relive_session={{sessionToken}}' \
--data '{
  "firstName": "Aarav",
  "lastName": "Sharma",
  "email": "aarav@example.com",
  "dateOfBirth": "1992-06-14"
}'
```
`lastName` and `email` may be `""`. Response `200`: the workflow with `stage: "REPORT"`.

### 6. Fetch the credit report (live bureau pull, **billed**)
Tries Experian first and falls back to CRIF. Use a **new** `idempotencyKey` (any UUID) for each real attempt; repeating the same key returns the earlier result instead of pulling again. A limit of 3 bureau attempts per user per 24 hours guards the bill.
```bash
curl --location '{{baseUrl}}/credit/report' \
--header 'Content-Type: application/json' \
--header 'Cookie: relive_session={{sessionToken}}' \
--data '{ "idempotencyKey": "{{$guid}}" }'
```
(`{{$guid}}` makes Postman generate a fresh UUID. In a terminal, use the output of `uuidgen`.)
- **Response `200`:** the workflow with `stage: "DASHBOARD"`.
- **Common errors:**
  - `NO_CREDIT_RECORD` (`422`): neither bureau has a record for this number. Go to step 7 or 8.
  - `REPORT_ATTEMPT_LIMIT` (`429`): the daily limit was reached.

### 7. No record on the login number: try another mobile
Bureaus may have a different number on file. Verify it with an OTP, then run step 6 again with a new `idempotencyKey`; the report pull then uses that number.

Send the OTP:
```bash
curl --location '{{baseUrl}}/credit/bureau-mobile/request-otp' \
--header 'Content-Type: application/json' \
--header 'Cookie: relive_session={{sessionToken}}' \
--data '{ "mobile": "9123456780" }'
```
Response `201`: same shape as step 1 (`transactionId`, `devOtp` with the mock provider).

Verify it. This only saves the number; nothing is pulled yet:
```bash
curl --location '{{baseUrl}}/credit/bureau-mobile/verify' \
--header 'Content-Type: application/json' \
--header 'Cookie: relive_session={{sessionToken}}' \
--data '{
  "transactionId": "{{transactionId}}",
  "otp": "123456"
}'
```
Response `200`: the workflow. Then repeat step 6 (**billed**).

### 8. Confirm "no credit history"
Only allowed right after **both** Experian and CRIF said "no record" in the last 24 hours (not after an outage). It moves the user to the dashboard as new to credit.
```bash
curl --location --request POST '{{baseUrl}}/credit/no-history' \
--header 'Cookie: relive_session={{sessionToken}}'
```
- **Response `200`:** the workflow.
- **Error:** `NO_RECORD_UNCONFIRMED` (`409`) if the bureaus haven't both said "no record".

### 9. Credit overview (dashboard data)
Score, score band, summary, accounts, payment history and recommendations.
```bash
curl --location '{{baseUrl}}/credit/overview' \
--header 'Cookie: relive_session={{sessionToken}}'
```
`/dashboard` returns the same data, but answers `404 REPORT_NOT_FOUND` when there's no current report:
```bash
curl --location '{{baseUrl}}/dashboard' \
--header 'Cookie: relive_session={{sessionToken}}'
```

### 10. Official bureau report (PDF link)
```bash
curl --location '{{baseUrl}}/credit/report-pdf' \
--header 'Cookie: relive_session={{sessionToken}}'
```
Response: `{ "url": "https://…" }`, the bureau's own PDF link.

### 11. "Get help" request (creates a lead)
Saves a lead and emails it to `LEADS_EMAIL` (relive@cgreen.in), when `SMTP_URL` is set.
```bash
curl --location '{{baseUrl}}/support-requests' \
--header 'Content-Type: application/json' \
--header 'Cookie: relive_session={{sessionToken}}' \
--data '{
  "topic": "LENDER_DISCUSSION",
  "account": "Demo Finance · •••• 1190",
  "question": "I need help understanding Demo Finance, account ending 1190.",
  "preferredTime": "Morning",
  "preferredLanguage": "Hindi"
}'
```
- **Allowed values:**
  - `topic`: `OPTIONS` | `LENDER_DISCUSSION` | `NOTICE`
  - `account`: any text up to 120 characters, or `null` for the overall situation
  - `preferredTime`: `Morning` | `Afternoon` | `Evening` | `No preference`
  - `preferredLanguage`: `English` | `Hindi` | `Marathi` | `Other`
- **Response `201`:** `{ "id": "…uuid…" }`

### 12. Log out
Always succeeds, and clears the cookie.
```bash
curl --location --request POST '{{baseUrl}}/auth/logout' \
--header 'Cookie: relive_session={{sessionToken}}'
```
Response: `204 No Content`.

---

## Part 2: third-party calls the backend makes

You don't need these to use the app. They're for checking a provider directly, e.g. when something fails and you want to see the provider's raw answer.

- **IndiConnect (all five calls):** each goes to the same GraphQL address, with the same five headers. Only the `documentType` changes.
- **Billing:** OTP sends, PAN checks and bureau pulls are **billed** when they succeed. A call refused with "Pricing is unavailable for this document type" isn't billed; it means that product isn't enabled on the account.

### IndiConnect: send OTP (billed, sends a real SMS)
Used only when `OTP_PROVIDER=indiconnect`.
```bash
curl --location '{{indiconnectUrl}}/idverifygr/verification' \
--header 'Content-Type: application/json' \
--header 'service-key: {{serviceKey}}' \
--header 'Authorization: x-api-access {{indcSecretKey}}:{{acAccessKey}}' \
--header 'myAppId: {{indiconnectAppId}}' \
--header 'providercode: {{providerCode}}' \
--data '{
  "query": "mutation SendOtp($input: VerifyInput!) { verify(input: $input) { ok message result { ... on MobileVerificationWithOtp { requestId message } } error { status message decryptedError } } }",
  "variables": { "input": { "documentType": "Mobile Verification With Otp", "mobileNumber": "9876543210" } }
}'
```
Response: `data.verify.result.requestId`. Keep it for the next call.

### IndiConnect: verify OTP
```bash
curl --location '{{indiconnectUrl}}/idverifygr/verification' \
--header 'Content-Type: application/json' \
--header 'service-key: {{serviceKey}}' \
--header 'Authorization: x-api-access {{indcSecretKey}}:{{acAccessKey}}' \
--header 'myAppId: {{indiconnectAppId}}' \
--header 'providercode: {{providerCode}}' \
--data '{
  "query": "mutation VerifyOtp($input: VerifyInput!) { verify(input: $input) { ok message result { ... on MobileVerificationWithStatus { provider otpValidate } } error { status message decryptedError } } }",
  "variables": { "input": { "documentType": "mobile verification with status", "requestId": "REQUEST_ID_FROM_SEND", "otp": "123456" } }
}'
```

### IndiConnect: PAN Verification Premium (billed)
This is the call behind step 5a. Docs: developer.indiconnect.in/44970429e0
```bash
curl --location '{{indiconnectUrl}}/idverifygr/verification' \
--header 'Content-Type: application/json' \
--header 'service-key: {{serviceKey}}' \
--header 'Authorization: x-api-access {{indcSecretKey}}:{{acAccessKey}}' \
--header 'myAppId: {{indiconnectAppId}}' \
--header 'providercode: {{providerCode}}' \
--data '{
  "query": "mutation VerifyPanPremium($input: VerifyInput!) { verify(input: $input) { ok message status result { ... on BTPanPremiumResult { txn_id status message billable pan_number full_name full_name_split dob gender email phone_number masked_aadhaar } } error { status message } } }",
  "variables": { "input": { "documentType": "verify-pan-premium", "pan": "ABCDE1234F" } }
}'
```
- **Success:** `data.verify.ok: true` and `result.status: 1`, with `full_name`, `full_name_split`, and `dob` (`YYYY-MM-DD`).
- **What the app uses:** the name parts and date of birth. Of the phone number, only the last 4 digits are kept.

### IndiConnect: Experian credit report (billed)
The first bureau tried in step 6.
- **Fields:** `name` (full name) and `mobile` are required. `pan` and `dob` (`YYYY-MM-DD`) are sent when the user verified their PAN.
- **No record:** the response is `ok: false`.
```bash
curl --location '{{indiconnectUrl}}/idverifygr/verification' \
--header 'Content-Type: application/json' \
--header 'service-key: {{serviceKey}}' \
--header 'Authorization: x-api-access {{indcSecretKey}}:{{acAccessKey}}' \
--header 'myAppId: {{indiconnectAppId}}' \
--header 'providercode: {{providerCode}}' \
--data '{
  "query": "mutation VerifyBureauA($input: VerifyInput!) { verify(input: $input) { ok message status result { ... on BTBureauAResult { txn_id api_category api_name billable message status datetime inprofileResponse experian_report_link } } error { status message } } }",
  "variables": { "input": { "documentType": "bureau-verification-v2-experian", "name": "Aarav Sharma", "mobile": "9876543210", "pan": "ABCDE1234F", "dob": "1992-06-14" } }
}'
```

### IndiConnect: CRIF credit report (billed)
The fallback when Experian has no record or is down. Same fields as Experian.
```bash
curl --location '{{indiconnectUrl}}/idverifygr/verification' \
--header 'Content-Type: application/json' \
--header 'service-key: {{serviceKey}}' \
--header 'Authorization: x-api-access {{indcSecretKey}}:{{acAccessKey}}' \
--header 'myAppId: {{indiconnectAppId}}' \
--header 'providercode: {{providerCode}}' \
--data '{
  "query": "mutation VerifyBureauC($input: VerifyInput!) { verify(input: $input) { ok message status result { ... on BTBureauCResult { txn_id api_category api_name billable message status datetime bureauData credit_report_link } } error { status message } } }",
  "variables": { "input": { "documentType": "bureau-verification-crif", "name": "Aarav Sharma", "mobile": "9876543210", "pan": "ABCDE1234F", "dob": "1992-06-14" } }
}'
```

### Cloudflare Turnstile: check a captcha token
What the backend does on step 1 before sending an OTP. Not billed.
```bash
curl --location 'https://challenges.cloudflare.com/turnstile/v0/siteverify' \
--data-urlencode 'secret={{turnstileSecret}}' \
--data-urlencode 'response=TOKEN_FROM_THE_BROWSER'
```
- **Valid token:** `{ "success": true, … }`.
- **Wrong or used token:** `"error-codes": ["invalid-input-response"]`. Each token works only once.
- **Wrong secret:** `"error-codes": ["invalid-input-secret"]`.

### Lead emails (Zoho SMTP)
These aren't HTTP, so there's no cURL. The backend sends them over SMTP (`SMTP_URL` in `backend/.env`, `smtp.zoho.in:465`). To test, submit step 11 and check the relive@cgreen.in inbox. A failed send is logged in the audit log as `SUPPORT_EMAIL_FAILED`.

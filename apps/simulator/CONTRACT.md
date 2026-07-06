# Portal Simulator Contract

The simulator replicates Tanzanian government portals' screen sequences and
field names so the SAME flow code drives sandbox and live modes. Flow modules
in `packages/flows` and this app must both conform to this contract exactly.

Server: Express + EJS, listens on `PORT` (default **4100**). State in SQLite at
`apps/simulator/data/sim.sqlite` (auto-created). All forms are classic
server-rendered POSTs (no client JS except where noted). Every page has the
portal name in `<title>` and a `<main>` landmark.

## Test/ops endpoints (JSON, no auth)

- `POST /_sim/reset` — wipe all state
- `GET /_sim/config` / `POST /_sim/config` — JSON config:
  `{ approvalDelayMs: number (default 8000), latencyMs: 0, failureRate: 0 }`
  `approvalDelayMs` controls how long BRELA/TRA "review" takes after payment.
- `GET /_sim/messages?to=<email-or-phone>` — virtual inbox/SMS: JSON array
  `[{ id, to, channel: "email"|"sms", subject, body, sentAt }]` newest first.
  OTPs and activation links are delivered here.
- `POST /_sim/gepg/pay/:controlNumber` — body `{ method: "mpesa" }` — marks a
  GePG bill paid (simulates the customer paying on their phone). Returns
  `{ status: "paid", receiptNo }`.
- `GET /_sim/gepg/bills/:controlNumber` — JSON bill status:
  `{ controlNumber, amountTzs, payee, description, status: "pending"|"paid", receiptNo? }`

## BRELA ORS (`/brela-ors`)

### Account
- `GET /brela-ors/` — landing. Links: `a#login-link`, `a#register-link`.
- `GET /brela-ors/register` — form `form#register-form` method POST action `/brela-ors/register`:
  - `input[name=nin]` (20 digits)
  - `button#load-nida` (submits `nin` to `POST /brela-ors/nida-lookup` — returns page with `input[name=fullName]` prefilled readonly; simulator accepts any 20-digit NIN and derives a name deterministically from it; NINs starting `9` return "NIN not found" error `.error-banner`)
  - `input[name=fullName]` (readonly after NIDA load)
  - `input[name=email]`, `input[name=phone]`, `input[name=password]`
  - CAPTCHA: `label#captcha-question` text like `What is 3 + 4?`; answer in `input[name=captcha]`; wrong answer re-renders with `.error-banner`.
  - Submit → sends activation email (virtual inbox) containing link
    `/brela-ors/activate?token=...` and renders `.notice` "Check your email".
- `GET /brela-ors/activate?token=` — activates; page contains `.notice#activated`.
- `GET /brela-ors/login` — `form#login-form`: `input[name=email]`, `input[name=password]` → session cookie. Bad creds: `.error-banner`.
- Logged-in pages show `nav .user-email`.

### Name search & reservation
- `GET /brela-ors/name-search?q=<name>` — public. Result block `#search-result`
  with `data-status="available"|"taken"`. Names containing existing reserved or
  registered names (case-insensitive) are taken; also seeded taken names:
  "SAFARI TRADERS LIMITED", "KILIMANJARO HOLDINGS LIMITED".
- `GET /brela-ors/name-reservation` (auth) — `form#reservation-form` POST:
  - `input[name=proposedName]`, `select[name=entityType]` (option `private_company`),
    `textarea[name=natureOfBusiness]`
  - Submit → creates reservation `RSV-<n>`, issues GePG bill
    (amount 50000, payee BRELA, description "Name reservation <name>").
    Redirects to `/brela-ors/reservations/:id`.
- `GET /brela-ors/reservations/:id` — status page:
  - `#reservation-status` `data-status="pending_payment"|"processing"|"reserved"|"rejected"`
  - shows `#control-number` text (the GePG control number) while pending payment
  - once paid, status flips to `processing`, and after `approvalDelayMs` to `reserved`;
    then shows `#reservation-number` text `RSV-...` and a link
    `a#reservation-certificate` to a PDF.

### Incorporation
- `GET /brela-ors/incorporation` (auth) — `form#incorporation-form` POST, multipart:
  - `input[name=reservationNumber]` (must be a `reserved` RSV number)
  - `input[name=shareCapital]`, `input[name=totalShares]`
  - `input[name=physicalAddress]`, `input[name=region]`, `input[name=district]`
  - Directors: repeated groups `director_fullName[]`, `director_nin[]`, `director_tin[]`
  - TIN check: `POST /brela-ors/verify-tin` body `{tin, nin}` → JSON `{valid: boolean, name?}`.
    Simulator: TINs starting `999` are invalid; anything else valid.
  - Shareholders: `shareholder_fullName[]`, `shareholder_nin[]`, `shareholder_shares[]`
  - Files: `input[type=file][name=memarts]` (PDF), `input[type=file][name=declaration]` (PDF)
  - `input[type=checkbox][name=declarationConfirmed]`
  - Submit → application `APP-<n>`, GePG bill (amount 250000, payee BRELA,
    description "Company registration <name>"). Redirect `/brela-ors/applications/:id`.
- `GET /brela-ors/applications/:id` — status page:
  - `#application-status` `data-status="pending_payment"|"under_review"|"approved"|"queried"`
  - `#control-number` while pending payment
  - when `approved`: `#incorporation-number` text like `123456789`,
    `#incorporation-date` (ISO), link `a#certificate-download` →
    `GET /brela-ors/applications/:id/certificate.pdf` (a real generated PDF).

## TRA Taxpayer Portal (`/tra`)

- `GET /tra/` — landing, `a#register-link`, `a#login-link`.
- `GET /tra/register` — `form#tra-register-form`: `input[name=email]`,
  `input[name=phone]`, `input[name=password]` → sends 6-digit OTP to email
  (virtual inbox, subject "TRA verification code"); renders OTP page
  `form#otp-form` with `input[name=otp]` (posts to `/tra/verify-otp`).
  Wrong OTP: `.error-banner`. OTP expires after 15 min.
- `GET /tra/login` — `form#login-form`: `input[name=email]`, `input[name=password]`.
- `GET /tra/tin/company` (auth) — `form#company-tin-form`:
  - `input[name=incorporationNumber]`, `input[name=companyName]`,
    `input[name=physicalAddress]`, `input[name=region]`,
    `select[name=businessSector]` (ISIC-ish options incl. `6201`),
    director rep: `input[name=repFullName]`, `input[name=repNin]`, `input[name=repTin]`
  - Submit → TIN application `TINAPP-<n>`; page `/tra/tin/applications/:id` with
    `#tin-status` `data-status="submitted"|"biometrics_pending"|"issued"`:
    immediately `biometrics_pending` with `#appointment-ref` text `BIO-<n>` and
    `#appointment-location` "TRA Ilala Tax Region Office".
  - `POST /_sim/tra/biometrics/:appointmentRef` marks biometrics done → after
    `approvalDelayMs` status `issued`, shows `#company-tin` text `4xx-xxx-xxx`
    and `a#tin-certificate` PDF link.
- `GET /tra/vat/apply` (auth) — `form#vat-form`: `input[name=tin]`,
  `input[name=expectedTurnover]`, `textarea[name=businessDescription]` →
  `/tra/vat/applications/:id`, `#vat-status`
  `data-status="submitted"|"verification_pending"|"registered"`;
  `POST /_sim/tra/vat-verify/:id` completes the physical verification →
  `registered` with `#vrn` text.

## TNBP (`/tnbp`) — business licence Class A

- `GET /tnbp/licence/apply` (no auth for sim) — `form#licence-form`:
  `input[name=tin]`, `input[name=incorporationNumber]`,
  `input[name=businessName]`, `select[name=activityCode]`,
  `input[name=premisesAddress]`, `input[type=file][name=leaseAgreement]`,
  `input[type=file][name=tinCertificate]` → licence application `LIC-<n>`,
  GePG bill (amount by activity: default 150000, payee MIT). Status page
  `/tnbp/licence/applications/:id` with `#licence-status`
  `data-status="pending_payment"|"processing"|"issued"`, then `#licence-number`
  and `a#licence-certificate` PDF.

## TAUSI (`/tausi`) — business licence Class B
Same shape as TNBP under `/tausi/licence/...`, payee LGA, amount 80000.

## NSSF (`/nssf`)

- `GET /nssf/employer/register` — `form#nssf-form`: `input[name=tin]`,
  `input[name=companyName]`, `input[name=incorporationNumber]`,
  `input[name=employeeCount]`, `input[name=contactEmail]` →
  `/nssf/employer/applications/:id`, `#nssf-status`
  `data-status="processing"|"registered"` (auto after approvalDelayMs);
  when registered shows `#nssf-number` and `a#nssf-certificate`.

## WCF (`/wcf`) — same shape: `form#wcf-form`, `#wcf-status`, `#wcf-number`, `a#wcf-certificate`.

## OSHA WIMS (`/osha`)

- `GET /osha/workplace/register` — `form#osha-form`: `input[name=tin]`,
  `input[name=companyName]`, `input[name=workplaceAddress]`,
  `input[name=employeeCount]`, `select[name=riskCategory]` (low/medium/high) →
  `/osha/workplace/applications/:id`, `#osha-status`
  `data-status="inspection_pending"|"registered"` with `#inspection-ref`;
  `POST /_sim/osha/inspect/:ref` completes inspection → `registered`,
  `#osha-number`, `a#osha-certificate`.

## GePG pages (`/gepg`)

- `GET /gepg/bill/:controlNumber` — human-readable bill page with
  `#bill-status` `data-status="pending"|"paid"`, `#bill-amount`, `#bill-payee`.

## PDF generation
Certificates are simple generated PDFs (use `pdfkit`): portal header, entity
name, number, date, QR-ish box with the number. Content correctness matters
less than being real downloadable PDFs.

## Behavior rules
- All bills auto-flip their linked application from `pending_payment` to the
  next status when paid via `/_sim/gepg/pay/:controlNumber`.
- `approvalDelayMs` applies wherever a status advances "after review".
- `latencyMs` delays every response; `failureRate` (0-1) makes random requests
  return HTTP 500 (for retry testing).
- Session auth via signed cookie (`cookie-session`), secret "sim".

# tz-compliance

Start a Tanzanian company, then never think about compliance.

An agentic-AI platform that automates business registration and continuous
compliance in Tanzania — from BRELA name reservation through incorporation,
TIN, licences, employer registrations, bank pack and company stamp, then the
ongoing compliance calendar. Government portals have no public APIs, so the
automation layer drives them with Playwright + AI (sandboxed against a local
portal simulator until real credentials are configured).

## What's inside

```
apps/
  web/         Next.js 15 app — AI onboarding wizard, signing rooms, dashboard
  worker/      pipeline runner + compliance scheduler (sandbox filing engine)
  simulator/   high-fidelity replicas of BRELA ORS, TRA, GePG & co. for sandbox mode
packages/
  shared/      pipeline step graph, compliance rules catalog, NIDA/TIN sandbox lookups
  db/          Drizzle schema + migrations (Postgres)
  engine/      durable step-graph orchestrator (signals, retries, audit)
  agent-core/  browser sessions, artifact capture, credential vault, AI layer
  flows/       per-portal automation flows (brela-ors, tra, nssf, …)
```

## Run it locally

Prerequisites: **Node 22+**, **pnpm 9+** (`corepack enable`), and Postgres 16
(via Docker below, or your own).

Run each command on its own — don't paste comment text into the shell.

```bash
git clone https://github.com/erickjohn24/eac-frontend.git tz-compliance
cd tz-compliance
git checkout claude/tanzania-business-registration-app-e4rwl7
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm --filter @tz/web dev
```

No Docker? Use `./scripts/dev-db.sh` (Linux, uses sudo), or point
`DATABASE_URL` in `.env` at any Postgres 16 with a `tz_compliance` database.

Open **http://localhost:3000** — the landing page, the AI onboarding wizard
(`/onboarding`), signing rooms, and the company dashboard all work out of the
box. Registered companies, generated PDFs (Memarts, declarations, share
subscriptions) and signing links are real and persisted locally.

Optional extras:

```bash
# AI-powered understanding (otherwise a solid heuristic fallback is used)
echo 'ANTHROPIC_API_KEY=sk-ant-…' >> apps/web/.env.local

# The portal simulator (live BRELA name search + sandbox filing target)
pnpm --filter @tz/simulator dev        # http://localhost:4100

# The automation worker (drives the simulator portals for launched pipelines)
DATABASE_URL=postgres://tz:tz@localhost:5432/tz_compliance \
  pnpm --filter @tz/worker dev
```

Defaults are baked in (`postgres://tz:tz@localhost:5432/tz_compliance`,
storage in `./storage`), so no `.env` is needed for the standard setup; see
`.env.example` for every knob.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @tz/web dev` | web app on :3000 |
| `pnpm db:migrate` / `pnpm db:reset` | apply / reset database schema |
| `pnpm --filter @tz/web build` | production build |
| `pnpm typecheck` | typecheck all packages |
| `pnpm demo` | end-to-end sandbox pipeline demo (needs simulator + worker deps) |

## Notes

- **Sandbox vs live:** `AUTOMATION_MODE=sandbox` (default) points every portal
  flow at the local simulator. Live mode drives the real portals and requires
  real credentials — do not enable it without reviewing the legal notes.
- We're not a law firm, and nothing here is legal advice. Filings follow BRELA
  and TRA requirements as researched; verify current fee schedules and rules
  before relying on them.

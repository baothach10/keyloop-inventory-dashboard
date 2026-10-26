# Intelligent Inventory Dashboard

Keyloop technical assessment, **Scenario B (Supply)**. A dealership manager sees live vehicle stock, aging stock (> 90 days) is flagged automatically, and the manager can log and persist a status or proposed action for each aging vehicle.

**Both layers are implemented**: a Fastify + Prisma REST API with a persistent SQLite database, and a React dashboard.

- Design document: [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) (architecture diagram, components, data flow, tech choices, observability, GenAI usage)
- Interactive API docs (when running): http://localhost:3001/docs

## Features

| Requirement | Where |
|---|---|
| Filterable inventory list (make, model, age, search; sort; pagination) | `GET /api/dealerships/:id/vehicles` · Filters bar + table |
| Automatic aging-stock identification (> 90 days) | Derived on every read. Red KPI card, red age buckets, red rows and badges, "Aging stock only" toggle |
| Log and persist an action per aging vehicle | `POST /api/vehicles/:id/actions` · "Manage" side panel with history |

## Quick start

Requires **Node 20+** and npm. No database server needed (SQLite file).

```bash
npm run setup     # installs deps, creates the SQLite DB, seeds 250 vehicles across 2 dealerships
npm run dev       # API on :3001, web on :5173
```

Open http://localhost:5173.

If port 3001 is taken, run the API on another port and point the web proxy at it:

```bash
PORT=3002 npm run dev -w @inventory/api
API_URL=http://localhost:3002 npm run dev -w @inventory/web
```

### Test, typecheck, build

```bash
npm test          # 57 tests: shared (15) + api (22) + web (20)
npm run typecheck
npm run build     # typechecks the API, builds the web bundle
```

Tests use a separate SQLite file (`apps/api/prisma/test.db`) and a frozen clock, so they never touch dev data and do not depend on today's date.

### Reset the demo data

```bash
npm run db:seed -w @inventory/api
```

## Repository layout

```
apps/api         Fastify API, Prisma schema + seed, service layer, tests
apps/web         React + Vite + Tailwind dashboard, component tests
packages/shared  Aging rule (90 days) + Zod contract used by both apps
docs/            System design document
```

## API examples (cURL)

```bash
B=http://localhost:3001

# Dealerships
curl -s $B/api/dealerships

# KPIs: totals, aging count/value, age buckets, filter options
curl -s $B/api/dealerships/dealer-london/inventory/summary

# Aging Ford stock, oldest first, 10 per page
curl -s "$B/api/dealerships/dealer-london/vehicles?make=Ford&aging=true&pageSize=10"

# Age range 30-60 days, search by VIN fragment
curl -s "$B/api/dealerships/dealer-london/vehicles?minAge=30&maxAge=60&q=WVW"

# Log an action on an aging vehicle (use an id from the list above)
curl -s -X POST $B/api/vehicles/<VEHICLE_ID>/actions \
  -H 'content-type: application/json' \
  -d '{"actionType":"PRICE_REDUCTION_PLANNED","note":"Drop 5% at month end","createdBy":"alex"}'
# Same call on a vehicle <= 90 days old returns 422 RULE_VIOLATION
```

| Endpoint | Purpose |
|---|---|
| `GET /api/dealerships` | List dealerships |
| `GET /api/dealerships/:id/vehicles` | Filter: `make`, `model`, `q`, `minAge`, `maxAge`, `aging`. Sort: `sort`, `order`. Paging: `page`, `pageSize` (max 100) |
| `GET /api/dealerships/:id/inventory/summary` | KPIs, age buckets, make/model options |
| `GET /api/vehicles/:id` | Vehicle with full action history |
| `POST /api/vehicles/:id/actions` | Log an action (aging vehicles only, else 422) |
| `GET /health`, `/ready`, `/metrics`, `/docs` | Liveness, readiness (checks DB), Prometheus metrics, OpenAPI UI |

Action types: `PRICE_REDUCTION_PLANNED`, `PRICE_REDUCED`, `MARKETING_PUSH`, `TRANSFER_PLANNED`, `AUCTION_PLANNED`, `HOLD`, `SOLD`.

## Key decisions and assumptions

- **Aging = strictly more than 90 days** (90 is not aging, 91 is), counted in whole UTC days.
- **Age is derived, never stored.** Age filters become an indexed range on `stockedAt`, so the data is always correct and no nightly job is needed.
- **The aging rule is enforced server-side** (422), not only hidden in the UI.
- **Actions are append-only history**; the newest is the current status.
- "Real-time" = refetch on focus + 30 s polling. No auth (single trusted manager). See the design doc for the full list of assumptions and known limitations.

## Troubleshooting

- **Tests fail with `require() of ES Module ... cookie`**: `light-my-request` is pinned to 6.6.0 via the root `overrides` for Node 20.11 compatibility. If you removed it, restore it or use Node >= 20.19.
- **UI says "Could not load data"**: the API is not reachable. Check it is running and that `API_URL` matches its port.

## AI Collaboration Narrative

> **Author's note:** this section describes what actually happened in the build session (Claude Code directed by me). Edit it so it reflects your own involvement before submitting.

**Strategy for guiding the AI.**
I did not ask for "the app". I started from the brief and had the AI turn it into a written plan *before any code*: the three testable requirements, the ambiguities, a stack and the trade-offs. I approved that plan, and the AI then worked in small, committed phases: scaffold, shared contract and business rule, API, frontend, then docs. The business rule (aging = more than 90 days) was put in one shared package first, with tests, so everything else was built on a verified foundation. I made the key calls: fullstack in TypeScript, and "age is derived, not stored".

**How I verified and refined the output.**
- **Tests first on the rules that matter**: the 90/91-day boundary, filters, the 422 rule, append-only history, and per-dealership isolation, all with a frozen clock.
- **I did not trust "all green"**: I ran a mutation check, deliberately breaking the core rule (threshold 90 to 100, and `>` to `>=`). The suites failed as they should (6 and 3 failing tests respectively), proving the tests detect the exact bugs that would matter. The code was then restored.
- **Ran it for real, not just tests**: smoke-tested the API with cURL, then drove the UI in a browser (filter by make, aging only, open a vehicle, log an action) and confirmed the row status and KPI changed *and* the row existed in SQLite.
- **Typecheck and a strict TypeScript config** across all three packages.

**Where the AI was wrong, and how it was caught** (real events from this build):
1. *Dependency/runtime mismatch.* All 22 API tests failed at first: the newest `light-my-request` pulls an ESM-only `cookie`, which Node 20.11 cannot `require()`. Two plausible fixes failed (a nested override, then a direct dependency) before pinning `light-my-request` to 6.6.0. The reason is documented next to the override.
2. *Two bugs in the AI's own tests.* A numeric `.sort()` that sorted as strings (`200` before `91`), and a Prometheus counter assertion that ignored counters are cumulative across tests. In both cases the code was right and the test was wrong; I fixed the tests rather than loosening them.
3. *Environment collision.* Port 3001 was already used by an unrelated project. The AI did not kill the process; it made the Vite proxy target configurable (`API_URL`) and ran on another port.
4. *Overstated narrative.* An earlier draft of the design doc's GenAI section described human actions that had not happened. It was corrected so the documentation matches reality.
5. *Security hygiene.* `npm audit` flagged advisories. Non-breaking fixes were applied where available; the remaining ones need major upgrades and are listed honestly in the design doc rather than force-upgraded blindly.

**How I ensured final quality.**
57 automated tests (shared 15, API 22, web 20), a clean typecheck, a manual end-to-end browser check, small reviewable commits per phase, and a design doc that lists what the system does *not* do (no auth, polling not push, tracing only designed). I can explain every part of the code, including the trade-offs above.

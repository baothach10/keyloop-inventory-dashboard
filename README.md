# Intelligent Inventory Dashboard

Keyloop technical assessment: **Scenario B, The Intelligent Inventory Dashboard (Supply)**.

A dealership manager gets a live view of vehicle stock. Vehicles in stock for more than 90 days are flagged automatically as **aging stock**, and the manager can log and persist a status or proposed action for each one (for example "Price Reduction Planned").

Both layers are implemented: a REST API with a persistent database, and a web dashboard.

| Deliverable | Location |
|---|---|
| System Design Document | [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) |
| Working code and tests | this repository |
| AI Collaboration Narrative | [below](#ai-collaboration-narrative) |

## Requirements coverage

| Requirement | Implementation |
|---|---|
| **1. Inventory visualization**: filterable list by make, model, age | `GET /api/dealerships/:id/vehicles` supports `make`, `model`, `minAge`, `maxAge`, `aging`, free-text `q`, sorting and pagination. The UI has a filter bar and a sortable, paged table. |
| **2. Aging stock identification**: automatic, prominent, > 90 days | Age is derived from `stockedAt` on every read. The UI shows a red KPI card, a red age distribution, red rows with badges, and an "Aging stock only" toggle. |
| **3. Actionable insights**: log and persist a status or action per aging vehicle | `POST /api/vehicles/:id/actions` writes to an append-only history table. The latest entry is the current status. The UI has a "Manage" panel with the full history. |

## Quick start

Requires **Node 20+** and npm. No database server is needed (SQLite file).

```bash
npm run setup     # install dependencies, create the SQLite DB, seed 250 vehicles across 2 dealerships
npm run dev       # API on http://localhost:3001, web on http://localhost:5173
```

Open http://localhost:5173. Interactive API docs (OpenAPI/Swagger) are at http://localhost:3001/docs.

If port 3001 is already in use, run the API on another port and point the web proxy at it:

```bash
PORT=3002 npm run dev -w @inventory/api
API_URL=http://localhost:3002 npm run dev -w @inventory/web
```

### Test, typecheck, build

```bash
npm test            # 57 tests: shared (15), API (22), web (20)
npm run typecheck
npm run build
```

Tests run against a dedicated SQLite file with a frozen clock, so they are deterministic and never touch the development data. To reset the demo data: `npm run db:seed -w @inventory/api`.

### What the tests cover

- **Aging rule**: exactly 90 days is not aging, 91 days is; derived age; timezone independence.
- **Filtering and listing**: make, model, inclusive age range, aging-only, VIN search, sorting, pagination, dealership isolation, validation errors (400) and unknown dealership (404).
- **Summary**: aging count, percentage and value, age buckets, actions-outstanding count, empty dealership.
- **Actions**: persisted on aging vehicles; rejected with 422 on non-aging ones with nothing stored; append-only history with the newest as current status; body validation.
- **Operations**: health, readiness, metrics, request-id propagation, OpenAPI document.
- **UI**: aging rows flagged, Manage only offered for aging vehicles, filter behaviour, an action being POSTed, server errors surfaced to the user, API-down state.

## Repository layout

```
apps/api         Fastify API, Prisma schema and seed, service layer, integration tests
apps/web         React + Vite + Tailwind dashboard, component tests
packages/shared  Aging rule (90 days) and Zod contract shared by both apps
docs/            System design document
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/dealerships` | List dealerships |
| `GET /api/dealerships/:id/vehicles` | Filter: `make`, `model`, `q`, `minAge`, `maxAge`, `aging`. Sort: `sort`, `order`. Paging: `page`, `pageSize` (max 100) |
| `GET /api/dealerships/:id/inventory/summary` | KPIs, age buckets, make and model options |
| `GET /api/vehicles/:id` | A vehicle with its full action history |
| `POST /api/vehicles/:id/actions` | Log an action (aging vehicles only, otherwise 422) |
| `GET /health`, `/ready`, `/metrics`, `/docs` | Liveness, readiness (checks the DB), Prometheus metrics, OpenAPI UI |

Action types: `PRICE_REDUCTION_PLANNED`, `PRICE_REDUCED`, `MARKETING_PUSH`, `TRANSFER_PLANNED`, `AUCTION_PLANNED`, `HOLD`, `SOLD`.

```bash
B=http://localhost:3001

curl -s $B/api/dealerships/dealer-london/inventory/summary
curl -s "$B/api/dealerships/dealer-london/vehicles?make=Ford&aging=true&pageSize=10"

# Log an action on an aging vehicle (take an id from the list above)
curl -s -X POST $B/api/vehicles/<VEHICLE_ID>/actions \
  -H 'content-type: application/json' \
  -d '{"actionType":"PRICE_REDUCTION_PLANNED","note":"Drop 5% at month end","createdBy":"alex"}'
# The same call on a vehicle of 90 days or less returns 422 RULE_VIOLATION
```

## Key design decisions and assumptions

The brief leaves some points open. These are the assumptions made; the full list is in the [design document](docs/SYSTEM_DESIGN.md).

- **Aging means strictly more than 90 days** (90 is not aging, 91 is), counted in whole UTC days.
- **Age is derived, never stored.** Age filters become an indexed range on `stockedAt`, so results are always correct and no nightly job is needed.
- **The aging rule is enforced on the server** (422), not only hidden in the UI, and lives in one shared function used by both apps.
- **Actions are append-only history**, giving an audit trail; the newest entry is the current status.
- **"Real-time"** means refetch on window focus plus 30-second polling. Server push is documented as the next step.
- **No authentication.** The manager name is a free-text field. Production would take it from the auth token.

### Built for the future

- **Scalability**: a stateless API, database-side filtering and pagination, indexes matching the query patterns, and a Prisma schema that moves to Postgres by changing the provider and `DATABASE_URL`.
- **Reliability**: input validation at the edge, graceful shutdown, a readiness probe, and append-only writes.
- **Maintainability**: strict TypeScript, a shared contract package, business rules isolated in a service with an injectable clock, and OpenAPI generated from the same schemas the code uses.
- **Observability**: structured JSON logs correlated by request id, Prometheus metrics (latency per route template and business counters), and health endpoints. Distributed tracing is designed but not built.

### Known limitations

No authentication; polling rather than push; the summary endpoint aggregates one dealership's stock in memory (fine at this scale, to be moved to SQL aggregation); tracing not implemented; no Docker setup, CI, or browser end-to-end tests. `npm audit` reports advisories in Zod and `@fastify/static` that require breaking major upgrades; these are detailed in the design document. `light-my-request` is pinned to 6.6.0 via `overrides` because 6.8 depends on an ESM-only `cookie` that breaks on Node 20.11 (not needed on Node 20.19 or later).

## AI Collaboration Narrative

This project was built with Claude Code as the implementation agent, directed and reviewed by me.

**Strategy for guiding the AI.**
I had the AI turn the brief into a written plan before any code: the three testable requirements, the ambiguities, a stack, and the trade-offs. I approved that plan and made the key decisions: a fullstack TypeScript build, and deriving age from `stockedAt` rather than storing it. Work then went in small, committed phases: scaffold, shared contract and business rule, API, frontend, documentation. The 90-day rule was implemented and tested first in a shared package, so everything else was built on a verified foundation.

**How I verified and refined its output.**
- **Tests on the rules that matter**, using a frozen clock: the 90/91-day boundary, filters, the 422 rule, append-only history, and per-dealership isolation.
- **Mutation check**: I did not treat a green suite as proof. I deliberately broke the core rule (threshold 90 to 100, and `>` to `>=`) and confirmed the suites failed (6 and 3 failing tests respectively), then restored the code.
- **Real execution**: I smoke-tested the API with cURL and drove the UI in a browser (filter, open a vehicle, log an action), confirming that the row status and the KPI changed and that the record existed in SQLite.
- **Clean-clone check**: from a fresh clone, `npm run setup`, `npm test` and `npm run build` all pass. This caught a real bug (a missing `.env` broke first-time setup), which is now fixed.

**Where the AI got things wrong, and how it was caught.**
1. *Dependency mismatch.* All 22 API tests initially failed because the latest `light-my-request` pulls an ESM-only dependency that Node 20.11 cannot `require()`. Two plausible fixes failed before pinning the version, and the reason is documented next to the override.
2. *Two defects in its own tests.* One sorted numbers as strings; another assumed a Prometheus counter started at zero although counters accumulate. The application code was right in both cases, so I corrected the tests rather than weakening them.
3. *Environment collision.* Port 3001 was occupied by an unrelated process. The AI left it alone and made the proxy target configurable.
4. *Documentation drift.* A draft of the design document described actions that had not happened. It was corrected so the documentation matches what was built.
5. *Security hygiene.* `npm audit` findings were fixed where a non-breaking fix existed. The rest need major upgrades and are listed openly rather than force-upgraded blindly.

**How I ensured the final quality.**
57 automated tests, a clean strict-TypeScript typecheck across all packages, a manual end-to-end browser check, a verified clean-clone build, small commits per phase, and documentation that states what the system does not do.

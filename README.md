# Campus Equipment Booking API

TypeScript and Hono API for booking shared campus equipment without overlapping reservations.

## Requirements

- Node.js 20.17 or newer
- npm

The runtime uses Hono with `@hono/node-server` and local SQLite. TypeScript is executed with `tsx`.

## Run

```powershell
npm install
npm start
```

After the server starts, open one of these clickable endpoints in your browser:

- [Equipment API](http://localhost:8787/api/equipment)
- [Bookings API](http://localhost:8787/api/bookings)

The base path is `http://localhost:8787/api`; it is a prefix rather than a standalone route. Set `PORT` or `DATABASE_FILE` to override the defaults.

## Cloudflare submission API

The deployed Cloudflare Worker uses D1 and is available at:

- [Cloudflare Equipment API](https://campus-equipment-booking-api.musicpulse-app.workers.dev/api/equipment)
- [Cloudflare Bookings API](https://campus-equipment-booking-api.musicpulse-app.workers.dev/api/bookings)

Cloudflare deployment files are in `worker/`. Deploy with `npx wrangler deploy --config worker/wrangler.toml` after `npx wrangler login`.

## Test

```powershell
npm test
npm run typecheck
```

The tests use an in-memory SQLite database and cover equipment listing, booking CRUD, invalid data, unknown equipment, not found, and overlapping create/update requests.

## Submission evidence

- [API_CONTRACT.md](API_CONTRACT.md) describes endpoints, payloads, statuses, assumptions, and the schema.
- [TEST_EVIDENCE.md](TEST_EVIDENCE.md) contains the curl cases and observed automated test result.
- [QUALITY_GATE_REVIEW.md](QUALITY_GATE_REVIEW.md) records the pre-30-minute baseline, findings, fixes, and verification.
- [AI_LOG.md](AI_LOG.md) records AI assistance and independent verification.

# AI Log

Date: 2026-10-06

## Assistance record

1. **Prompt / request:** Review the starter repository against the lab rubric.
   - **Used:** Identified that only `package.json` and installed dependencies existed, and that the placeholder test script failed.
   - **Verified myself:** Checked the workspace contents, Node/npm versions, `npm test`, and `npm ls --depth=0`.

2. **Prompt / request:** Build the Campus Equipment Booking API from the supplied exam brief.
   - **Used:** Implemented the first Express/SQLite version, then aligned the project with the brief by converting the runtime to TypeScript/Hono with local SQLite. The routes, validation, JSON errors, parameterized SQL, and overlap checks for create and update were retained.
   - **Verified myself:** Read the contract, checked the starter dependencies, and confirmed the final package uses Hono, TypeScript, and SQLite before rerunning typecheck and tests.

3. **Prompt / request:** Add evidence and quality-gate documentation.
   - **Used:** Added `README.md`, `API_CONTRACT.md`, `TEST_EVIDENCE.md`, and `QUALITY_GATE_REVIEW.md`.
   - **Verified myself:** Confirmed the documents state assumptions, status codes, schema relationship, SQL safety, findings, fixes, and evidence. The student should be able to explain each route and the overlap predicate before submission.

## Verification performed

- `npm ls --depth=0` confirmed the declared dependencies are installed.
- `npm run typecheck` passed with no TypeScript errors.
- `npm test` passed all six API tests.
- Tests use an in-memory SQLite database, so they do not depend on an existing database file.
- `npx wrangler whoami` confirmed the authorized Cloudflare account and D1/Workers permissions.
- Created D1 database `campus-equipment-booking-db`, applied migration `0001_initial.sql`, and deployed the Worker.
- Verified the public HTTPS Worker returned equipment `200` and booking creation `201`.

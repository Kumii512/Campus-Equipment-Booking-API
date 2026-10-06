# Quality Gate Review

## Pre-30-minute snapshot

At the first implementation checkpoint, the API had the starter dependencies and the first CRUD path, but the review baseline identified that the project still needed stronger validation, conflict handling, and repeatable evidence. During the review, the runtime was also aligned with the stated TypeScript/Hono course stack. This document records the baseline and the improvements made after that checkpoint.

## Findings and improvements

### 1. Reliability / Accuracy

**What I found:** An overlap rule must be enforced for both new bookings and booking updates; checking only create requests would allow an update to introduce a conflict.

**How I fixed it:** Added parameterized overlap queries to both `POST /api/bookings` and `PATCH /api/bookings/:id`. The update query excludes the booking being updated with `id <> ?`.

**Evidence:** `npm test` passes `rejects overlapping create and update requests with 409`.

### 2. Validation and error contract

**What I found:** Invalid JSON, missing fields, invalid date-times, reversed time ranges, unknown equipment, and missing bookings need consistent JSON responses.

**How I fixed it:** Added one input-validation path, explicit `400` and `404` responses, a JSON parse error handler, and a final JSON route-not-found handler.

**Evidence:** `npm test` passes the invalid time, unknown equipment, and deleted-booking not-found cases.

### 3. Security / SQL correctness

**What I found:** Request values must not be inserted into SQL strings, and SQLite foreign-key behavior should be enabled.

**How I fixed it:** Every query uses `?` parameters, and database initialization enables `PRAGMA foreign_keys = ON`.

**Evidence:** The SQL statements in `src/app.ts` contain placeholders for request values; the full six-case test suite passes against SQLite.

### 4. Reasoning / You Own It

**What I found:** The API contract needs explicit assumptions so the overlap behavior can be explained and tested.

**How I fixed it:** Documented the half-open interval rule, status-code decisions, schema relationship, and overlap predicate in `API_CONTRACT.md`. The AI-assisted choices are recorded in `AI_LOG.md`.

**Evidence:** The automated tests include adjacent/non-conflicting scheduling logic through the overlap predicate, and the contract explains why `400`, `404`, and `409` are used.

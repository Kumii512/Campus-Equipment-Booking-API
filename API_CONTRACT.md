# API Contract and Data Design

Local Base URL: `http://localhost:8787/api`

Cloudflare submission Base URL: `https://campus-equipment-booking-api.musicpulse-app.workers.dev/api`

## Assumptions

- A booking uses one equipment item and one half-open time interval `[startAt, endAt)`.
- A booking ending exactly when another starts does not overlap.
- All date-time values are ISO 8601 strings. The API validates them with the runtime date parser and requires `startAt < endAt`.
- Equipment is seeded with two records and is read-only for this practical test.

## Equipment

`GET /equipment` returns `200` and an array of:

```json
{ "id": "eq-1", "name": "Projector A", "location": "Building 1" }
```

## Bookings

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| GET | `/bookings` | 200 | List bookings |
| GET | `/bookings/:id` | 200 | Get one booking |
| POST | `/bookings` | 201 | Create a booking |
| PATCH | `/bookings/:id` | 200 | Replace the supplied booking fields |
| DELETE | `/bookings/:id` | 204 | Delete a booking |

Create and update payload:

```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

Booking responses contain `id`, `equipmentId`, `borrowerName`, `startAt`, `endAt`, and `purpose`.

## Errors

Every error is JSON:

```json
{ "error": "A message understandable to a user or developer" }
```

- `400`: missing or invalid fields, invalid time order, or unknown `equipmentId`.
- `404`: booking or route does not exist.
- `409`: the same equipment already has an overlapping booking.
- `500`: unexpected server/database failure.

## Schema / ERD

```text
EQUIPMENT
---------
id (TEXT, primary key)
name (TEXT, required)
location (TEXT, required)
        1
        |
        | equipment_id (foreign key)
        many
BOOKINGS
--------
id (INTEGER, primary key)
equipment_id (TEXT, required)
borrower_name (TEXT, required)
start_at (TEXT, required)
end_at (TEXT, required)
purpose (TEXT, required)
```

Overlap check for the same equipment:

```sql
start_at < requested_end AND end_at > requested_start
```

All request values are passed through SQLite parameter binding (`?`); request data is never concatenated into SQL.

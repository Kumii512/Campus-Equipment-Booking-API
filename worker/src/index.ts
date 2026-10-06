import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  DB: D1Database;
}

type BookingInput = {
  equipmentId: string;
  borrowerName: string;
  startAt: string;
  endAt: string;
  purpose: string;
};

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBookingInput(body: unknown): { value?: BookingInput; error?: string } {
  const input = body as Record<string, unknown> | null;
  const value: BookingInput = {
    equipmentId: text(input?.equipmentId),
    borrowerName: text(input?.borrowerName),
    startAt: text(input?.startAt),
    endAt: text(input?.endAt),
    purpose: text(input?.purpose)
  };
  if (!value.equipmentId || !value.borrowerName || !value.startAt || !value.endAt || !value.purpose) {
    return { error: 'equipmentId, borrowerName, startAt, endAt, and purpose are required' };
  }
  const start = new Date(value.startAt);
  const end = new Date(value.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'startAt and endAt must be valid date-time values' };
  }
  if (start >= end) return { error: 'startAt must be before endAt' };
  return { value };
}

const bookingSelect = `
  SELECT id, equipment_id AS equipmentId, borrower_name AS borrowerName,
         start_at AS startAt, end_at AS endAt, purpose
  FROM bookings
`;

app.get('/api/equipment', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, location FROM equipment ORDER BY id'
  ).all();
  return c.json(results);
});

app.get('/api/bookings', async (c) => {
  const { results } = await c.env.DB.prepare(`${bookingSelect} ORDER BY start_at, id`).all();
  return c.json(results);
});

app.get('/api/bookings/:id', async (c) => {
  const row = await c.env.DB.prepare(`${bookingSelect} WHERE id = ?`)
    .bind(c.req.param('id'))
    .first();
  if (!row) return c.json({ error: 'Booking not found' }, 404);
  return c.json(row);
});

app.post('/api/bookings', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must contain valid JSON' }, 400);
  }
  const parsed = parseBookingInput(body);
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  const booking = parsed.value!;

  const equipment = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?')
    .bind(booking.equipmentId)
    .first();
  if (!equipment) return c.json({ error: 'equipmentId does not exist' }, 400);

  const conflict = await c.env.DB.prepare(
    'SELECT id FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ?'
  ).bind(booking.equipmentId, booking.endAt, booking.startAt).first();
  if (conflict) return c.json({ error: 'Booking time conflicts with an existing booking' }, 409);

  const result = await c.env.DB.prepare(
    `INSERT INTO bookings (equipment_id, borrower_name, start_at, end_at, purpose)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(booking.equipmentId, booking.borrowerName, booking.startAt, booking.endAt, booking.purpose).run();
  const created = await c.env.DB.prepare(`${bookingSelect} WHERE id = ?`)
    .bind(result.meta.last_row_id)
    .first();
  return c.json(created, 201);
});

app.patch('/api/bookings/:id', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must contain valid JSON' }, 400);
  }
  const parsed = parseBookingInput(body);
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM bookings WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Booking not found' }, 404);
  const booking = parsed.value!;

  const equipment = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?')
    .bind(booking.equipmentId).first();
  if (!equipment) return c.json({ error: 'equipmentId does not exist' }, 400);
  const conflict = await c.env.DB.prepare(
    `SELECT id FROM bookings
     WHERE equipment_id = ? AND id <> ? AND start_at < ? AND end_at > ?`
  ).bind(booking.equipmentId, id, booking.endAt, booking.startAt).first();
  if (conflict) return c.json({ error: 'Booking time conflicts with an existing booking' }, 409);

  await c.env.DB.prepare(
    `UPDATE bookings SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
     WHERE id = ?`
  ).bind(booking.equipmentId, booking.borrowerName, booking.startAt, booking.endAt, booking.purpose, id).run();
  const updated = await c.env.DB.prepare(`${bookingSelect} WHERE id = ?`).bind(id).first();
  return c.json(updated);
});

app.delete('/api/bookings/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(c.req.param('id')).run();
  if (!result.meta.changes) return c.json({ error: 'Booking not found' }, 404);
  return c.body(null, 204);
});

app.notFound((c) => c.json({ error: 'Route not found' }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;

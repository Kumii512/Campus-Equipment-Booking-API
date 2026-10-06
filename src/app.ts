import { cors } from 'hono/cors';
import { Hono, type Context } from 'hono';
import sqlite3 from 'sqlite3';

const equipmentSeed = [
  { id: 'eq-1', name: 'Projector A', location: 'Building 1' },
  { id: 'eq-2', name: 'Camera Kit B', location: 'Media Lab' }
];

type Database = sqlite3.Database;
type BookingInput = {
  equipmentId: string;
  borrowerName: string;
  startAt: string;
  endAt: string;
  purpose: string;
};

type BookingRow = BookingInput & {
  id: number;
};

function run(db: Database, sql: string, parameters: unknown[] = []): Promise<{ id: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, parameters, function onRun(error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get<T>(db: Database, sql: string, parameters: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, parameters, (error, row) => {
      if (error) reject(error);
      else resolve(row as T | undefined);
    });
  });
}

function all<T>(db: Database, sql: string, parameters: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, parameters, (error, rows) => {
      if (error) reject(error);
      else resolve(rows as T[]);
    });
  });
}

export async function initializeDatabase(db: Database): Promise<void> {
  await run(db, 'PRAGMA foreign_keys = ON');
  await run(db, `
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL
    )
  `);
  await run(db, `
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id TEXT NOT NULL,
      borrower_name TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      purpose TEXT NOT NULL,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT
    )
  `);
  for (const equipment of equipmentSeed) {
    await run(
      db,
      'INSERT OR IGNORE INTO equipment (id, name, location) VALUES (?, ?, ?)',
      [equipment.id, equipment.name, equipment.location]
    );
  }
}

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

function toBooking(row: BookingRow) {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    borrowerName: row.borrowerName,
    startAt: row.startAt,
    endAt: row.endAt,
    purpose: row.purpose
  };
}

const bookingSelect = `
  SELECT id, equipment_id AS equipmentId, borrower_name AS borrowerName,
         start_at AS startAt, end_at AS endAt, purpose
  FROM bookings
`;

export function createApp(db: Database) {
  const app = new Hono();
  app.use('*', cors());

  app.get('/api/equipment', async (c) => {
    const rows = await all<{ id: string; name: string; location: string }>(
      db,
      'SELECT id, name, location FROM equipment ORDER BY id'
    );
    return c.json(rows);
  });

  app.get('/api/bookings', async (c) => {
    const rows = await all<BookingRow>(db, `${bookingSelect} ORDER BY start_at, id`);
    return c.json(rows.map(toBooking));
  });

  app.get('/api/bookings/:id', async (c) => {
    const row = await get<BookingRow>(db, `${bookingSelect} WHERE id = ?`, [c.req.param('id')]);
    if (!row) return c.json({ error: 'Booking not found' }, 404);
    return c.json(toBooking(row));
  });

  async function requestBody(c: Context) {
    try {
      return await c.req.json();
    } catch {
      return undefined;
    }
  }

  app.post('/api/bookings', async (c) => {
    const parsed = parseBookingInput(await requestBody(c));
    if (parsed.error) return c.json({ error: parsed.error }, 400);

    const booking = parsed.value!;
    const equipment = await get<{ id: string }>(db, 'SELECT id FROM equipment WHERE id = ?', [booking.equipmentId]);
    if (!equipment) return c.json({ error: 'equipmentId does not exist' }, 400);

    const conflict = await get<{ id: number }>(
      db,
      'SELECT id FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ?',
      [booking.equipmentId, booking.endAt, booking.startAt]
    );
    if (conflict) return c.json({ error: 'Booking time conflicts with an existing booking' }, 409);

    const result = await run(
      db,
      `INSERT INTO bookings (equipment_id, borrower_name, start_at, end_at, purpose)
       VALUES (?, ?, ?, ?, ?)`,
      [booking.equipmentId, booking.borrowerName, booking.startAt, booking.endAt, booking.purpose]
    );
    const row = await get<BookingRow>(db, `${bookingSelect} WHERE id = ?`, [result.id]);
    return c.json(toBooking(row!), 201);
  });

  app.patch('/api/bookings/:id', async (c) => {
    const parsed = parseBookingInput(await requestBody(c));
    if (parsed.error) return c.json({ error: parsed.error }, 400);

    const id = c.req.param('id');
    const existing = await get<{ id: number }>(db, 'SELECT id FROM bookings WHERE id = ?', [id]);
    if (!existing) return c.json({ error: 'Booking not found' }, 404);

    const booking = parsed.value!;
    const equipment = await get<{ id: string }>(db, 'SELECT id FROM equipment WHERE id = ?', [booking.equipmentId]);
    if (!equipment) return c.json({ error: 'equipmentId does not exist' }, 400);

    const conflict = await get<{ id: number }>(
      db,
      `SELECT id FROM bookings
       WHERE equipment_id = ? AND id <> ? AND start_at < ? AND end_at > ?`,
      [booking.equipmentId, id, booking.endAt, booking.startAt]
    );
    if (conflict) return c.json({ error: 'Booking time conflicts with an existing booking' }, 409);

    await run(
      db,
      `UPDATE bookings
       SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
       WHERE id = ?`,
      [booking.equipmentId, booking.borrowerName, booking.startAt, booking.endAt, booking.purpose, id]
    );
    const row = await get<BookingRow>(db, `${bookingSelect} WHERE id = ?`, [id]);
    return c.json(toBooking(row!));
  });

  app.delete('/api/bookings/:id', async (c) => {
    const result = await run(db, 'DELETE FROM bookings WHERE id = ?', [c.req.param('id')]);
    if (!result.changes) return c.json({ error: 'Booking not found' }, 404);
    return c.body(null, 204);
  });

  app.notFound((c) => c.json({ error: 'Route not found' }, 404));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

export function openDatabase(filename = 'booking.sqlite'): Database {
  return new sqlite3.Database(filename);
}

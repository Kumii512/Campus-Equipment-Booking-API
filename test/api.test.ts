import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { serve, type ServerType } from '@hono/node-server';
import sqlite3 from 'sqlite3';
import { createApp, initializeDatabase } from '../src/app.js';

let db: sqlite3.Database;
let server: ServerType | undefined;
let baseUrl: string;

const booking = {
  equipmentId: 'eq-1',
  borrowerName: 'Somchai Jaidee',
  startAt: '2026-10-20T09:00:00.000Z',
  endAt: '2026-10-20T11:00:00.000Z',
  purpose: 'Class presentation'
};

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

before(async () => {
  db = new sqlite3.Database(':memory:');
  await initializeDatabase(db);
  const app = createApp(db);
  await new Promise<void>((resolve) => {
    server = serve({ port: 0, fetch: app.fetch }, (info) => {
      baseUrl = `http://localhost:${info.port}/api`;
      resolve();
    });
  });
});

after(async () => {
  server?.close();
  await new Promise<void>((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
});

describe('Campus Equipment Booking API', () => {
  it('lists seeded equipment', async () => {
    const { response, body } = await request('/equipment');
    assert.equal(response.status, 200);
    assert.equal(body.length, 2);
  });

  it('creates and reads a booking', async () => {
    const created = await request('/bookings', { method: 'POST', body: JSON.stringify(booking) });
    assert.equal(created.response.status, 201);
    const read = await request(`/bookings/${created.body.id}`);
    assert.equal(read.response.status, 200);
    assert.equal(read.body.purpose, booking.purpose);
  });

  it('rejects invalid time ranges with 400', async () => {
    const result = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ ...booking, startAt: booking.endAt })
    });
    assert.equal(result.response.status, 400);
    assert.match(result.body.error, /before/);
  });

  it('rejects unknown equipment with 400', async () => {
    const result = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ ...booking, equipmentId: 'eq-missing' })
    });
    assert.equal(result.response.status, 400);
    assert.match(result.body.error, /does not exist/);
  });

  it('rejects overlapping create and update requests with 409', async () => {
    const overlappingCreate = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ ...booking, borrowerName: 'Another borrower' })
    });
    assert.equal(overlappingCreate.response.status, 409);

    const second = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        ...booking,
        equipmentId: 'eq-2',
        startAt: '2026-10-20T12:00:00.000Z',
        endAt: '2026-10-20T13:00:00.000Z'
      })
    });
    const overlappingUpdate = await request(`/bookings/${second.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...booking, borrowerName: 'Updated borrower' })
    });
    assert.equal(overlappingUpdate.response.status, 409);
  });

  it('updates and deletes a booking', async () => {
    const created = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        ...booking,
        equipmentId: 'eq-2',
        startAt: '2026-10-21T09:00:00.000Z',
        endAt: '2026-10-21T10:00:00.000Z'
      })
    });
    const updated = await request(`/bookings/${created.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...booking,
        equipmentId: 'eq-2',
        startAt: '2026-10-21T10:00:00.000Z',
        endAt: '2026-10-21T11:00:00.000Z',
        purpose: 'Updated purpose'
      })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.purpose, 'Updated purpose');

    const deleted = await request(`/bookings/${created.body.id}`, { method: 'DELETE' });
    assert.equal(deleted.response.status, 204);
    const missing = await request(`/bookings/${created.body.id}`);
    assert.equal(missing.response.status, 404);
  });
});

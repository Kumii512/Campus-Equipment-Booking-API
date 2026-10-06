import { serve } from '@hono/node-server';
import { createApp, initializeDatabase, openDatabase } from './app.js';

const port = Number(process.env.PORT || 8787);
const db = openDatabase(process.env.DATABASE_FILE || 'booking.sqlite');

initializeDatabase(db)
  .then(() => {
    serve({ fetch: createApp(db).fetch, port }, (info) => {
      console.log(`Campus Equipment Booking API listening on http://localhost:${info.port}`);
    });
  })
  .catch((error: unknown) => {
    console.error('Database initialization failed', error);
    process.exitCode = 1;
  });

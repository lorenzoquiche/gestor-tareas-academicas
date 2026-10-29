import { createApp } from './app.js';
import { createDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3000);
const database = createDatabase({ filename: process.env.DATABASE_PATH });
const app = createApp({ database });

const server = app.listen(port, () => {
  console.log(`API disponible en http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

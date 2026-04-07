import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import boardsRouter from './routes/boards';
import cardsRouter from './routes/cards';
import { getDb } from './db';
import { startupCleanup } from './startup-cleanup';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
}));
app.use(express.json());

// Initialize DB on startup
getDb();

app.use('/boards', boardsRouter);
app.use('/cards', cardsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── TEST-ONLY: DB 초기화 엔드포인트 (ALLOW_TEST_RESET=true 환경변수 필수) ──
if (process.env.ALLOW_TEST_RESET === 'true') {
  app.post('/test/reset', (_req, res) => {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM cards').run();
    })();
    broadcast({ type: 'card:deleted', boardId: 1 });
    const columns = db.prepare('SELECT id, name, position, wip_limit FROM columns ORDER BY position').all();
    res.json({ ok: true, columns });
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

export function broadcast(data: unknown): void {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Kanban backend running on port ${PORT}`);
  startupCleanup();
});

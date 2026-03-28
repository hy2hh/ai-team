import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import boardsRouter from './routes/boards';
import cardsRouter from './routes/cards';
import { getDb } from './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize DB on startup
getDb();

app.use('/boards', boardsRouter);
app.use('/cards', cardsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
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
});

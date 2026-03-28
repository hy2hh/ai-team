import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Board, Column, Card } from '../types';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const boards = db.prepare('SELECT * FROM boards ORDER BY id').all() as Board[];
  res.json(boards);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id) as Board | undefined;
  if (!board) return res.status(404).json({ error: 'Board not found' });

  // N+1 쿼리 → 단일 JOIN 쿼리로 통합
  const rows = db.prepare(`
    SELECT
      col.id as col_id, col.name as col_name, col.position as col_pos, col.wip_limit,
      c.id as card_id, c.title, c.description, c.priority,
      c.assignee, c.progress, c.position as card_pos, c.column_id,
      c.created_at, c.updated_at
    FROM columns col
    LEFT JOIN cards c ON c.column_id = col.id
    WHERE col.board_id = ?
    ORDER BY col.position, c.position
  `).all(req.params.id) as Array<Record<string, unknown>>;

  const colMap = new Map<number, Column & { cards: Card[] }>();
  for (const row of rows) {
    const colId = row.col_id as number;
    if (!colMap.has(colId)) {
      colMap.set(colId, {
        id: colId,
        name: row.col_name as string,
        position: row.col_pos as number,
        wip_limit: row.wip_limit as number | null,
        board_id: board.id,
        cards: [],
      } as Column & { cards: Card[] });
    }
    if (row.card_id !== null) {
      colMap.get(colId)!.cards.push({
        id: row.card_id as number,
        column_id: row.column_id as number,
        title: row.title as string,
        description: row.description as string | null,
        priority: row.priority as string,
        assignee: row.assignee as string | null,
        progress: row.progress as number,
        position: row.card_pos as number,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      } as Card);
    }
  }

  res.json({ ...board, columns: [...colMap.values()] });
});

export default router;

export interface Board {
  id: number;
  name: string;
  created_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  wip_limit: number | null;
}

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  assignee: string | null;
  progress: number;
  position: number;
  due_date: string | null;
  tags: string[];
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

// SQLite raw row — tags stored as JSON string
export interface CardRow extends Omit<Card, 'tags'> {
  tags: string;
}

export interface BoardSummary extends Board {
  columns: (Column & { cards: Card[] })[];
}

export interface CardActivity {
  id: number;
  card_id: number;
  action: 'created' | 'moved' | 'progress_updated' | 'assignee_changed' | 'commented' | 'updated';
  agent: string | null;
  detail: string;
  created_at: string;
}

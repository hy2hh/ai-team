export interface Board {
  id: number;
  name: string;
  created_at: string;
  columns: ColumnWithCards[];
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  wip_limit: number | null;
}

export interface ColumnWithCards extends Column {
  cards: Card[];
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
  created_at: string;
  updated_at: string;
}

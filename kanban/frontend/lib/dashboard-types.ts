export interface ActivityEvent {
  id: string;
  type: 'card:created' | 'card:updated' | 'card:moved' | 'card:deleted';
  cardId: number;
  cardTitle: string;
  actor?: string;
  fromColumn?: string;
  toColumn?: string;
  timestamp: string;
}

export interface Notification {
  id: number;
  type: string;
  card_id?: number;
  message: string;
  actor?: string;
  metadata?: string;
  is_read: number;
  created_at: string;
}

export interface DashboardSummary {
  totalCards: number;
  completionRate: number;
  wipViolations: number;
  dueSoonCount: number;
  overdueCount: number;
}

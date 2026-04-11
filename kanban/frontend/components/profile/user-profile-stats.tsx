'use client';
import { Card } from '@/lib/types';
import { PRIORITY_CONFIG, getAgentColor } from '@/lib/constants';

// ─────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────
export interface AgentStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  highPriority: number;
  completionRate: number;
  cards: (Card & { columnName: string })[];
}

interface UserProfileStatsProps {
  agent: string;
  stats: AgentStats | null;
  isLoading: boolean;
}

// 우선순위 → Tailwind arbitrary 클래스 (CSS 변수 참조)
const PRIORITY_DOT_CLASS: Record<string, string> = {
  high:   'bg-[var(--color-priority-high)]',
  medium: 'bg-[var(--color-priority-medium)]',
  low:    'bg-[var(--color-priority-low)]',
};

// ─────────────────────────────────────────
// StatCard: 수치 카드
// ─────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: number | string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-2xl flex flex-col gap-2 ${
        accent
          ? 'bg-[var(--color-point)]'
          : 'bg-[var(--color-bg-surface)] border border-[var(--color-border)]'
      }`}
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <span className="text-2xl leading-none" aria-hidden="true">
        {icon}
      </span>
      <span
        className={`text-3xl font-bold tabular-nums ${
          accent ? 'text-white' : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </span>
      <span
        className={`text-sm ${accent ? 'text-white/80' : 'text-[var(--color-text-muted)]'}`}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────
// SkeletonCard: 로딩 플레이스홀더
// ─────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="p-5 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse"
      aria-hidden="true"
    >
      <div className="w-8 h-8 bg-[var(--color-bg-elevated)] rounded-lg mb-3" />
      <div className="w-14 h-8 bg-[var(--color-bg-elevated)] rounded mb-2" />
      <div className="w-24 h-4 bg-[var(--color-bg-elevated)] rounded" />
    </div>
  );
}

// ─────────────────────────────────────────
// UserProfileStats: 메인 컴포넌트
// ─────────────────────────────────────────
export default function UserProfileStats({
  agent,
  stats,
  isLoading,
}: UserProfileStatsProps) {
  const initials = agent.slice(0, 2).toUpperCase();
  const agentColor = getAgentColor(agent);

  return (
    <div>
      {/* 에이전트 아바타 + 이름 */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0 ring-4 ring-[var(--color-bg-surface)]"
          style={{ backgroundColor: agentColor }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {agent}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">AI Team Agent</p>
        </div>
      </div>

      {/* 통계 그리드 */}
      <section aria-labelledby="stats-heading" className="mb-6">
        <h2
          id="stats-heading"
          className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3"
        >
          작업 통계
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard icon="📋" label="전체 카드" value={stats?.total ?? 0} />
              <StatCard icon="✅" label="완료" value={stats?.completed ?? 0} accent />
              <StatCard icon="⏳" label="진행 중" value={stats?.inProgress ?? 0} />
              <StatCard icon="⚠️" label="기한 초과" value={stats?.overdue ?? 0} />
            </>
          )}
        </div>
      </section>

      {/* 완료율 프로그레스 바 */}
      {!isLoading && stats && stats.total > 0 && (
        <section
          aria-labelledby="completion-heading"
          className="mb-6 p-5 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              id="completion-heading"
              className="text-sm font-semibold text-[var(--color-text-primary)]"
            >
              완료율
            </h2>
            <span className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
              {stats.completionRate}%
            </span>
          </div>
          <div
            className="h-2.5 w-full rounded-full bg-[var(--color-bg-elevated)] overflow-hidden"
            role="progressbar"
            aria-valuenow={stats.completionRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`완료율 ${stats.completionRate}%`}
          >
            {/* width는 동적 수치이므로 inline style 허용 예외 */}
            <div
              className="h-full rounded-full bg-[var(--color-point)] transition-all duration-700 ease-out"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            전체 {stats.total}개 중 {stats.completed}개 완료
          </p>
        </section>
      )}

      {/* 우선순위 분포 */}
      {!isLoading && stats && stats.total > 0 && (
        <section
          aria-labelledby="priority-heading"
          className="mb-6 p-5 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
        >
          <h2
            id="priority-heading"
            className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3"
          >
            우선순위 분포
          </h2>
          <div className="flex gap-4">
            {(['high', 'medium', 'low'] as const).map((p) => {
              const count = stats.cards.filter((c) => c.priority === p).length;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={p} className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIORITY_DOT_CLASS[p]}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {PRIORITY_CONFIG[p].label}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
                    {count}
                    <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">
                      ({pct}%)
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 최근 담당 카드 목록 */}
      <section aria-labelledby="recent-cards-heading">
        <h2
          id="recent-cards-heading"
          className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3"
        >
          담당 카드
        </h2>

        {isLoading ? (
          <ul className="space-y-3" aria-busy="true" aria-label="카드 로딩 중">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="h-14 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse"
                aria-hidden="true"
              />
            ))}
          </ul>
        ) : !stats || stats.cards.length === 0 ? (
          <div className="py-12 text-center bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl">
            <span className="text-3xl block mb-2" aria-hidden="true">
              📭
            </span>
            <p className="text-sm text-[var(--color-text-muted)]">담당 카드가 없습니다</p>
          </div>
        ) : (
          <ul
            className="space-y-2"
            aria-label={`${agent}의 담당 카드 목록 (${stats.cards.length}개)`}
          >
            {stats.cards
              .sort(
                (a, b) =>
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              )
              .slice(0, 10)
              .map((card) => (
                <li
                  key={card.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)] transition-colors min-h-[44px]"
                >
                  {/* 제목 + 우선순위 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT_CLASS[card.priority] ?? 'bg-[var(--color-text-muted)]'}`}
                      aria-label={`우선순위: ${PRIORITY_CONFIG[card.priority]?.label ?? card.priority}`}
                    />
                    <span className="text-sm text-[var(--color-text-primary)] truncate">
                      {card.title}
                    </span>
                  </div>

                  {/* 칼럼 배지 */}
                  <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-2.5 py-1 rounded-full flex-shrink-0 ml-3">
                    {card.columnName}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

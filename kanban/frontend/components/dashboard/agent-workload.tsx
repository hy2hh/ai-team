'use client';
import { useRouter } from 'next/navigation';
import { Card } from '@/lib/types';
import { Widget, SkeletonCircle, SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface AgentWorkloadProps {
  cards: Card[];
  loading?: boolean;
  error?: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  homer:    'var(--color-agent-homer)',
  bart:     'var(--color-agent-bart)',
  marge:    'var(--color-agent-marge)',
  lisa:     'var(--color-agent-lisa)',
  krusty:   'var(--color-agent-krusty)',
  sid:      'var(--color-agent-sid)',
  chalmers: 'var(--color-agent-chalmers)',
  wiggum:   'var(--color-agent-wiggum)',
};

function getAgentColor(name: string | null | undefined): string {
  if (!name) return 'var(--color-text-muted)';
  return AGENT_COLORS[name.toLowerCase()] ?? 'var(--color-col-default)';
}

interface AgentStat {
  name: string | null;
  count: number;
  dueSoonCount: number;
}

export default function AgentWorkload({
  cards,
  loading = false,
  error = false,
}: AgentWorkloadProps) {
  const router = useRouter();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  // 에이전트별 집계
  const agentMap = new Map<string | null, { count: number; dueSoonCount: number }>();
  for (const card of cards) {
    const key = card.assignee ?? null;
    const existing = agentMap.get(key) ?? { count: 0, dueSoonCount: 0 };
    const isDueSoon =
      card.due_date !== null
        ? new Date(card.due_date) <= tomorrow
        : false;
    agentMap.set(key, {
      count: existing.count + 1,
      dueSoonCount: existing.dueSoonCount + (isDueSoon ? 1 : 0),
    });
  }

  const agentStats: AgentStat[] = Array.from(agentMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  const maxCount = agentStats.length > 0 ? agentStats[0].count : 1;
  const overloadThreshold = maxCount * 2;

  const handleAgentClick = (agentName: string | null) => {
    if (!agentName) return;
    const params = new URLSearchParams();
    params.set('assignee', agentName.toLowerCase());
    router.push(`/?${params.toString()}`);
  };

  return (
    <Widget title="Agent Workload" ariaLabel="에이전트별 워크로드">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonCircle size={24} />
              <SkeletonLine height={8} style={{ flex: 1, borderRadius: 4 }} />
              <SkeletonLine width={36} height={12} />
            </div>
          ))}
        </div>
      ) : error ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
          데이터를 불러올 수 없습니다
        </p>
      ) : agentStats.length === 0 ? (
        <div className="empty-state">아직 카드가 배정되지 않았습니다</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agentStats.map(({ name, count, dueSoonCount }) => {
            const color = getAgentColor(name);
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const isOverloaded = count >= overloadThreshold && maxCount >= 3;
            const initial = name ? name.charAt(0).toUpperCase() : '?';

            return (
              <div
                key={name ?? '__unassigned__'}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                {/* 아바타 */}
                <button
                  onClick={() => handleAgentClick(name)}
                  disabled={!name}
                  title={name ? `${name} 카드 보기` : '미배정 카드'}
                  style={{
                    width: 24,
                    height: 24,
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: '50%',
                    background: name ? color : 'var(--color-bg-card)',
                    border: name ? 'none' : '1px dashed var(--color-border)',
                    color: name ? '#fff' : 'var(--color-text-muted)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: name ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </button>

                {/* 이름 */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    width: 72,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name ?? '미배정'}
                </span>

                {/* 바 */}
                <div
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemax={maxCount}
                  aria-label={`${name ?? '미배정'}: ${count}장`}
                  style={{
                    flex: 1,
                    height: 8,
                    background: 'var(--color-border)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: isOverloaded ? 'var(--color-priority-high)' : (name ? color : 'var(--color-text-muted)'),
                      borderRadius: 4,
                      transition: 'width var(--duration-slow)',
                    }}
                  />
                </div>

                {/* 카드 수 + 배지 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 70 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {count}장
                  </span>
                  {dueSoonCount > 0 && (
                    <span
                      title="마감 임박 카드"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--color-due-warning)',
                        background: 'var(--color-due-warning-bg)',
                        border: '1px solid var(--color-due-warning-border)',
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      {dueSoonCount} 임박
                    </span>
                  )}
                  {isOverloaded && (
                    <span aria-label="과부하" style={{ fontSize: 12 }}>⚠️</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

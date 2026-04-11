'use client';
import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { AGENTS, type AgentName } from '@/lib/constants';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import UserProfileStats, { type AgentStats } from '@/components/profile/user-profile-stats';

const BOARD_ID = Number(process.env.NEXT_PUBLIC_BOARD_ID ?? 1);

// localStorage 키
const STORAGE_KEY = 'profile-selected-agent';

// 에이전트 초기값: 저장된 값 → fallback Homer
function getInitialAgent(): AgentName {
  if (typeof window === 'undefined') return 'Homer';
  const saved = localStorage.getItem(STORAGE_KEY) as AgentName | null;
  return saved && (AGENTS as readonly string[]).includes(saved) ? saved : 'Homer';
}

export default function ProfilePage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentName>(getInitialAgent);

  // SWR: 보드 데이터 페칭 (useEffect 대신 SWR 사용 — 원칙 준수)
  const { data: board, isLoading } = useSWR(
    `profile-board-${BOARD_ID}`,
    () => api.getBoard(BOARD_ID),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // 에이전트 선택 핸들러
  const handleAgentSelect = useCallback((agent: AgentName) => {
    setSelectedAgent(agent);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, agent);
    }
  }, []);

  // 선택된 에이전트의 통계 파생
  const stats = useMemo((): AgentStats | null => {
    if (!board) return null;

    const allCards = board.columns.flatMap((col) =>
      col.cards.map((card) => ({ ...card, columnName: col.name }))
    );
    const agentCards = allCards.filter(
      (card) => card.assignee?.toLowerCase() === selectedAgent.toLowerCase()
    );

    const isDoneColumn = (name: string) => {
      const n = name.toLowerCase().replace(/\s+/g, '');
      return n.includes('done') || n.includes('완료');
    };

    const completed = agentCards.filter((c) => isDoneColumn(c.columnName)).length;
    const inProgress = agentCards.filter(
      (c) => !isDoneColumn(c.columnName) && c.progress > 0
    ).length;
    const overdue = agentCards.filter((c) => {
      if (!c.due_date || isDoneColumn(c.columnName)) return false;
      return new Date(c.due_date) < new Date();
    }).length;
    const highPriority = agentCards.filter((c) => c.priority === 'high').length;
    const completionRate =
      agentCards.length > 0 ? Math.round((completed / agentCards.length) * 100) : 0;

    return {
      total: agentCards.length,
      completed,
      inProgress,
      overdue,
      highPriority,
      completionRate,
      cards: agentCards,
    };
  }, [board, selectedAgent]);

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* 공통 헤더 (Board / Dashboard / Profile 탭 포함) */}
      <DashboardHeader />

      <div className="px-7 py-6 max-w-4xl mx-auto">
        {/* 에이전트 선택 */}
        <section aria-labelledby="agent-selector-heading" className="mb-8">
          <h2
            id="agent-selector-heading"
            className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3"
          >
            에이전트 선택
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="listbox"
            aria-label="에이전트 목록"
            aria-activedescendant={`agent-option-${selectedAgent.toLowerCase()}`}
          >
            {AGENTS.map((agent) => {
              const isSelected = agent === selectedAgent;
              return (
                <button
                  key={agent}
                  id={`agent-option-${agent.toLowerCase()}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleAgentSelect(agent)}
                  className={`
                    min-h-[44px] px-5 py-2 rounded-full text-sm font-medium
                    transition-all duration-200 border focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-[var(--color-point)]
                    focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]
                    ${
                      isSelected
                        ? 'bg-[var(--color-point)] text-white border-transparent shadow-sm'
                        : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]'
                    }
                  `}
                >
                  {agent}
                </button>
              );
            })}
          </div>
        </section>

        {/* 프로필 통계 + 카드 목록 */}
        <UserProfileStats
          agent={selectedAgent}
          stats={stats}
          isLoading={isLoading}
        />
      </div>
    </main>
  );
}

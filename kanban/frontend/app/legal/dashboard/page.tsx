'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { legalApi } from '@/lib/legal-api';
import type { Case as ApiCase, CaseStatus, CATEGORY_LABELS } from '@/lib/legal-types';

// UI용 상태 매핑
type DisplayStatus = 'active' | 'done' | 'pending';

interface DisplayCase {
  id: string;
  category: string;
  title: string;
  status: DisplayStatus;
  winRate: number;
  createdAt: string;
  updatedAt: string;
}

function mapApiStatusToDisplay(status: CaseStatus): DisplayStatus {
  if (status === 'completed') return 'done';
  if (status === 'analyzing' || status === 'submitted') return 'active';
  return 'pending';
}

function mapApiCaseToDisplay(apiCase: ApiCase & { analysis?: { winProbability: number } | null }): DisplayCase {
  return {
    id: apiCase.id,
    category: apiCase.category,
    title: apiCase.title,
    status: mapApiStatusToDisplay(apiCase.status),
    winRate: apiCase.analysis?.winProbability ?? 0,
    createdAt: apiCase.createdAt.split('T')[0],
    updatedAt: apiCase.updatedAt.split('T')[0],
  };
}

function statusLabel(status: DisplayStatus): string {
  return status === 'active' ? '진행 중' : status === 'done' ? '완료' : '대기 중';
}
function statusColor(status: DisplayStatus): string {
  return status === 'active' ? '#FE9B0E' : status === 'done' ? '#0C9D61' : '#5C6E8A';
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  // API 연동: 케이스 목록 조회
  const { data: casesData, error: casesError, isLoading: casesLoading } = useSWR(
    '/api/cases',
    () => legalApi.getCases({ limit: 50 }),
    { revalidateOnFocus: false }
  );

  // API 연동: KPI 조회 (실패 시 fallback)
  const { data: kpiData } = useSWR(
    '/api/dashboard/kpi',
    () => legalApi.getDashboardKpi().catch(() => null),
    { revalidateOnFocus: false }
  );

  // API 케이스를 UI용으로 변환
  const cases: DisplayCase[] = (casesData?.cases || []).map(mapApiCaseToDisplay);

  const filteredCases = cases.filter((c) => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.includes(search);
    return matchStatus && matchSearch;
  });

  // KPI 계산 (API 데이터 또는 로컬 계산)
  const activeCnt = kpiData?.activeCases ?? cases.filter((c) => c.status === 'active').length;
  const doneCnt = kpiData?.completedCases ?? cases.filter((c) => c.status === 'done').length;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0F1A',
        color: '#F0F4FF',
        fontFamily: 'Pretendard, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          background: '#141929',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: '#60A5FA' }}>⚖️ AI법률</div>
        <div style={{ flex: 1 }} />
        <a
          href="/legal/onboarding"
          style={{
            padding: '8px 20px',
            background: '#2563EB',
            color: '#fff',
            borderRadius: 9999,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            transition: 'background 150ms',
          }}
        >
          + 새 케이스
        </a>
        <button
          style={{
            padding: '8px 16px',
            background: '#252D42',
            color: '#9AAAC4',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          내 계정 ▾
        </button>
      </header>

      {/* 본문 (사이드바 + 메인) */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* 사이드바 */}
        <nav
          aria-label="주 내비게이션"
          style={{
            width: sidebarOpen ? 240 : 0,
            background: '#141929',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: 'width 250ms ease',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {[
              { icon: '📊', label: '대시보드', href: '/legal/dashboard', active: true },
              { icon: '⚖️', label: '내 케이스', href: '/legal/dashboard' },
              { icon: '📄', label: '문서함', href: '/legal/document-generation' },
              { icon: '❓', label: '도움말', href: '#' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: item.active ? 700 : 400,
                  color: item.active ? '#F0F4FF' : '#9AAAC4',
                  background: item.active ? '#252D42' : 'transparent',
                  textDecoration: 'none',
                  minHeight: 44,
                  transition: 'background 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 18 }} aria-hidden="true">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>

          {/* 구독 현황 */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 12, color: '#5C6E8A', marginBottom: 4 }}>구독 현황</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#60A5FA' }}>₩39,000/월</div>
            <div style={{ fontSize: 12, color: '#5C6E8A', marginTop: 2 }}>갱신: 2026-05-05</div>
            <button
              style={{
                marginTop: 10,
                fontSize: 12,
                color: '#2563EB',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                minHeight: 44,
              }}
            >
              플랜 관리 →
            </button>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          {/* 인사말 */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>안녕하세요, 홍길동님</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#9AAAC4' }}>
              진행 중인 케이스 {activeCnt}건
            </p>
          </div>

          {/* KPI 카드 */}
          <section
            aria-label="케이스 현황 요약"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}
          >
            <KpiCard
              label="진행 중"
              value={String(activeCnt)}
              unit="건"
              icon="⚖️"
              valueColor="#F0F4FF"
            />
            <KpiCard
              label="완료"
              value={String(doneCnt)}
              unit="건"
              icon="✅"
              valueColor="#0C9D61"
            />
            <KpiCard
              label="이번 달"
              value="₩39,000"
              unit="구독 중"
              icon="💳"
              valueColor="#F0F4FF"
            />
          </section>

          {/* 케이스 목록 */}
          <section aria-label="케이스 목록">
            {/* 필터 바 */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: 16,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {(['all', 'active', 'done', 'pending'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '6px 14px',
                    background: statusFilter === s ? '#2563EB' : '#252D42',
                    color: statusFilter === s ? '#fff' : '#9AAAC4',
                    border: 'none',
                    borderRadius: 9999,
                    fontSize: 13,
                    cursor: 'pointer',
                    minHeight: 36,
                    transition: 'background 150ms',
                  }}
                  aria-pressed={statusFilter === s}
                >
                  {s === 'all' ? '전체' : statusLabel(s as Case['status'])}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#252D42',
                  borderRadius: 9999,
                  padding: '0 14px',
                }}
              >
                <span style={{ fontSize: 14 }} aria-hidden="true">🔍</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="케이스 검색..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: '#F0F4FF',
                    padding: '8px 0',
                    width: 180,
                    minHeight: 36,
                    fontFamily: 'inherit',
                  }}
                  aria-label="케이스 검색"
                />
              </div>
            </div>

            {/* 케이스 카드 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {casesLoading && (
                <div style={{ textAlign: 'center', padding: 48, color: '#9AAAC4' }}>
                  케이스 목록을 불러오는 중...
                </div>
              )}
              {casesError && (
                <div style={{ textAlign: 'center', padding: 48, color: '#EC2D30' }}>
                  케이스 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                </div>
              )}
              {!casesLoading && !casesError && filteredCases.map((c) => (
                <CaseCard key={c.id} caseItem={c} />
              ))}
              {!casesLoading && !casesError && filteredCases.length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: '#5C6E8A' }}>
                  케이스가 없습니다
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  unit: string;
  icon: string;
  valueColor: string;
}) {
  return (
    <div
      style={{
        background: '#1C2236',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
    >
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9AAAC4' }}>{label}</p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: valueColor }}>{value}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#5C6E8A' }}>{unit}</p>
      </div>
      <span style={{ fontSize: 24 }} aria-hidden="true">{icon}</span>
    </div>
  );
}

function CaseCard({ caseItem }: { caseItem: DisplayCase }) {
  return (
    <a
      href={`/legal/analysis?caseId=${caseItem.id}`}
      style={{
        background: '#1C2236',
        borderRadius: 16,
        padding: 20,
        display: 'block',
        textDecoration: 'none',
        color: '#F0F4FF',
        transition: 'opacity 150ms',
        cursor: 'pointer',
      }}
      aria-label={`${caseItem.title} — ${statusLabel(caseItem.status)}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#252D42',
              color: '#9AAAC4',
              fontWeight: 600,
            }}
          >
            {caseItem.category}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: `${statusColor(caseItem.status)}22`,
              color: statusColor(caseItem.status),
              fontWeight: 700,
            }}
          >
            {statusLabel(caseItem.status)}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#5C6E8A' }}>{caseItem.updatedAt}</span>
      </div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>{caseItem.title}</h3>
      {caseItem.winRate > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#9AAAC4' }}>승소 가능성</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: caseItem.winRate >= 70 ? '#0C9D61' : caseItem.winRate >= 40 ? '#FE9B0E' : '#EC2D30',
            }}
          >
            {caseItem.winRate}%
          </span>
          <div
            role="progressbar"
            aria-valuenow={caseItem.winRate}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              flex: 1,
              height: 4,
              background: '#252D42',
              borderRadius: 9999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${caseItem.winRate}%`,
                background: caseItem.winRate >= 70 ? '#0C9D61' : caseItem.winRate >= 40 ? '#FE9B0E' : '#EC2D30',
                borderRadius: 9999,
              }}
            />
          </div>
        </div>
      )}
    </a>
  );
}

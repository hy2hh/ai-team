'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Card } from '@/lib/types';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface CardActivity {
  id: number;
  agent: string;
  action: 'created' | 'moved' | 'progress_updated' | 'assignee_changed' | 'commented';
  detail: string;
  created_at: string;
}

interface Props {
  card: Card;
  columnName: string;
  onClose: () => void;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  homer:  '#4f7ef0',
  bart:   '#22d3ee',
  marge:  '#c084fc',
  lisa:   '#4ade80',
  krusty: '#fb923c',
  sid:    '#f472b6',
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', label: '높음' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  label: '보통' },
  low:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)',  label: '낮음' },
};

function getAgentColor(name: string): string {
  return AGENT_COLORS[name.toLowerCase()] ?? '#7a90b8';
}

function getProgressColor(progress: number): string {
  if (progress >= 67) return '#4ade80';
  if (progress >= 34) return '#fbbf24';
  return '#f87171';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getActivityIcon(action: CardActivity['action']): string {
  const icons: Record<CardActivity['action'], string> = {
    created: '✨',
    moved: '🔀',
    progress_updated: '📊',
    assignee_changed: '👤',
    commented: '💬',
  };
  return icons[action];
}

function getDummyActivities(card: Card): CardActivity[] {
  return [
    {
      id: 1,
      agent: card.assignee ?? 'sid',
      action: 'created',
      detail: '카드가 생성되었습니다.',
      created_at: card.created_at,
    },
  ];
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function AgentAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const color = getAgentColor(name);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 28 ? 10 : 14,
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
        border: '2px solid var(--color-bg-surface)',
        boxShadow: `0 0 10px ${color}40`,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function CardDetailModal({ card, columnName, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const progress = card.progress ?? 0;
  const progressColor = getProgressColor(progress);
  const priorityCfg = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.medium;
  const activities = getDummyActivities(card);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;

    const modal = modalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled'));

    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    closeBtnRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="detail-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        className="detail-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'detailFadeIn 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ── 헤더 ── */}
        <div
          style={{
            padding: '20px 24px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ flex: 1 }}>
            {/* 컬럼 breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>📋</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{columnName}</span>
            </div>
            <h2
              id="detail-modal-title"
              style={{
                fontSize: 17,
                fontWeight: 600,
                lineHeight: 1.4,
                color: 'var(--color-text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {card.title}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="모달 닫기"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
              transition: 'background 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-card)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
            }}
          >
            ×
          </button>
        </div>

        {/* ── 바디 ── */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* 메타 정보 행 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            {/* 담당자 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {card.assignee ? (
                <>
                  <AgentAvatar name={card.assignee} size={36} />
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>담당자</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{card.assignee}</p>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</span>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>담당자</p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, fontStyle: 'italic' }}>미배정</p>
                  </div>
                </>
              )}
            </div>

            {/* 우선순위 */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>우선순위</p>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: priorityCfg.bg,
                color: priorityCfg.color,
                border: `1px solid ${priorityCfg.border}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: priorityCfg.color, display: 'inline-block' }} />
                {priorityCfg.label}
              </span>
            </div>

            {/* 날짜 */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>생성일</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, fontWeight: 500 }}>{formatDate(card.created_at)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>수정일</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, fontWeight: 500 }}>{formatDate(card.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* 진행률 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>진행률</p>
              <span style={{ fontSize: 15, fontWeight: 700, color: progressColor }}>{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`진행률 ${progress}%`}
              style={{
                height: 8,
                borderRadius: 4,
                background: 'var(--color-border-strong)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  background: `linear-gradient(90deg, ${progressColor}80 0%, ${progressColor} 100%)`,
                  width: `${progress}%`,
                  transition: 'width 500ms cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: `0 0 8px ${progressColor}60`,
                }}
              />
            </div>
          </div>

          {/* 설명 */}
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>설명</p>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: card.description ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                fontStyle: card.description ? 'normal' : 'italic',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              {card.description ?? '설명이 없습니다.'}
            </div>
          </div>

          {/* 활동 로그 */}
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>활동</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 200, overflowY: 'auto' }}>
              {activities.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px 0', margin: 0 }}>
                  아직 활동 기록이 없습니다.
                </p>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}
                  >
                    <AgentAvatar name={act.agent} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{act.agent}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatDate(act.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)', margin: 0 }}>
                        {getActivityIcon(act.action)} {act.detail}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            background: 'var(--color-bg-elevated)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: 'var(--color-action-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid var(--color-border-strong)',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-action-secondary-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-action-secondary)';
            }}
          >
            닫기
          </button>
        </div>
      </div>

      {/* 애니메이션 + 반응형 */}
      <style>{`
        @keyframes detailFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (max-width: 479px) {
          .detail-modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .detail-modal-container {
            max-width: 100vw !important;
            width: 100vw !important;
            max-height: 95dvh !important;
            border-radius: 18px 18px 0 0 !important;
            animation: slideUp 280ms cubic-bezier(0.16,1,0.3,1) !important;
          }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 480px) and (max-width: 767px) {
          .detail-modal-container {
            width: calc(100vw - 40px) !important;
            max-height: 92vh !important;
          }
        }
      `}</style>
    </div>
  );
}

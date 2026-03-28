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

const agentColorMap: Record<string, string> = {
  homer:  '#3b82f6',
  bart:   '#06b6d4',
  marge:  '#a855f7',
  lisa:   '#22c55e',
  krusty: '#f97316',
  sid:    '#ec4899',
};

function getAgentColor(name: string): string {
  return agentColorMap[name.toLowerCase()] ?? '#64748b';
}

function getProgressColor(progress: number): string {
  if (progress >= 67) return '#22c55e';
  if (progress >= 34) return '#eab308';
  return '#ef4444';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
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

// 더미 활동 데이터 (백엔드 API 확장 전 임시)
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
  const fontSize = size <= 28 ? '11px' : '14px';
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
        fontSize,
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
        border: '2px solid var(--color-bg-surface)',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const styles: Record<string, { bg: string; color: string; border: string; dot: string; label: string }> = {
    high:   { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)',   dot: '#ef4444', label: '높음' },
    medium: { bg: 'rgba(234,179,8,0.12)',   color: '#ca8a04', border: 'rgba(234,179,8,0.3)',   dot: '#eab308', label: '보통' },
    low:    { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', border: 'rgba(34,197,94,0.3)',   dot: '#22c55e', label: '낮음' },
  };
  const s = styles[priority];
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
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
  const activities = getDummyActivities(card);

  // 포커스 트랩
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
    // 모달 열릴 때 닫기 버튼으로 포커스
    closeBtnRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-bg-overlay)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        // 모바일: 하단 정렬
      }}
      className="modal-overlay"
    >
      {/* 모달 컨테이너 */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalFadeIn 200ms ease-out',
        }}
        className="card-detail-modal"
        onClick={(e) => e.stopPropagation()}
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
          <h2
            id="modal-title"
            style={{
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.4,
              color: 'var(--color-text-primary)',
              flex: 1,
              margin: 0,
            }}
          >
            {card.title}
          </h2>
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
          {/* 담당자 + 날짜 메타 행 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            {/* 담당자 */}
            {card.assignee ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AgentAvatar name={card.assignee} size={36} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {card.assignee}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--color-border-strong)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  👤
                </span>
                <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>미배정</span>
              </div>
            )}

            {/* 날짜 */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                  생성일
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  {formatDate(card.created_at)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                  수정일
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  {formatDate(card.updated_at)}
                </span>
              </div>
            </div>
          </div>

          {/* 진행률 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>진행률</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: progressColor }}>{progress}%</span>
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
                  background: progressColor,
                  width: `${progress}%`,
                  transition: 'width 400ms ease-out',
                }}
              />
            </div>
          </div>

          {/* 태그 (우선순위) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <PriorityBadge priority={card.priority} />
          </div>

          {/* 설명 */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted)',
                marginBottom: 8,
                margin: '0 0 8px 0',
              }}
            >
              설명
            </p>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: card.description ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                fontStyle: card.description ? 'normal' : 'italic',
                background: 'var(--color-bg-elevated)',
                borderRadius: 8,
                padding: 12,
              }}
            >
              {card.description ?? '설명이 없습니다.'}
            </div>
          </div>

          {/* 활동 */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted)',
                margin: '0 0 12px 0',
              }}
            >
              활동
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 200, overflowY: 'auto' }}>
              {activities.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px 0', margin: 0 }}>
                  아직 활동 기록이 없습니다.
                </p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AgentAvatar name={act.agent} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{act.agent}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatDate(act.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
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
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>📋 {columnName}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'var(--color-action-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                fontWeight: 500,
                border: 'none',
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
      </div>

      {/* 애니메이션 + 반응형 CSS */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 479px) {
          .modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .card-detail-modal {
            max-width: 100vw !important;
            width: 100vw !important;
            max-height: 100dvh !important;
            border-radius: 16px 16px 0 0 !important;
            animation: modalSlideUp 250ms ease-out !important;
          }
        }
        @media (min-width: 480px) and (max-width: 767px) {
          .card-detail-modal {
            width: calc(100vw - 48px) !important;
            max-height: 90vh !important;
          }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import type { SearchResult } from '@/lib/legal-types';
import { CASE_TYPE_LABELS, COURT_LEVEL_LABELS, VERDICT_LABELS } from '@/lib/legal-types';

interface Props {
  result: SearchResult;
  onClick?: () => void;
}

const VERDICT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  plaintiff_win: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  defendant_win: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  partial: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  dismissed: { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  rejected: { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  settlement: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  unknown: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
};

export default function ResultCard({ result, onClick }: Props) {
  const { document: doc, chunk, score, highlights } = result;

  const verdictStyle = VERDICT_COLORS[doc.verdict] || VERDICT_COLORS.unknown;

  const relevancePercent = useMemo(() => Math.round(score * 100), [score]);

  const formattedDate = useMemo(() => {
    try {
      return new Date(doc.judgmentDate).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return doc.judgmentDate;
    }
  }, [doc.judgmentDate]);

  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      role="button"
      tabIndex={0}
      aria-label={`${doc.title} - 관련도 ${relevancePercent}%`}
      className="focus-ring"
      style={{
        padding: 20,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.4,
            }}
          >
            {doc.title}
          </h3>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}
            >
              {doc.caseNumber}
            </span>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}
            >
              {doc.courtName}
            </span>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
              }}
            >
              {formattedDate}
            </span>
          </div>
        </div>

        {/* 관련도 점수 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'var(--color-bg)',
            borderRadius: 8,
            minWidth: 60,
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color:
                relevancePercent >= 80
                  ? 'var(--color-progress-high)'
                  : relevancePercent >= 50
                  ? 'var(--color-progress-medium)'
                  : 'var(--color-progress-low)',
            }}
          >
            {relevancePercent}%
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            관련도
          </span>
        </div>
      </div>

      {/* 태그 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 12,
        }}
      >
        <Tag label={CASE_TYPE_LABELS[doc.caseType]} />
        <Tag label={COURT_LEVEL_LABELS[doc.courtLevel]} />
        <Tag
          label={VERDICT_LABELS[doc.verdict]}
          style={{
            background: verdictStyle.bg,
            color: verdictStyle.color,
            borderColor: verdictStyle.border,
          }}
        />
      </div>

      {/* 하이라이트 */}
      {highlights.length > 0 && (
        <div
          style={{
            padding: 12,
            background: 'var(--color-bg)',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {highlights.map((hl, idx) => (
            <p
              key={idx}
              style={{
                margin: idx === 0 ? 0 : '8px 0 0',
                fontSize: 14,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
              dangerouslySetInnerHTML={{
                __html: `...${hl.replace(
                  /(\S+)/g,
                  '<mark style="background:#fef08a;padding:1px 2px;border-radius:2px;">$1</mark>'
                )}...`,
              }}
            />
          ))}
        </div>
      )}

      {/* 키워드 */}
      {doc.keywords.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            키워드
          </span>
          {doc.keywords.slice(0, 5).map((kw) => (
            <span
              key={kw}
              style={{
                padding: '2px 8px',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
                borderRadius: 4,
              }}
            >
              {kw}
            </span>
          ))}
          {doc.keywords.length > 5 && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              +{doc.keywords.length - 5}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function Tag({
  label,
  style,
}: {
  label: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 6,
        border: '1px solid var(--color-border)',
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        ...style,
      }}
    >
      {label}
    </span>
  );
}

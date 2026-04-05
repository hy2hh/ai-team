'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { DisclaimerBanner } from '@/components/legal/disclaimer-banner';
import { legalApi } from '@/lib/legal-api';
import type { CaseWithAnalysis, AnalysisResult, CATEGORY_LABELS } from '@/lib/legal-types';

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  citations?: string[];
  confidence?: 'high' | 'mid' | 'low';
}

function getWinRateColor(rate: number): string {
  if (rate >= 70) return '#0C9D61';
  if (rate >= 40) return '#FE9B0E';
  return '#EC2D30';
}

function getConfidenceLevel(confidence: number): 'high' | 'mid' | 'low' {
  if (confidence >= 70) return 'high';
  if (confidence >= 40) return 'mid';
  return 'low';
}

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('caseId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // API 연동: 케이스 상세 조회 (분석 결과 포함)
  const { data: caseData, error: caseError, isLoading: caseLoading, mutate } = useSWR(
    caseId ? `/api/cases/${caseId}` : null,
    () => (caseId ? legalApi.getCase(caseId) : null),
    { revalidateOnFocus: false }
  );

  // 케이스 데이터 및 분석 결과
  const analysis = caseData?.analysis;
  const winRate = analysis?.winProbability ?? 0;
  const confidence = analysis?.confidence ?? 0;
  const relatedCases = analysis?.relatedCases ?? [];
  const legalBasis = analysis?.legalBasis ?? [];
  const warnings = analysis?.warnings ?? [];

  // 초기 메시지 설정 (분석 결과가 있을 때)
  useEffect(() => {
    if (analysis && messages.length === 0) {
      const initialMsg: Message = {
        id: '1',
        role: 'ai',
        content: analysis.summary || '분석이 완료되었습니다.',
        citations: relatedCases.slice(0, 2).map((c) => c.caseNumber),
        confidence: getConfidenceLevel(analysis.confidence),
      };
      setMessages([initialMsg]);
    }
  }, [analysis, messages.length, relatedCases]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // AI 분석 실행
  const handleAnalyze = useCallback(async () => {
    if (!caseId || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await legalApi.analyzeCase(caseId);
      mutate(); // 케이스 데이터 리프레시
    } catch (err) {
      console.error('분석 실패:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [caseId, isAnalyzing, mutate]);

  // 분석이 없으면 자동으로 분석 시작
  useEffect(() => {
    if (caseData && !caseData.analysis && caseData.status !== 'analyzing' && !isAnalyzing) {
      handleAnalyze();
    }
  }, [caseData, handleAnalyze, isAnalyzing]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !caseId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);

    try {
      // API 연동: AI 채팅
      const response = await legalApi.chat(caseId, { message: userMsg.content });
      const aiMsg: Message = {
        id: response.message.id,
        role: 'ai',
        content: response.message.content,
        citations: response.message.citations,
        confidence: response.message.confidence,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      // API 연동 실패 시 fallback 응답
      const fallbackMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        confidence: 'low',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, caseId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const winRateColor = getWinRateColor(winRate);

  // 로딩/에러 상태 처리
  if (!caseId) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0F1A', color: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 16 }}>케이스 ID가 없습니다.</p>
          <a href="/legal/dashboard" style={{ color: '#60A5FA', textDecoration: 'underline' }}>대시보드로 돌아가기</a>
        </div>
      </div>
    );
  }

  if (caseLoading || isAnalyzing) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0F1A', color: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
          <p style={{ fontSize: 18, color: '#9AAAC4' }}>
            {isAnalyzing ? 'AI가 케이스를 분석 중입니다...' : '케이스 정보를 불러오는 중...'}
          </p>
        </div>
      </div>
    );
  }

  if (caseError || !caseData) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0F1A', color: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, color: '#EC2D30', marginBottom: 16 }}>케이스를 불러오지 못했습니다.</p>
          <a href="/legal/dashboard" style={{ color: '#60A5FA', textDecoration: 'underline' }}>대시보드로 돌아가기</a>
        </div>
      </div>
    );
  }

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
        <div style={{ fontSize: 18, fontWeight: 800, color: '#60A5FA' }}>⚖️ AI법률</div>
        <span style={{ color: '#3A4A60' }}>|</span>
        <span style={{ fontSize: 14, color: '#9AAAC4' }}>{caseData.title} #{caseData.id.slice(0, 8)}</span>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a
            href="/legal/dashboard"
            style={{
              color: '#9AAAC4',
              textDecoration: 'none',
              fontSize: 14,
              padding: '8px 12px',
              borderRadius: 8,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            대시보드
          </a>
        </nav>
      </header>

      {/* 메인 레이아웃 (좌우 분할) */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '40% 60%',
          overflow: 'hidden',
        }}
      >
        {/* 좌 패널: 분석 정보 + 채팅 */}
        <section
          aria-label="AI 상담 채팅"
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* 분석 요청 정보 */}
          <div
            style={{
              padding: '20px 24px',
              background: '#141929',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 13, color: '#9AAAC4' }}>카테고리: {caseData.category}</div>
            <div style={{ fontSize: 14, color: '#F0F4FF', marginTop: 6, lineHeight: 1.5 }}>
              {caseData.description}
            </div>
            {caseData.incidentDate && (
              <div style={{ fontSize: 12, color: '#5C6E8A', marginTop: 6 }}>
                발생일: {caseData.incidentDate.split('T')[0]}
              </div>
            )}
          </div>

          {/* 채팅 내역 */}
          <div
            role="log"
            aria-label="AI 상담 대화 내역"
            aria-live="polite"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.map((msg) =>
              msg.role === 'ai' ? (
                <AiBubble key={msg.id} message={msg} />
              ) : (
                <UserBubble key={msg.id} content={msg.content} />
              )
            )}
            {isStreaming && <StreamingIndicator />}
            <div ref={chatEndRef} />
          </div>

          {/* 입력창 */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                background: '#252D42',
                borderRadius: 9999,
                padding: '8px 8px 8px 16px',
                alignItems: 'flex-end',
              }}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="추가로 궁금한 점을 입력하세요..."
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  color: '#F0F4FF',
                  resize: 'none',
                  maxHeight: 120,
                  lineHeight: 1.5,
                  padding: '4px 0',
                  fontFamily: 'inherit',
                }}
                aria-label="추가 질문 입력"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: inputValue.trim() ? '#2563EB' : '#3A4A60',
                  border: 'none',
                  color: '#fff',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  minWidth: 44,
                  minHeight: 44,
                  transition: 'background 150ms',
                }}
                aria-label="전송"
                aria-disabled={!inputValue.trim() || isStreaming}
              >
                ↑
              </button>
            </div>
          </div>
        </section>

        {/* 우 패널: 승소 가능성 + 분석 결과 */}
        <section
          aria-label="분석 결과"
          style={{
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* 승소 가능성 게이지 */}
          <div
            style={{ background: '#1C2236', borderRadius: 16, padding: 24 }}
            aria-label={`승소 가능성 ${winRate}%`}
          >
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#9AAAC4' }}>판례 기반 승소 가능성</p>
            <div style={{ fontSize: 48, fontWeight: 800, color: winRateColor, lineHeight: 1 }}>
              {winRate}%
            </div>
            <div
              role="progressbar"
              aria-valuenow={winRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="승소 가능성 진행 바"
              style={{
                height: 8,
                borderRadius: 9999,
                background: '#252D42',
                marginTop: 16,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${winRate}%`,
                  background: winRateColor,
                  borderRadius: 9999,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            {/* 신뢰도 표시 */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#5C6E8A' }}>AI 신뢰도:</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: confidence >= 70 ? '#0C9D61' : confidence >= 40 ? '#FE9B0E' : '#EC2D30' }}>
                {confidence}%
              </span>
            </div>
            {/* 경고 메시지 */}
            {warnings.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, background: '#252D42', borderRadius: 8 }}>
                {warnings.map((w, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0', fontSize: 12, color: '#FE9B0E' }}>
                    ⚠️ {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 분석 근거 — 판례 인용 */}
          <div style={{ background: '#1C2236', borderRadius: 16, padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              분석 근거 — 판례 인용 {relatedCases.length}건
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {relatedCases.length > 0 ? (
                relatedCases.map((p) => (
                  <PrecedentCard
                    key={p.caseNumber}
                    court={p.courtName}
                    id={p.caseNumber}
                    date={p.judgmentDate.split('T')[0].replace(/-/g, '.')}
                    summary={p.summary}
                  />
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: '#5C6E8A' }}>
                  유사 판례가 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 관련 법령 */}
          <div style={{ background: '#1C2236', borderRadius: 16, padding: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>관련 법령</h2>
            {legalBasis.length > 0 ? (
              legalBasis.map((basis, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    background: '#252D42',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#9AAAC4',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{basis.law}</span>
                  {basis.article && <span> {basis.article}</span>}
                  {basis.relevance && (
                    <span style={{ display: 'block', fontSize: 12, color: '#5C6E8A', marginTop: 4 }}>
                      {basis.relevance}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 16, color: '#5C6E8A' }}>
                관련 법령 정보가 없습니다.
              </div>
            )}
          </div>

          {/* 추천 다음 액션 */}
          <div style={{ background: '#1C2236', borderRadius: 16, padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>추천 다음 액션</h2>
            {analysis?.recommendations && analysis.recommendations.length > 0 && (
              <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                {analysis.recommendations.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#9AAAC4', marginBottom: 6 }}>{r}</li>
                ))}
              </ul>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a
                href={`/legal/document-generation?caseId=${caseId}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px 20px',
                  background: '#2563EB',
                  color: '#fff',
                  borderRadius: 9999,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: 'none',
                  minHeight: 44,
                  lineHeight: '20px',
                }}
              >
                내용증명 생성 →
              </a>
              <button
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  color: '#2563EB',
                  border: '1px solid #2563EB',
                  borderRadius: 9999,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                변호사 연결 →
              </button>
            </div>
          </div>

          {/* 면책 고지 — 우 패널 하단 */}
          <DisclaimerBanner variant="inline" />
        </section>
      </main>
    </div>
  );
}

function AiBubble({ message }: { message: Message }) {
  const confidenceColor =
    message.confidence === 'high'
      ? '#0C9D61'
      : message.confidence === 'mid'
        ? '#FE9B0E'
        : '#EC2D30';
  const confidenceLabel =
    message.confidence === 'high' ? '높음' : message.confidence === 'mid' ? '중간' : '낮음';

  return (
    <div style={{ display: 'flex', gap: 10, maxWidth: '85%' }}>
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          background: '#252D42',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
      >
        ⚖️
      </div>
      <div>
        <div
          style={{
            background: '#1C2236',
            borderRadius: '0 16px 16px 16px',
            padding: '12px 16px',
            fontSize: 14,
            lineHeight: 1.6,
            color: '#F0F4FF',
          }}
        >
          {message.content}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {message.citations?.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                color: '#60A5FA',
                cursor: 'pointer',
              }}
            >
              [{c}]
            </span>
          ))}
          {message.confidence && (
            <span
              style={{
                fontSize: 11,
                color: confidenceColor,
                background: `${confidenceColor}22`,
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              신뢰도: {confidenceLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          background: '#1C2A4A',
          borderRadius: '16px 0 16px 16px',
          padding: '12px 16px',
          fontSize: 14,
          lineHeight: 1.6,
          color: '#F0F4FF',
          maxWidth: '80%',
        }}
      >
        {content}
      </div>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, maxWidth: '85%' }}>
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          background: '#252D42',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
      >
        ⚖️
      </div>
      <div
        role="status"
        aria-label="AI 응답 생성 중"
        style={{
          background: '#1C2236',
          borderRadius: '0 16px 16px 16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 180,
        }}
      >
        {[80, 100, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: 12,
              background: '#252D42',
              borderRadius: 4,
              width: `${w}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PrecedentCard({
  court,
  id,
  date,
  summary,
}: {
  court: string;
  id: string;
  date: string;
  summary: string;
}) {
  const courtColor =
    court === '대법원' ? '#EC2D30' : court.includes('고법') ? '#FE9B0E' : '#9AAAC4';

  return (
    <div
      style={{
        background: '#252D42',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'opacity 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: courtColor,
            background: `${courtColor}22`,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {court}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{id}</span>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: '#9AAAC4', lineHeight: 1.5 }}>
        {summary}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#5C6E8A' }}>{date}</span>
        <span style={{ fontSize: 12, color: '#60A5FA' }}>원문 보기 →</span>
      </div>
    </div>
  );
}

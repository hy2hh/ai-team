'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DisclaimerBanner } from '@/components/legal/disclaimer-banner';
import { legalApi } from '@/lib/legal-api';
import type { GeneratedDocument } from '@/lib/legal-types';

type DocType = 'notice' | 'contract' | 'complaint' | 'agreement';
type Step = 1 | 2;

interface DocTypeOption {
  id: DocType;
  icon: string;
  label: string;
  description: string;
}

const DOC_TYPES: DocTypeOption[] = [
  { id: 'notice', icon: '📄', label: '내용증명', description: '미지급 임금·보증금 반환 촉구' },
  { id: 'contract', icon: '📑', label: '계약서', description: '각종 계약서 작성' },
  { id: 'complaint', icon: '⚖️', label: '고소장', description: '형사 고소장 작성' },
  { id: 'agreement', icon: '🤝', label: '합의서', description: '합의서·조정서 작성' },
];

interface FormState {
  docType: DocType | null;
  senderName: string;
  senderAddress: string;
  senderContact: string;
  receiverName: string;
  receiverAddress: string;
  claimAmount: string;
  claimReason: string;
}

const INITIAL_FORM: FormState = {
  docType: null,
  senderName: '',
  senderAddress: '',
  senderContact: '',
  receiverName: '',
  receiverAddress: '',
  claimAmount: '',
  claimReason: '',
};

export default function DocumentGenerationPage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('caseId');

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDocType = DOC_TYPES.find((d) => d.id === form.docType);

  const handleFieldChange = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleDocTypeSelect = useCallback((id: DocType) => {
    setForm((prev) => ({ ...prev, docType: id }));
  }, []);

  const canProceedStep1 =
    form.docType &&
    form.senderName.trim() &&
    form.receiverName.trim() &&
    form.claimReason.trim();

  const handleNextStep = useCallback(async () => {
    if (!canProceedStep1 || !caseId) return;
    setIsGenerating(true);
    setError(null);

    try {
      // API 연동: 문서 생성
      const typeMap: Record<DocType, 'certified_content' | 'contract_review' | 'legal_notice'> = {
        notice: 'certified_content',
        contract: 'contract_review',
        complaint: 'legal_notice',
        agreement: 'legal_notice',
      };

      const doc = await legalApi.createDocument({
        caseId,
        type: typeMap[form.docType!],
        senderName: form.senderName,
        senderAddress: form.senderAddress,
        recipientName: form.receiverName,
        recipientAddress: form.receiverAddress,
        content: form.claimReason,
      });

      setGeneratedDoc(doc);
      setStep(2);
    } catch (err) {
      console.error('문서 생성 실패:', err);
      setError('문서 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [canProceedStep1, caseId, form]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0F1A',
        color: '#F0F4FF',
        fontFamily: 'Pretendard, -apple-system, sans-serif',
        paddingBottom: 80,
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          background: '#141929',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <a
          href="/legal/dashboard"
          style={{
            color: '#9AAAC4',
            textDecoration: 'none',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="대시보드로 돌아가기"
        >
          ← 대시보드
        </a>
        <span style={{ color: '#3A4A60' }}>|</span>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>법률 문서 생성</h1>

        {/* Step Indicator */}
        <div
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
          aria-label="진행 단계"
        >
          <StepDot label="문서 설정" active={step === 1} done={step === 2} />
          <div style={{ width: 32, height: 1, background: '#252D42' }} />
          <StepDot label="최종 확인" active={step === 2} done={false} />
        </div>
      </header>

      {/* 메인 레이아웃 */}
      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 45%) minmax(0, 55%)',
          gap: 0,
          maxWidth: 1400,
          margin: '0 auto',
          padding: '32px 24px',
          gap: 24,
        }}
      >
        {/* 좌: 입력 폼 */}
        <section aria-label="문서 설정 폼">
          {/* 문서 유형 선택 */}
          <div
            style={{
              background: '#1C2236',
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>문서 유형 선택</h2>
            <div
              role="radiogroup"
              aria-label="문서 유형"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
            >
              {DOC_TYPES.map((dt) => {
                const selected = form.docType === dt.id;
                return (
                  <button
                    key={dt.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleDocTypeSelect(dt.id)}
                    style={{
                      background: selected ? '#1C2A4A' : '#252D42',
                      border: `1px solid ${selected ? '#2563EB' : '#252D42'}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      cursor: 'pointer',
                      color: '#F0F4FF',
                      textAlign: 'left',
                      minHeight: 72,
                      transition: 'all 150ms',
                    }}
                  >
                    <span style={{ fontSize: 20 }} aria-hidden="true">
                      {dt.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: selected ? 700 : 500,
                          color: selected ? '#60A5FA' : '#F0F4FF',
                        }}
                      >
                        {dt.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#9AAAC4', marginTop: 2 }}>
                        {dt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 발신인 정보 */}
          <div
            style={{
              background: '#1C2236',
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>발신인 정보</h2>
            <FormFields
              prefix="sender"
              fields={[
                { key: 'senderName', label: '이름', placeholder: '홍길동' },
                { key: 'senderAddress', label: '주소', placeholder: '서울시 강남구...' },
                { key: 'senderContact', label: '연락처', placeholder: '010-0000-0000' },
              ]}
              values={form}
              onChange={handleFieldChange}
            />
          </div>

          {/* 수신인 정보 */}
          <div
            style={{
              background: '#1C2236',
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>수신인 정보</h2>
            <FormFields
              prefix="receiver"
              fields={[
                { key: 'receiverName', label: '이름 / 법인명', placeholder: '○○ 주식회사' },
                { key: 'receiverAddress', label: '주소', placeholder: '서울시 중구...' },
              ]}
              values={form}
              onChange={handleFieldChange}
            />
          </div>

          {/* 청구 내용 */}
          <div
            style={{
              background: '#1C2236',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>청구 내용</h2>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#9AAAC4', display: 'block', marginBottom: 6 }}>
                청구 금액 (선택)
              </span>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#252D42', borderRadius: 12, padding: '0 14px' }}
              >
                <input
                  type="number"
                  value={form.claimAmount}
                  onChange={(e) => handleFieldChange('claimAmount', e.target.value)}
                  placeholder="0"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 15,
                    color: '#F0F4FF',
                    padding: '12px 0',
                    minHeight: 44,
                  }}
                />
                <span style={{ color: '#9AAAC4', fontSize: 14, flexShrink: 0 }}>원</span>
              </div>
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 14, color: '#9AAAC4', display: 'block', marginBottom: 6 }}>
                청구 사유 <span style={{ color: '#EC2D30' }}>*</span>
              </span>
              <textarea
                value={form.claimReason}
                onChange={(e) => handleFieldChange('claimReason', e.target.value)}
                placeholder="구체적인 사유를 입력하세요. 상세할수록 더 정확한 문서가 생성됩니다."
                rows={4}
                style={{
                  width: '100%',
                  background: '#252D42',
                  border: '1px solid #252D42',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: '#F0F4FF',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
              />
            </label>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{ marginBottom: 16, padding: 12, background: '#2D1F1F', borderRadius: 8, border: '1px solid #EC2D30' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#EC2D30' }}>{error}</p>
            </div>
          )}

          {/* 케이스 ID 없음 경고 */}
          {!caseId && (
            <div style={{ marginBottom: 16, padding: 12, background: '#2D2A1F', borderRadius: 8, border: '1px solid #FE9B0E' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#FE9B0E' }}>
                케이스 ID가 없습니다. <a href="/legal/dashboard" style={{ color: '#60A5FA', textDecoration: 'underline' }}>대시보드</a>에서 케이스를 선택해주세요.
              </p>
            </div>
          )}

          {/* 다음 단계 버튼 */}
          <button
            onClick={handleNextStep}
            disabled={!canProceedStep1 || isGenerating || !caseId}
            style={{
              width: '100%',
              padding: '16px 24px',
              background: canProceedStep1 && caseId ? '#2563EB' : '#252D42',
              color: canProceedStep1 && caseId ? '#fff' : '#3A4A60',
              border: 'none',
              borderRadius: 9999,
              fontSize: 16,
              fontWeight: 700,
              cursor: canProceedStep1 && caseId ? 'pointer' : 'not-allowed',
              transition: 'background 150ms',
              minHeight: 56,
            }}
            aria-disabled={!canProceedStep1 || !caseId}
          >
            {isGenerating ? 'AI가 문서를 생성 중입니다...' : '문서 생성 →'}
          </button>
        </section>

        {/* 우: 실시간 문서 미리보기 */}
        <section aria-label="문서 미리보기">
          <div
            style={{
              background: '#1C2236',
              borderRadius: 16,
              padding: 24,
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>실시간 문서 미리보기</h2>

            {isGenerating ? (
              /* 생성 중 skeleton */
              <div role="status" aria-label="문서 생성 중">
                {[80, 100, 65, 90, 55].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      height: 14,
                      background: '#252D42',
                      borderRadius: 4,
                      marginBottom: 10,
                      width: `${w}%`,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
                <p style={{ fontSize: 13, color: '#5C6E8A', textAlign: 'center', marginTop: 16 }}>
                  AI가 문서를 작성 중입니다...
                </p>
              </div>
            ) : step === 2 && generatedDoc ? (
              /* API로 생성된 문서 내용 */
              <div
                contentEditable
                suppressContentEditableWarning
                aria-label="생성된 문서 내용 (편집 가능)"
                style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: '#F0F4FF',
                  outline: 'none',
                  minHeight: 300,
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    borderBottom: '1px solid #252D42',
                    paddingBottom: 16,
                    marginBottom: 16,
                  }}
                >
                  <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    {generatedDoc.title}
                  </p>
                </div>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
                  <tbody>
                    <tr>
                      <td style={{ color: '#9AAAC4', padding: '4px 0', width: 80 }}>발신인</td>
                      <td style={{ padding: '4px 0' }}>{form.senderName || '(미입력)'}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#9AAAC4', padding: '4px 0' }}>수신인</td>
                      <td style={{ padding: '4px 0' }}>{form.receiverName || '(미입력)'}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#9AAAC4', padding: '4px 0' }}>발송일</td>
                      <td style={{ padding: '4px 0' }}>{new Date(generatedDoc.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#9AAAC4', padding: '4px 0' }}>문서 ID</td>
                      <td style={{ padding: '4px 0', fontFamily: 'monospace', fontSize: 11 }}>{generatedDoc.id.slice(0, 8)}</td>
                    </tr>
                  </tbody>
                </table>
                <div
                  style={{
                    background: '#1C2A4A',
                    borderRadius: 8,
                    padding: 16,
                    fontSize: 14,
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                  }}
                  aria-label="AI 생성 본문"
                >
                  {generatedDoc.content}
                </div>
              </div>
            ) : (
              /* 초기 안내 */
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 0',
                  color: '#5C6E8A',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 48, marginBottom: 16 }}>📋</span>
                <p style={{ margin: 0, fontSize: 15 }}>
                  좌측 양식을 작성하면 문서가 자동 생성됩니다
                </p>
              </div>
            )}

            {/* 면책 고지 — 미리보기 패널 하단 (항상 표시) */}
            <DisclaimerBanner variant="inline" />

            {/* 다운로드 / 결제 버튼 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    background: 'transparent',
                    color: '#2563EB',
                    border: '1px solid #2563EB',
                    borderRadius: 9999,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  PDF 다운로드 ↓
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 결제 배너 — 하단 고정 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#1C2236',
          border: '1px solid #2563EB',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 50,
        }}
        aria-label="결제 안내"
      >
        <div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>💳 건별 결제</span>
          <span
            style={{
              marginLeft: 12,
              fontSize: 22,
              fontWeight: 800,
              color: '#60A5FA',
            }}
          >
            ₩9,900
          </span>
          <span style={{ marginLeft: 4, fontSize: 14, color: '#9AAAC4' }}>/건</span>
        </div>
        <button
          disabled={step !== 2}
          style={{
            padding: '10px 24px',
            background: step === 2 ? '#2563EB' : '#252D42',
            color: step === 2 ? '#fff' : '#3A4A60',
            border: 'none',
            borderRadius: 9999,
            fontSize: 15,
            fontWeight: 700,
            cursor: step === 2 ? 'pointer' : 'not-allowed',
            minHeight: 44,
            transition: 'background 150ms',
          }}
          aria-disabled={step !== 2}
        >
          결제 후 다운로드 →
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StepDot({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        aria-current={active ? 'step' : undefined}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: done ? '#0C9D61' : active ? '#2563EB' : 'transparent',
          border: done || active ? 'none' : '1.5px solid #5C6E8A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          color: '#fff',
        }}
      >
        {done ? '✓' : null}
      </div>
      <span style={{ fontSize: 11, color: active ? '#F0F4FF' : '#5C6E8A' }}>{label}</span>
    </div>
  );
}

function FormFields({
  fields,
  values,
  onChange,
}: {
  prefix: string;
  fields: Array<{ key: keyof FormState; label: string; placeholder: string }>;
  values: FormState;
  onChange: (key: keyof FormState, value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.map(({ key, label, placeholder }) => (
        <label key={key} style={{ display: 'block' }}>
          <span style={{ fontSize: 13, color: '#9AAAC4', display: 'block', marginBottom: 6 }}>
            {label}
          </span>
          <input
            type="text"
            value={values[key] as string}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              background: '#252D42',
              border: '1px solid #252D42',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 15,
              color: '#F0F4FF',
              outline: 'none',
              boxSizing: 'border-box',
              minHeight: 44,
              fontFamily: 'inherit',
            }}
          />
        </label>
      ))}
    </div>
  );
}

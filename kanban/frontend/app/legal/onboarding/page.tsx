'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DisclaimerBanner } from '@/components/legal/disclaimer-banner';
import { legalApi } from '@/lib/legal-api';

type Category = {
  id: string;
  icon: string;
  label: string;
};

const CATEGORIES: Category[] = [
  { id: 'labor', icon: '👷', label: '노동·임금' },
  { id: 'contract', icon: '📑', label: '계약·거래' },
  { id: 'lease', icon: '🏠', label: '임대차' },
  { id: 'family', icon: '👨‍👩‍👧', label: '이혼·가족' },
  { id: 'criminal', icon: '🚨', label: '형사' },
  { id: 'damages', icon: '💰', label: '손해배상' },
  { id: 'inheritance', icon: '📜', label: '상속' },
  { id: 'other', icon: '⚖️', label: '기타' },
];

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [situation, setSituation] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState<'subscription' | 'single' | null>(null);

  const handleCategorySelect = useCallback((id: string) => {
    setSelectedCategory(id);
  }, []);

  const handleStart = useCallback(() => {
    if (plan) {
      router.push('/legal/analysis');
    }
  }, [plan, router]);

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
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: '#60A5FA' }}>⚖️ AI법률</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: '#9AAAC4',
              border: 'none',
              fontSize: 14,
              cursor: 'pointer',
              minHeight: 44,
              borderRadius: 8,
            }}
          >
            로그인
          </button>
          <button
            style={{
              padding: '8px 20px',
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            시작하기
          </button>
        </div>
      </header>

      {/* Step Indicator */}
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '32px 0 0' }}
        role="navigation"
        aria-label="온보딩 단계"
      >
        {([1, 2, 3] as Step[]).map((s, i) => (
          <>
            <StepDot key={s} step={s} current={step} />
            {i < 2 && (
              <div
                key={`line-${s}`}
                style={{ width: 40, height: 1, background: step > s ? '#2563EB' : '#252D42' }}
              />
            )}
          </>
        ))}
      </div>

      {/* 메인 카드 */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px 100px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            background: '#1C2236',
            borderRadius: 16,
            padding: 32,
          }}
        >
          {step === 1 && (
            <Step1
              selected={selectedCategory}
              onSelect={handleCategorySelect}
              onNext={() => selectedCategory && setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              situation={situation}
              date={date}
              amount={amount}
              onSituationChange={setSituation}
              onDateChange={setDate}
              onAmountChange={setAmount}
              onBack={() => setStep(1)}
              onNext={() => situation.trim() && setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3
              plan={plan}
              onPlanSelect={setPlan}
              onBack={() => setStep(2)}
              onStart={handleStart}
            />
          )}
        </div>
      </main>

      {/* 면책 고지 — 화면 하단 고정 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        <DisclaimerBanner variant="fixed-bottom" />
      </div>
    </div>
  );
}

function StepDot({ step, current }: { step: Step; current: Step }) {
  const done = current > step;
  const active = current === step;
  return (
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
  );
}

function Step1({
  selected,
  onSelect,
  onNext,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
        법률 문제 유형을 선택해주세요
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9AAAC4' }}>어떤 상황이신가요?</p>
      <div
        role="radiogroup"
        aria-label="법률 문제 유형"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(cat.id)}
              style={{
                background: isSelected ? '#1C2A4A' : '#252D42',
                border: `1px solid ${isSelected ? '#2563EB' : '#252D42'}`,
                borderRadius: 12,
                padding: '14px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                color: isSelected ? '#60A5FA' : '#F0F4FF',
                fontSize: 15,
                fontWeight: isSelected ? 700 : 500,
                minHeight: 56,
                transition: 'all 150ms',
              }}
            >
              <span style={{ fontSize: 20 }} aria-hidden="true">
                {cat.icon}
              </span>
              {cat.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        style={{
          width: '100%',
          padding: '14px',
          background: selected ? '#2563EB' : '#252D42',
          color: selected ? '#fff' : '#3A4A60',
          border: 'none',
          borderRadius: 9999,
          fontSize: 16,
          fontWeight: 700,
          cursor: selected ? 'pointer' : 'not-allowed',
          minHeight: 52,
          transition: 'background 150ms',
        }}
        aria-disabled={!selected}
      >
        다음 단계 →
      </button>
    </>
  );
}

function Step2({
  situation,
  date,
  amount,
  onSituationChange,
  onDateChange,
  onAmountChange,
  onBack,
  onNext,
}: {
  situation: string;
  date: string;
  amount: string;
  onSituationChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#9AAAC4',
          cursor: 'pointer',
          padding: '0 0 16px',
          fontSize: 14,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ← 이전
      </button>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>상황 상세 입력</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <label style={{ display: 'block' }}>
          <span style={{ fontSize: 14, color: '#9AAAC4', display: 'block', marginBottom: 8 }}>
            어떤 일이 있었나요? <span style={{ color: '#EC2D30' }}>*</span>
          </span>
          <textarea
            value={situation}
            onChange={(e) => onSituationChange(e.target.value)}
            rows={4}
            placeholder="구체적으로 설명해 주세요. 상세할수록 더 정확한 분석이 됩니다."
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
          <span style={{ fontSize: 12, color: '#5C6E8A', marginTop: 4, display: 'block' }}>
            상세할수록 더 정확한 분석이 됩니다
          </span>
        </label>
        <label style={{ display: 'block' }}>
          <span style={{ fontSize: 14, color: '#9AAAC4', display: 'block', marginBottom: 8 }}>
            발생 시점
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
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
        <label style={{ display: 'block' }}>
          <span style={{ fontSize: 14, color: '#9AAAC4', display: 'block', marginBottom: 8 }}>
            관련 금액 (선택)
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#252D42',
              borderRadius: 12,
              padding: '0 14px',
            }}
          >
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                color: '#F0F4FF',
                padding: '10px 0',
                minHeight: 44,
              }}
            />
            <span style={{ color: '#9AAAC4', fontSize: 14 }}>원</span>
          </div>
        </label>
      </div>
      <button
        onClick={onNext}
        disabled={!situation.trim()}
        style={{
          width: '100%',
          padding: '14px',
          background: situation.trim() ? '#2563EB' : '#252D42',
          color: situation.trim() ? '#fff' : '#3A4A60',
          border: 'none',
          borderRadius: 9999,
          fontSize: 16,
          fontWeight: 700,
          cursor: situation.trim() ? 'pointer' : 'not-allowed',
          minHeight: 52,
          transition: 'background 150ms',
        }}
        aria-disabled={!situation.trim()}
      >
        다음 단계 →
      </button>
    </>
  );
}

function Step3({
  plan,
  onPlanSelect,
  onBack,
  onStart,
}: {
  plan: 'subscription' | 'single' | null;
  onPlanSelect: (p: 'subscription' | 'single') => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#9AAAC4',
          cursor: 'pointer',
          padding: '0 0 16px',
          fontSize: 14,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ← 이전
      </button>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>시작 전 확인해주세요</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {/* 구독 플랜 */}
        <PlanCard
          selected={plan === 'subscription'}
          onSelect={() => onPlanSelect('subscription')}
          price="₩39,000/월"
          label="구독 플랜"
          features={['무제한 AI 상담', '케이스 대시보드', '판례 분석 무제한']}
          ctaLabel="구독 시작 →"
          highlight
        />
        {/* 건별 결제 */}
        <PlanCard
          selected={plan === 'single'}
          onSelect={() => onPlanSelect('single')}
          price="₩9,900/건"
          label="건별 결제"
          features={['이번 건만 분석']}
          ctaLabel="건별로 시작 →"
        />
      </div>
      {/* Step3 면책 고지 (인라인 — 결제 선택 시 바로 눈에 보이도록) */}
      <DisclaimerBanner variant="inline" />
      <button
        onClick={onStart}
        disabled={!plan}
        style={{
          width: '100%',
          padding: '14px',
          background: plan ? '#2563EB' : '#252D42',
          color: plan ? '#fff' : '#3A4A60',
          border: 'none',
          borderRadius: 9999,
          fontSize: 16,
          fontWeight: 700,
          cursor: plan ? 'pointer' : 'not-allowed',
          minHeight: 52,
          marginTop: 16,
          transition: 'background 150ms',
        }}
        aria-disabled={!plan}
      >
        분석 시작
      </button>
    </>
  );
}

function PlanCard({
  selected,
  onSelect,
  price,
  label,
  features,
  ctaLabel,
  highlight,
}: {
  selected: boolean;
  onSelect: () => void;
  price: string;
  label: string;
  features: string[];
  ctaLabel: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        background: '#1C2236',
        border: `1px solid ${selected ? '#2563EB' : highlight ? '#2563EB' : '#252D42'}`,
        borderRadius: 16,
        padding: 20,
        textAlign: 'left',
        cursor: 'pointer',
        color: '#F0F4FF',
        width: '100%',
        transition: 'all 150ms',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#9AAAC4' }}>{label}</span>
        {selected && (
          <span
            style={{
              background: '#2563EB',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 9999,
            }}
          >
            선택됨
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#60A5FA', marginBottom: 12 }}>{price}</div>
      <ul style={{ margin: '0 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {features.map((f) => (
          <li key={f} style={{ fontSize: 14, color: '#9AAAC4', display: 'flex', gap: 8 }}>
            <span style={{ color: '#0C9D61' }}>•</span> {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

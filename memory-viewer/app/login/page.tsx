'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '비밀번호가 올바르지 않습니다');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-[100dvh]"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div
        className="w-[calc(100%-40px)] max-w-[360px] rounded-[var(--radius-lg)] p-8"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* 헤더 */}
        <div className="mb-8">
          <div
            className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center mb-4"
            style={{ background: 'var(--color-point-subtle)' }}
          >
            <Database size={18} style={{ color: 'var(--color-point-light)' }} />
          </div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              lineHeight: 'var(--line-height-tight)',
            }}
          >
            Memory Viewer
          </h1>
          <p
            className="mt-1.5"
            style={{
              fontSize: 'var(--text-body-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            관리자 전용 액세스
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit}>
          {/* 비밀번호 레이블 */}
          <label
            htmlFor="password"
            className="block mb-2"
            style={{
              fontSize: 'var(--text-body-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            비밀번호
          </label>

          {/* 비밀번호 인풋 */}
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="비밀번호 입력"
              autoFocus
              className={`input-base w-full h-12 pr-11 pl-4${error ? ' input-error' : ''}`}
              style={{ fontSize: '16px' /* 모바일 zoom 방지 */ }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="btn-eye"
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div
              className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-[var(--radius-sm)]"
              style={{
                background: 'rgba(236, 45, 48, 0.10)',
                border: '1px solid rgba(236, 45, 48, 0.25)',
                fontSize: 'var(--text-body-sm)',
                color: 'var(--color-negative)',
              }}
            >
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 로그인 버튼 — Toss CTA: 56px, radius 12px */}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="btn-primary mt-5"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

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
    <div className="login-page flex items-center justify-center min-h-dvh">
      <div className="login-card w-full animate-scale-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="login-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
                fill="var(--blue)"
                opacity="0.2"
              />
              <circle cx="12" cy="12" r="3" fill="var(--blue)" />
            </svg>
          </div>
          <h1 className="login-heading text-balance">Memory Viewer</h1>
          <p className="login-subtitle">관리자 전용 액세스</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label htmlFor="password" className="login-label">
            비밀번호
          </label>

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
              className={`input-base input-password-pad w-full${error ? ' input-error' : ''}`}
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

          {/* Error */}
          {error && (
            <div className="error-banner flex items-center gap-2 mt-3 px-3 py-2 animate-content-enter">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="btn-primary login-submit"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

# Frontend Review Checklist

프론트엔드 산출물(Designer/Frontend) 코드 리뷰 시 사용하는 검증 체크리스트.
v0 (Vercel) 디자인/코딩 가이드라인 기반. 위반 발견 시 심각도 분류 후 보고.

---

## 1. Color & Design Token Violations

### Critical
- [ ] 직접 색상 클래스 사용 (`text-white`, `bg-black`, `bg-gray-500` 등) → 시맨틱 토큰 필수
- [ ] 배경색 변경 시 텍스트 색상 미지정 → 대비 깨짐 위험
- [ ] WCAG AA 대비 미달 (일반 텍스트 4.5:1, 대형 텍스트 3:1)

### Important
- [ ] 팔레트 5색 초과 사용
- [ ] gradient에 반대 온도 색상 혼합 (pink→green, orange→blue 등)
- [ ] 다크 모드 토큰 미정의

### 검증 방법
```bash
# 직접 색상 클래스 사용 검출
grep -rn 'text-white\|bg-white\|bg-black\|text-black\|bg-gray-\|text-gray-' --include='*.tsx' --include='*.jsx'

# 시맨틱 토큰 정의 확인
grep -c '\-\-background\|\-\-foreground\|\-\-primary\|\-\-secondary\|\-\-accent\|\-\-muted\|\-\-destructive' app/globals.css
```

---

## 2. Typography Violations

### Critical
- [ ] 14px 미만 폰트 사이즈 사용
- [ ] 3개 이상 폰트 패밀리 사용

### Important
- [ ] body text line-height 1.4 미만
- [ ] decorative 폰트를 본문에 사용
- [ ] `next/font` 미사용 (직접 CSS @import 또는 <link>)

### 검증 방법
```bash
# 10-13px 폰트 사이즈 검출
grep -rn 'text-\[1[0-3]px\]\|font-size:\s*1[0-3]px' --include='*.tsx' --include='*.css'

# 폰트 패밀리 수 확인
grep -rn 'fontFamily\|font-family' --include='*.ts' --include='*.css' | grep -v node_modules
```

---

## 3. Layout & Spacing Violations

### Critical
- [ ] `space-*` 클래스 사용 → `gap-*`로 대체 필요
- [ ] 같은 요소에 margin/padding + gap 혼용
- [ ] float/absolute positioning 남용 (flex/grid 대체 가능 시)

### Important
- [ ] arbitrary 값 사용 (`p-[16px]`, `mx-[8px]`) → Tailwind 표준 스케일로 대체
- [ ] 모바일 breakpoint 누락 (md: 이상만 있고 base 미정의)

### 검증 방법
```bash
# space-* 사용 검출
grep -rn 'space-x-\|space-y-' --include='*.tsx' --include='*.jsx'

# arbitrary 값 사용 검출
grep -rn '\-\[.*px\]\|\-\[.*rem\]' --include='*.tsx' --include='*.jsx' | head -20
```

---

## 4. Mobile & Accessibility Violations

### Critical
- [ ] 터치 타겟 44px 미만 (버튼, 링크, 인터랙티브 요소)
- [ ] viewport `maximumScale: 1` 미설정 (iOS Safari 자동줌)
- [ ] 텍스트 input 16px 미만 (iOS Safari 자동줌 트리거)
- [ ] 비장식 이미지 alt 텍스트 누락

### Important
- [ ] 시맨틱 HTML 미사용 (`div` 남용, `main`/`header`/`nav` 미사용)
- [ ] ARIA role/attribute 누락
- [ ] 키보드 접근 불가 인터랙티브 요소
- [ ] focus-visible 스타일 미정의
- [ ] `<html>` 태그에 `bg-background` 미설정

### Minor
- [ ] `sr-only` 스크린 리더 텍스트 누락
- [ ] reduced-motion 미대응
- [ ] 제목에 `text-balance`/`text-pretty` 미적용

### 검증 방법
```bash
# viewport 설정 확인
grep -rn 'maximumScale\|maximumscale' --include='*.tsx' --include='*.ts' app/layout*

# alt 텍스트 누락 검출
grep -rn '<img\|<Image' --include='*.tsx' | grep -v 'alt='

# 시맨틱 HTML 사용 확인
grep -rn '<main\|<header\|<nav\|<section\|<article\|<aside' --include='*.tsx' | wc -l
```

---

## 5. Data Fetching & State Violations

### Critical
- [ ] `useEffect` 내 `fetch`/`axios` 호출 → SWR 또는 RSC로 대체
- [ ] `localStorage`/`sessionStorage`로 데이터 영속화 (명시적 요청 없이)
- [ ] mock 인증 구현 (실제 보안 패턴 미적용)

### Important
- [ ] SWR 미사용 시 컴포넌트 간 상태 동기화 누락
- [ ] SQL injection 취약 (parameterized queries 미사용)
- [ ] 인증 토큰 localStorage 저장 → HTTP-only 쿠키 필수

### 검증 방법
```bash
# useEffect 내 fetch 검출
grep -A5 'useEffect' --include='*.tsx' -rn | grep -E 'fetch\(|axios\.|\.get\(|\.post\('

# localStorage 사용 검출
grep -rn 'localStorage\|sessionStorage' --include='*.tsx' --include='*.ts'
```

---

## 6. Component & Code Pattern Violations

### Critical
- [ ] page.tsx 한 파일에 전체 UI 구현 (컴포넌트 분리 미흡)
- [ ] 배럴 파일(`index.ts`) 통한 import → 개별 파일 직접 import 필요

### Important
- [ ] shadcn/ui 기본 파일 불필요 재생성 (`components/ui/*`, `lib/utils.ts`)
- [ ] 폼에 `FieldGroup`/`Field` 대신 `div` + `space-y-*` 사용
- [ ] 빈 상태에 `Empty` 컴포넌트 미사용
- [ ] emoji를 아이콘 대신 사용
- [ ] SVG 패스 수동 작성 (복잡한 일러스트/지도)

### Minor
- [ ] 아이콘 크기 비일관 (16/20/24px 외 사이즈)
- [ ] `React.memo` 미적용 컴포넌트
- [ ] layout.tsx metadata (title, description) 미설정

### 검증 방법
```bash
# 배럴 import 검출
grep -rn "from '\.\./.*index'" --include='*.tsx' --include='*.ts'

# React.memo 적용률
echo "총 컴포넌트: $(grep -rln 'export.*function\|export.*const.*=' --include='*.tsx' | wc -l)"
echo "memo 적용: $(grep -rln 'React\.memo\|memo(' --include='*.tsx' | wc -l)"

# emoji 아이콘 사용 검출 (일반적 패턴)
grep -rPn '[\x{1F300}-\x{1F9FF}]' --include='*.tsx' || echo "emoji 없음"
```

---

## 7. Next.js 16 Violations

### Critical
- [ ] `params`/`searchParams`/`headers`/`cookies` 동기 접근 (await 필수)
- [ ] `revalidateTag()` cacheLife profile 미지정

### Important
- [ ] React Compiler 미활성화 (`reactCompiler: true` 미설정)

### 검증 방법
```bash
# params/searchParams 동기 접근 검출 (await 없이 직접 사용)
grep -rn 'params\.' --include='*.tsx' app/ | grep -v await | head -10
```

---

## 심각도 기준

| 심각도 | 기준 | 조치 |
|--------|------|------|
| **Critical** | 접근성 위반, 보안 취약점, 런타임 에러 유발 | 즉시 수정 필수, FAIL 판정 |
| **Important** | 성능 저하, 유지보수 어려움, 컨벤션 위반 | 수정 권고, CONDITIONAL PASS 가능 |
| **Minor** | 개선 여지, 일관성 부족 | 기록 후 PASS 가능 |

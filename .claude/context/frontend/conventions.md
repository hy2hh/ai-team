# Frontend Conventions

v0 (Vercel) 코딩 가이드라인 기반 프론트엔드 구현 규칙.
디자인 토큰/팔레트/타이포 정의는 `designer/conventions.md` 참조 — 여기선 **구현**만 다룬다.

---

## 1. Next.js App Router Defaults

### 기본 원칙
- 별도 지시 없으면 **Next.js App Router** 기본
- 한 파일에 모든 UI 넣지 말 것 — `page.tsx`는 컴포넌트를 import만 하는 구조
- `layout.tsx` metadata (title, description) 및 viewport 반드시 설정

### Next.js 16 변경사항
- `params`, `searchParams`, `headers`, `cookies`는 **반드시 await** (동기 접근 불가)
- Turbopack이 기본 번들러 (stable)
- React Compiler 지원: `next.config.js`에 `reactCompiler: true`
- Cache API: `revalidateTag()`에 cacheLife profile 필수, `updateTag()` / `refresh()` 신규 API

### viewport 설정 (iOS Safari)
```tsx
// layout.tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // iOS 입력 자동줌 방지
};
```

### HTML root 배경색
```tsx
// layout.tsx — 시맨틱 토큰으로 배경색 지정
<html className="bg-background">
```

---

## 2. 데이터 페칭 & 상태 관리

### Hard Rules
- **useEffect 금지 범위** (SWR/React Query 필수): 외부 API 호출, localStorage·sessionStorage·IndexedDB 읽기, WebSocket 데이터 수신
- **useEffect 허용 범위**: DOM 이벤트 리스너 등록/해제, 외부 라이브러리 초기화, 애니메이션·타이머 등 데이터 아닌 사이드 이펙트
- **SWR**: 데이터 페칭 + 캐싱 + 컴포넌트 간 클라이언트 상태 동기화
- **localStorage 데이터 영속화 금지** — 명시적 요청 시만 허용, 기본은 DB 연동

### 인증 패턴
- Supabase 사용 시: native Supabase Auth + RLS
- 커스텀 인증 시: bcrypt 해싱 + HTTP-only 쿠키 세션 + DB 기반 유저 스토리지
- **mock 인증 구현 금지** — 항상 실제 보안 패턴 적용
- SQL injection 방지: parameterized queries 필수

---

## 3. JSX & 코드 패턴

### JSX 이스케이핑
```tsx
// NG
<div>1 + 1 < 3</div>

// OK
<div>{'1 + 1 < 3'}</div>
```
- `< > { }` 등 특수문자는 반드시 문자열로 감싸기

### Canvas 이미지
```tsx
// CORS 방지 — crossOrigin 필수
const img = new Image();
img.crossOrigin = 'anonymous';
```

### 지리적 맵
- SVG 패스 수동 작성 **절대 금지**
- 반드시 라이브러리 사용: `react-simple-maps`, `Leaflet`, `Mapbox`

---

## 4. 시맨틱 토큰 구현

### globals.css 토큰 정의
- 모든 색상은 시맨틱 토큰으로 — `text-white`, `bg-black` 등 직접 색상 클래스 금지
- `--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--muted`, `--destructive`, `--border`, `--ring`, `--radius`
- 다크 모드: `.dark` 클래스 또는 `prefers-color-scheme`에서 토큰 재정의

### 폰트 구현 (next/font)
```tsx
// layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

// <html className={`${inter.variable} ${mono.variable}`}>
```
```js
// tailwind.config.ts
fontFamily: {
  sans: ['var(--font-inter)'],
  mono: ['var(--font-mono)'],
}
```
- 반드시 `font-sans`, `font-mono` 클래스로 적용

---

## 5. shadcn/ui 컴포넌트 구현

### 기본 파일 (재생성 금지)
- `components/ui/*`, `hooks/use-mobile.ts`, `hooks/use-toast.ts`
- `lib/utils.ts` (cn 함수 포함)
- `app/globals.css`, `tailwind.config.ts`

### 신규 컴포넌트 사용법
| 컴포넌트 | 용도 | 대체하는 패턴 |
|----------|------|--------------|
| `FieldGroup` + `Field` + `FieldLabel` | 폼 레이아웃 | `div` + `space-y-*` |
| `FieldSet` + `FieldLegend` | 체크박스/라디오 그룹 | 커스텀 fieldset |
| `InputGroup` + `InputGroupInput` | 아이콘/버튼 포함 인풋 | raw `Input` + wrapper |
| `InputGroupAddon` | 인풋 부가 요소 | 커스텀 addon div |
| `Empty` | 빈 상태 | 커스텀 empty 마크업 |
| `Spinner` | 로딩 버튼 | 커스텀 로딩 아이콘 |
| `ButtonGroup` | 액션 버튼 묶음 | `ToggleGroup` (토글 전용) |

### 차트
- **Recharts 기반 shadcn/ui charts** 기본 사용
- 별도 차트 라이브러리 도입 전 shadcn charts 먼저 검토

---

## 6. 성능 체크리스트

### Bundle Optimization
- 배럴 파일(`index.ts`) import 회피 — 개별 파일에서 직접 import
- 무거운 컴포넌트: `dynamic(() => import(...))` 사용
- 조건부 모듈 로딩: 필요할 때만 import
- 사용자 인텐트 기반 preload (`onMouseEnter` 등)

### Rendering
- `React.memo` 모든 컴포넌트에 적용 (team convention)
- `useMemo` — 비용 큰 연산, `useCallback` — 안정적 참조
- `useEffectEvent` (React 19.2) — 이벤트 핸들러 안정화
- `<Activity>` 컴포넌트 (React 19.2) — UI 숨기기/복원 시 상태 유지

### SEO
- `layout.tsx`에 metadata 반드시 설정
- PWA manifest.json — 사이트 metadata와 일치

---

## 7. 이미지 & 미디어

- placeholder 이미지 남기지 말 것 — 실제 이미지 사용
- 3D 모델: `glb`, `gltf` 파일
- 오디오: native `<audio>` + JavaScript (별도 라이브러리 불필요)
- 이미지 파일은 `public/images/`에 저장, 코드에서 `/images/filename.png`으로 참조

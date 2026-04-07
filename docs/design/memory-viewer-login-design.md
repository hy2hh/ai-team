# Memory Viewer — 로그인 & 편집 기능 디자인 스펙

> 작성일: 2026-04-07
> 담당: Krusty (Designer)
> 대상 구현: Bart (Frontend)
> 프로젝트: `/Users/sid/git/ai-team/memory-viewer/`

---

## 디자인 시스템 기반

Memory Viewer는 Bifrost 디자인 시스템의 다크 테마를 사용합니다.
모든 토큰은 `app/globals.css` CSS 변수를 직접 참조합니다.

### 컬러 토큰 레퍼런스

| 토큰 | 값 | 용도 |
|------|----|------|
| `--color-bg-base` | `#0d1117` | 최하위 배경 (전체 페이지 배경) |
| `--color-bg-surface` | `#161b27` | 카드, 패널 배경 |
| `--color-bg-elevated` | `#1c2333` | 카드 내부 depth |
| `--color-bg-input` | `#1c2333` | 인풋 필드 배경 |
| `--color-border` | `rgba(255,255,255,0.08)` | 일반 테두리 |
| `--color-border-strong` | `rgba(255,255,255,0.14)` | 강조 테두리 |
| `--color-text-primary` | `#e6edf3` | 제목, 본문 |
| `--color-text-secondary` | `#8b949e` | 보조 텍스트, 레이블 |
| `--color-text-tertiary` | `#6e7681` | 힌트, placeholder |
| `--color-point` | `#5F5BE2` | 브랜드 Primary (CTA 버튼) |
| `--color-point-light` | `#7B78EC` | 다크 배경 위 브랜드 텍스트 |
| `--color-point-hover` | `#4A47C8` | 브랜드 버튼 hover |
| `--color-point-subtle` | `rgba(95,91,226,0.12)` | 브랜드 subtle 배경 |
| `--color-point-border` | `rgba(95,91,226,0.30)` | 브랜드 테두리 (input focus) |
| `--color-focus-ring` | `rgba(95,91,226,0.50)` | 포커스 아웃라인 |
| `--color-negative` | `#ec2d30` | 에러, Danger 텍스트 |
| `--color-negative-subtle` | — | `rgba(236,45,48,0.10)` 인라인 사용 |

### 타이포그래피 토큰

| 토큰 | 값 |
|------|----|
| `--text-h4` | `16px` |
| `--text-body` | `14px` |
| `--text-body-sm` | `13px` |
| `--text-caption` | `12px` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--font-weight-bold` | `700` |
| `--line-height-normal` | `1.5` |

### 스페이싱 (4px 기준)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48px`

### Border Radius 토큰

| 토큰 | 값 | 용도 |
|------|----|------|
| `--radius-xs` | `4px` | 뱃지, 태그 |
| `--radius-sm` | `6px` | 버튼, 인풋 |
| `--radius-md` | `8px` | 카드 내부 |
| `--radius-lg` | `12px` | 로그인 카드 |

---

## 1. 로그인 페이지 (`/login`)

### 레이아웃

```
┌─────────────────────────────────────────────────┐
│  bg: var(--color-bg-base)  height: 100dvh       │
│                                                  │
│           ┌──────────────────────┐               │
│           │  로그인 카드 (320px)  │               │
│           │  bg: surface         │               │
│           │  border              │               │
│           │  radius: lg (12px)   │               │
│           └──────────────────────┘               │
│                                                  │
└─────────────────────────────────────────────────┘
```

전체 페이지: `display: flex; align-items: center; justify-content: center; min-height: 100dvh;`
배경: `background: var(--color-bg-base)`

### 로그인 카드 구조

```
┌──────────────────────────────────┐  ← border: 1px solid var(--color-border)
│  padding: 32px                   │    background: var(--color-bg-surface)
│                                  │    border-radius: var(--radius-lg)
│  ── 헤더 영역 ──                  │    width: 320px
│  [아이콘 20px]                   │
│  Memory Viewer                   │  ← 아이콘: 뇌/메모리 아이콘 (lucide: Brain 또는 Database)
│  subtitle                        │    색상: var(--color-point-light)
│                                  │
│  ── 폼 영역 ──                   │
│  [Password 레이블]               │
│  [패스워드 인풋          🔒/👁]   │
│                                  │
│  [에러 메시지 — 조건부]           │
│                                  │
│  [로그인 버튼 — 100% width]      │
└──────────────────────────────────┘
```

### 컴포넌트 상세 스펙

#### 헤더 영역
- **아이콘**: `Database` (lucide-react), size: `20px`, color: `var(--color-point-light)`
- **타이틀**: `Memory Viewer`
  - font-size: `var(--text-h4)` = 16px
  - font-weight: `var(--font-weight-semibold)` = 600
  - color: `var(--color-text-primary)`
  - margin-top: `8px`
- **서브타이틀**: `관리자 전용 액세스`
  - font-size: `var(--text-caption)` = 12px
  - color: `var(--color-text-secondary)`
  - margin-top: `4px`
- 헤더 영역 전체 margin-bottom: `24px`

#### 비밀번호 인풋 레이블
- 텍스트: `비밀번호`
- font-size: `var(--text-body-sm)` = 13px
- font-weight: `var(--font-weight-medium)` = 500
- color: `var(--color-text-secondary)`
- margin-bottom: `6px`

#### 비밀번호 인풋 (패스워드 토글 포함)

| 상태 | 스타일 |
|------|--------|
| **Default** | background: `var(--color-bg-input)`, border: `1px solid var(--color-border)`, border-radius: `var(--radius-sm)` |
| **Focus** | border: `1px solid var(--color-point-border)`, outline: `2px solid var(--color-focus-ring)`, outline-offset: `2px` |
| **Error** | border: `1px solid var(--color-negative)` |
| **Hover** | border: `1px solid var(--color-border-strong)` |

- height: `40px`
- padding: `0 12px 0 12px`
- padding-right: `40px` (토글 버튼 공간)
- font-size: `var(--text-body)` = 14px
- color: `var(--color-text-primary)`
- placeholder 색상: `var(--color-text-tertiary)`
- width: `100%`

**토글 버튼** (우측 끝, 인풋 내부):
- size: `16px`, color: `var(--color-text-tertiary)`
- hover: color → `var(--color-text-secondary)`
- 아이콘: `Eye` / `EyeOff` (lucide-react)

#### 에러 메시지 (조건부 노출)

```
⚠  비밀번호가 올바르지 않습니다
```

- 배경: `rgba(236, 45, 48, 0.10)`
- border: `1px solid rgba(236, 45, 48, 0.25)`
- border-radius: `var(--radius-sm)` = 6px
- padding: `8px 12px`
- font-size: `var(--text-body-sm)` = 13px
- color: `var(--color-negative)`
- margin-top: `12px`
- 아이콘: `AlertCircle` (lucide), size: `14px`, margin-right: `6px`
- 기본 hidden, 인증 실패 시 noOut

#### 로그인 버튼

| 상태 | 스타일 |
|------|--------|
| **Default** | background: `var(--color-point)` = `#5F5BE2`, color: `#fff` |
| **Hover** | background: `var(--color-point-hover)` = `#4A47C8` |
| **Active** | background: `#3D3AB5` (hover보다 한 단계 어둡게) |
| **Loading** | background: `var(--color-point-hover)`, opacity: `0.8`, 스피너 노출 |
| **Disabled** | background: `var(--color-bg-elevated)`, color: `var(--color-text-disabled)`, cursor: not-allowed |

- width: `100%`
- height: `40px`
- border-radius: `var(--radius-sm)` = 6px
- font-size: `var(--text-body)` = 14px
- font-weight: `var(--font-weight-semibold)` = 600
- margin-top: `16px`
- transition: `background 150ms ease`

**로딩 상태 스피너**: 기존 `.spinner` 클래스 (globals.css), 버튼 내부 inline

---

## 2. 메인 대시보드 변경사항

### 2-1. 헤더 — 로그아웃 버튼

기존 헤더 우측에 로그아웃 아이콘 버튼 추가.

```
┌────────────────────────────────────────────────────────┐
│ ≡  Memory Viewer                         🔍  □  [→]   │
│    (제목)                              (검색)(우패널)(로그아웃)│
└────────────────────────────────────────────────────────┘
```

- 기존 `icon-btn` 클래스 재사용
- 아이콘: `LogOut` (lucide-react), size: `16px`
- color: `var(--color-text-secondary)`
- hover: `.icon-btn:hover` 규칙 적용 (rgba(255,255,255,0.04) 오버레이)
- 크기: `28px × 28px`, border-radius: `var(--radius-xs)` = 4px
- 위치: 헤더 우측 끝 (기존 우패널 토글 버튼 오른쪽)
- tooltip: `로그아웃` (title attribute)

### 2-2. 마크다운 뷰어 — 편집 버튼

파일 열람 시 우상단에 편집 버튼 조건부 노출.

```
┌──────────────────────────────────────────────┐
│ 파일명.md                          [편집]     │  ← 뷰어 헤더 영역
├──────────────────────────────────────────────┤
│                                              │
│  마크다운 내용 렌더링...                      │
│                                              │
└──────────────────────────────────────────────┘
```

**[편집] 버튼**

| 상태 | 스타일 |
|------|--------|
| **Default (뷰 모드)** | background: `var(--color-bg-elevated)`, border: `1px solid var(--color-border)`, color: `var(--color-text-secondary)` |
| **Hover** | background: `rgba(255,255,255,0.04)`, border-color: `var(--color-border-strong)` |
| **Active (편집 모드)** | background: `var(--color-point-subtle)`, border: `1px solid var(--color-point-border)`, color: `var(--color-point-light)` |

- height: `28px`
- padding: `0 10px`
- border-radius: `var(--radius-xs)` = 4px
- font-size: `var(--text-caption)` = 12px
- font-weight: `var(--font-weight-medium)` = 500
- 아이콘: 뷰 모드 → `Pencil` (14px), 편집 모드 → `Check` (14px) + 저장 버튼으로 변환
- icon margin-right: `4px`

**편집 모드 전환 시 뷰어 헤더 변경**:
```
[저장]  [취소]
```
- **[저장]**: background `var(--color-point)`, color `#fff`, hover `var(--color-point-hover)` — 기존 로그인 버튼과 동일한 primary 스타일
- **[취소]**: Default 버튼 스타일 (뷰 모드의 [편집] 버튼과 동일)
- 두 버튼 gap: `8px`

**편집 영역 (textarea)**:
- background: `var(--color-bg-input)` = `#1c2333`
- border: `1px solid var(--color-border)`
- border-radius: `var(--radius-md)` = 8px
- padding: `16px`
- font-size: `var(--text-body)` = 14px
- font-family: `'JetBrains Mono', 'Fira Code', monospace` (코드 가독성)
- color: `var(--color-text-primary)`
- line-height: `var(--line-height-relaxed)` = 1.65
- width: `100%`, height: 뷰어 본문 영역 동일
- resize: `none`
- focus: border `1px solid var(--color-point-border)`, outline `2px solid var(--color-focus-ring)`

### 2-3. 파일 트리 — 새 파일 버튼

사이드바 파일 트리 상단 우측에 `+` 아이콘 버튼 추가.

```
┌──────────────────────────────────┐
│ 🔍 검색...                       │
├──────────────────────────────────┤
│ Files                       [+]  │  ← 섹션 헤더 라인
│ ├── decisions/                   │
│ │   └── ...                      │
│ └── tasks/                       │
└──────────────────────────────────┘
```

**[+] 버튼 (새 파일)**

| 상태 | 스타일 |
|------|--------|
| **Default** | color: `var(--color-text-tertiary)`, background: transparent |
| **Hover** | color: `var(--color-text-secondary)`, background: `rgba(255,255,255,0.04)` |

- 아이콘: `Plus` (lucide-react), size: `14px`
- 버튼 크기: `20px × 20px`
- border-radius: `var(--radius-xs)` = 4px
- tooltip: `새 파일` (title attribute)

**새 파일 생성 인라인 UI** (버튼 클릭 후):

파일 트리 최상단에 인라인 인풋 등장:
```
│ ├── [새 파일명 입력    ] ✓ ✗  │
```
- 인풋: height `24px`, padding `0 6px`, font-size `13px`
- background: `var(--color-bg-input)`, border: `1px solid var(--color-point-border)`
- border-radius: `var(--radius-xs)` = 4px
- 확인(✓): `Check` 아이콘 12px, color `var(--color-positive)`
- 취소(✗): `X` 아이콘 12px, color `var(--color-text-tertiary)`
- Enter → 저장, Escape → 취소

---

## 3. 반응형 & 접근성

| 항목 | 기준 |
|------|------|
| 터치 타겟 최소 | 44px (로그인 버튼 height 40px이나 mobile 44px로 증가) |
| 텍스트 입력 최소 폰트 | 16px (모바일 zoom 방지 — 인풋 `font-size: 16px` 적용) |
| 색상 대비 | `--color-text-primary` on `--color-bg-surface` → 11.1:1 (WCAG AAA) |
| 에러 색상 대비 | `--color-negative` on `--color-bg-surface` → 4.6:1 (WCAG AA) |
| 키보드 접근성 | `:focus-visible` 아웃라인 (globals.css 기존 규칙), Tab 순서: 인풋 → 버튼 |
| 로그인 카드 모바일 | width: `calc(100% - 32px)`, max-width: `320px` |

---

## 4. 애니메이션 & 트랜지션

| 요소 | 속성 | 값 |
|------|------|----|
| 버튼 background | transition | `150ms ease` |
| 인풋 border | transition | `150ms ease` |
| 에러 메시지 | 애니메이션 없음 — 즉시 노출 |
| 편집 모드 전환 | 애니메이션 없음 — 즉시 전환 |

---

## 5. 구현 체크리스트 (Bart 핸드오프)

- [ ] `app/login/page.tsx` 신규 생성 — 위 카드 레이아웃 구현
- [ ] 비밀번호 토글 버튼 (`Eye`/`EyeOff`) 상태 로컬 관리
- [ ] 에러 메시지: auth API 응답 실패 시 조건부 노출
- [ ] 로그인 버튼: 요청 중 Loading 상태, 완료 후 redirect `/`
- [ ] `components/markdown-viewer.tsx` — 편집 버튼 + textarea 상태 추가
- [ ] `components/file-tree.tsx` — 새 파일 버튼 + 인라인 인풋 상태 추가
- [ ] `app/page.tsx` 헤더 — 로그아웃 아이콘 버튼 추가
- [ ] 모바일: 인풋 `font-size: 16px` (zoom 방지)
- [ ] 모든 lucide 아이콘은 기존 import 방식 (`lucide-react`) 유지
- [ ] globals.css 추가 없이 CSS 변수 인라인 또는 Tailwind arbitrary value로 처리

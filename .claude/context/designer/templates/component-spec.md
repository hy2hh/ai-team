# 컴포넌트 스펙 템플릿 (8섹션 Full)

> 토스 디자인 시스템 컴포넌트 상세 스펙 작성 시 사용.
> 일반적으로는 `component-guide.md` §6의 4섹션 축약 버전 사용.
> 신규 커스텀 컴포넌트나 상세 스펙이 필요한 경우에만 이 템플릿 로드.

---

## 1. 메타데이터

| 항목 | 값 |
|------|---|
| 이름 | {ComponentName} |
| 카테고리 | Action / Display / Navigation / Input / Feedback |
| TDS 공식 여부 | ✅ 공식 / ⚠️ 커스텀 |
| 최종 수정 | {YYYY-MM-DD} |

## 2. 개요

{컴포넌트의 목적과 사용 맥락. 토스 앱에서 어떤 상황에 쓰이는지 1-2문장.}

## 3. 해부도 (Anatomy)

```
┌─────────────────────────────────┐
│  [Leading]  [Content]  [Trail]  │
│   아이콘      텍스트     액세서리  │
└─────────────────────────────────┘
```

| 영역 | 필수 | 설명 |
|------|------|------|
| Leading | Optional | {설명} |
| Content | Required | {설명} |
| Trailing | Optional | {설명} |

## 4. 디자인 토큰

### 크기

| Variant | Height | Padding | Radius |
|---------|--------|---------|--------|
| Small | {px} | {px} | {px} |
| Medium | {px} | {px} | {px} |
| Large | {px} | {px} | {px} |

### 색상 (3계층)

| Layer | Token | Value |
|-------|-------|-------|
| Base | `--color-{name}` | `{hex}` |
| Semantic | `--fill-{role}` | `var(--color-{name})` |
| Component | `--{comp}-{role}` | `var(--fill-{role})` |

### 타이포그래피

| 요소 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Label | {px} | {n} | {n} | {px} |
| Description | {px} | {n} | {n} | {px} |

## 5. Props / Variants

| Prop | Type | Default | 설명 |
|------|------|---------|------|
| variant | `'primary' \| 'secondary'` | `'primary'` | {설명} |
| size | `'sm' \| 'md' \| 'lg'` | `'md'` | {설명} |
| disabled | `boolean` | `false` | {설명} |
| loading | `boolean` | `false` | {설명} |

## 6. 상태 (States)

| 상태 | Background | Text | Border | Shadow | 비고 |
|------|-----------|------|--------|--------|------|
| Default | {val} | {val} | — | — | |
| Hover | {val} | {val} | — | — | |
| Active/Pressed | {val} | {val} | — | — | |
| Focus | {val} | {val} | `2px solid #3182F6` | — | |
| Disabled | `#F2F4F6` | `#B0B8C1` | — | — | |
| Loading | — | — | — | — | Skeleton shimmer |
| Error | — | `#F04452` | — | — | |
| Empty | — | `#8B95A1` | — | — | |

## 7. 코드 예시

```tsx
// Default
<{ComponentName} variant="primary" size="md">
  라벨
</{ComponentName}>

// Disabled
<{ComponentName} variant="primary" disabled>
  라벨
</{ComponentName}>

// Loading
<{ComponentName} variant="primary" loading>
  라벨
</{ComponentName}>
```

## 8. 교차 참조

| 관련 컴포넌트 | 관계 |
|-------------|------|
| {Name} | {이 컴포넌트와의 관계 설명} |

### 접근성 체크리스트
- [ ] 터치 타겟 48px 이상
- [ ] 대비 4.5:1 이상
- [ ] `aria-label` 또는 `aria-labelledby`
- [ ] 키보드 접근 가능
- [ ] Focus ring: `2px solid #3182F6`
- [ ] `reduced-motion` 대응

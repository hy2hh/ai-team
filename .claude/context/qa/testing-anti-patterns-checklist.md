# Testing Anti-Patterns 체크리스트 (QA 리뷰용)

코드 리뷰 시 테스트 품질 검증에 사용.

## Quick Reference

| Anti-Pattern | Fix |
|---|---|
| Mock 요소에 assert | 실제 컴포넌트 테스트 또는 unmock |
| 프로덕션에 테스트 전용 메서드 | test-utils로 이동 |
| 이해 없이 mock | 의존성 파악 후 최소 mock |
| 불완전한 mock | 실제 API 전체 구조 미러링 |
| 후순위 테스트 | TDD — 테스트 먼저 |
| 과도한 mock 복잡도 | 통합 테스트 고려 |

## Red Flags

- `*-mock` testId에 assert
- 테스트 파일에서만 호출되는 프로덕션 메서드
- mock 설정이 테스트의 50% 이상
- mock 제거 시 테스트 실패
- mock이 필요한 이유를 설명 못함

## Gate Function 요약

1. **Mock assert 전**: "mock 존재를 검증하는가, 실제 동작을 검증하는가?"
2. **프로덕션 메서드 추가 전**: "테스트에서만 사용하는가?" → test-utils로
3. **Mock 추가 전**: "실제 메서드의 side effect는? 테스트가 거기 의존하는가?"
4. **Mock 응답 작성 전**: "실제 API 전체 필드를 포함했는가?"

## Grep 기반 검증 명령어

```bash
# mock 테스트 의심 패턴
grep -rn 'mock.*toBeInTheDocument\|getByTestId.*mock' --include='*.test.*'

# 프로덕션 test-only 메서드 의심
grep -rn 'destroy\|cleanup\|reset' --include='*.ts' | grep -v test | grep -v node_modules

# mock 설정 비율 높은 파일
grep -c 'vi\.mock\|jest\.mock\|mockReturnValue\|mockResolvedValue' --include='*.test.*' -r
```

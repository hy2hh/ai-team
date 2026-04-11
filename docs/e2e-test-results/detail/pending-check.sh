#!/bin/bash
# PENDING 응답 확인 스크립트
# 사용: source .env && bash docs/e2e-test-results/detail/pending-check.sh

source .env 2>/dev/null

CH="C0ANKEB4CRF"
PENDING_TS=(
  # 배치 11-12 PENDING
  1775781639.077029  # D-2-1
  1775781644.487099  # B-1-3
  1775781666.139839  # B-1-4
  1775781671.561519  # B-3-1b
  1775781676.951499  # E-3-1
  1775781682.344079  # E-2-1
  1775781687.752299  # A-1-3
  1775781602.975399  # B-7-1
)

for ts in "${PENDING_TS[@]}"; do
  r=$(curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
    "https://slack.com/api/conversations.replies?channel=$CH&ts=$ts&limit=3" | \
    python3 -c "
import sys,json
d=json.load(sys.stdin)
msgs=d.get('messages',[])
rr=[m for m in msgs if m.get('ts')!=msgs[0].get('ts','')]
if rr:
    print(rr[0]['user']+': '+rr[0]['text'][:80])
else:
    print('WAITING')
" 2>/dev/null)
  echo "[$ts] $r"
  sleep 1
done

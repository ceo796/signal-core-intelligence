#!/usr/bin/env bash
# Quick Signal87 API smoke audit. Requires API on :8080 with CLERK_BYPASS_AUTH=true for protected routes.
set -euo pipefail

BASE="${API_BASE:-http://127.0.0.1:8080}"
PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" method="$3" path="$4"
  shift 4
  local status
  if [ "$method" = "GET" ]; then
    status=$(curl -s -o /tmp/audit-body.json -w "%{http_code}" "$BASE$path")
  else
    status=$(curl -s -o /tmp/audit-body.json -w "%{http_code}" -X "$method" "$BASE$path" "$@")
  fi
  if [ "$status" = "$expected" ]; then
    echo "PASS $name ($status)"
    PASS=$((PASS + 1))
  else
    echo "FAIL $name expected=$expected got=$status"
    head -c 300 /tmp/audit-body.json 2>/dev/null || true
    echo ""
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Signal87 API audit @ $BASE ==="

check "healthz" 200 GET /api/healthz
check "runtime-check" 200 GET /api/runtime-check
check "system-info" 200 GET /api/system/info
check "skills-catalog" 200 GET /api/skills
check "documents-list" 200 GET /api/documents
check "notes-list" 200 GET /api/notes
check "notes-create" 201 POST /api/notes -H "Content-Type: application/json" -d '{}'
check "trash-list" 200 GET /api/trash

# Upload two small TXT fixtures (kept until extended AI checks finish)
echo "smoke test A $(date)" > /tmp/signal87-audit-a.txt
echo "smoke test B $(date)" > /tmp/signal87-audit-b.txt
DOC_ID=""
DOC_B=""

status=$(curl -s -o /tmp/audit-upload-a.json -w "%{http_code}" \
  -X POST "$BASE/api/documents/upload" \
  -F "file=@/tmp/signal87-audit-a.txt;type=text/plain")
if [ "$status" = "201" ]; then
  echo "PASS document-upload ($status)"
  PASS=$((PASS + 1))
  DOC_ID=$(python3 -c "import json; print(json.load(open('/tmp/audit-upload-a.json'))['id'])" 2>/dev/null || echo "")
else
  echo "FAIL document-upload expected=201 got=$status"
  head -c 300 /tmp/audit-upload-a.json || true
  echo ""
  FAIL=$((FAIL + 1))
fi

status=$(curl -s -o /tmp/audit-upload-b.json -w "%{http_code}" \
  -X POST "$BASE/api/documents/upload" \
  -F "file=@/tmp/signal87-audit-b.txt;type=text/plain")
if [ "$status" = "201" ]; then
  DOC_B=$(python3 -c "import json; print(json.load(open('/tmp/audit-upload-b.json'))['id'])" 2>/dev/null || echo "")
fi

if [ -n "$DOC_ID" ]; then
  check "document-detail" 200 GET "/api/documents/$DOC_ID"
  check "document-chunks" 200 GET "/api/documents/$DOC_ID/chunks"
  check "document-chat" 200 POST "/api/documents/$DOC_ID/chat" \
    -H "Content-Type: application/json" \
    -d '{"question":"What is this document about?"}'
fi

if [ -n "$DOC_ID" ] && [ -n "$DOC_B" ] && [ "$DOC_ID" != "$DOC_B" ]; then
  check "multi-chat" 200 POST /api/documents/multi-chat \
    -H "Content-Type: application/json" \
    -d "{\"documentIds\":[$DOC_ID,$DOC_B],\"question\":\"Compare these documents briefly.\"}"
  check "agent-hybrid" 200 POST /api/agent/hybrid \
    -H "Content-Type: application/json" \
    -d "{\"documentIds\":[$DOC_ID],\"query\":\"Summarize the key points.\",\"mode\":\"summarize\"}"
  check "brief" 200 POST /api/documents/brief \
    -H "Content-Type: application/json" \
    -d "{\"documentIds\":[$DOC_ID],\"briefType\":\"executive_summary\"}"
  check "skills-run" 200 POST /api/skills/run \
    -H "Content-Type: application/json" \
    -d "{\"skillId\":\"summarize-document\",\"documentIds\":[$DOC_ID]}"
fi

if [ -n "$DOC_ID" ]; then
  check "document-delete" 204 DELETE "/api/documents/$DOC_ID"
fi
if [ -n "$DOC_B" ] && [ "$DOC_B" != "$DOC_ID" ]; then
  curl -s -o /dev/null -w "" -X DELETE "$BASE/api/documents/$DOC_B" || true
fi

# Notes patch/delete on the note created earlier
NOTE_ID=$(curl -s "$BASE/api/notes" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['items'][0]['id'] if d.get('items') else '')" 2>/dev/null || echo "")
if [ -n "$NOTE_ID" ]; then
  check "notes-patch" 200 PATCH "/api/notes/$NOTE_ID" \
    -H "Content-Type: application/json" \
    -d '{"title":"audit-updated"}'
  check "notes-delete" 204 DELETE "/api/notes/$NOTE_ID"
fi

echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
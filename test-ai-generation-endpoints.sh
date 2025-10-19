#!/bin/bash
# Test script for AI Generation endpoints
# Usage: ./test-ai-generation-endpoints.sh [ACCESS_TOKEN]

set -e

API_URL="http://localhost:3003/api/v1"
ACCESS_TOKEN="${1:-}"

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Error: Access token required"
  echo "Usage: $0 <ACCESS_TOKEN>"
  exit 1
fi

echo "🧪 Testing AI Generation Endpoints"
echo "======================================"
echo ""

# Test 1: POST /api/v1/ai/decks/from-text - Happy path
echo "Test 1: Generate deck from text (happy path)"
echo "----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/ai/decks/from-text" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "inputText": "Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. Neural networks are computing systems inspired by biological neural networks.",
    "maxCards": 3,
    "deckName": "Test AI Deck - Machine Learning"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ Test 1 PASSED (201 Created)"
  echo "Response: $BODY" | jq '.'
  DECK_ID=$(echo "$BODY" | jq -r '.deck.id')
  echo "Generated Deck ID: $DECK_ID"
else
  echo "❌ Test 1 FAILED (Expected 201, got $HTTP_CODE)"
  echo "Response: $BODY" | jq '.'
fi
echo ""

# Test 2: Rate limit test
echo "Test 2: Rate limiting (11 rapid requests)"
echo "----------------------------------------------"
for i in {1..11}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/ai/decks/from-text" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
      "inputText": "Test rate limiting with minimal text for request '$i'",
      "maxCards": 1
    }')
  
  if [ $i -le 10 ]; then
    if [ "$HTTP_CODE" -eq 201 ]; then
      echo "  Request $i: ✅ 201 (allowed)"
    else
      echo "  Request $i: ⚠️  $HTTP_CODE (unexpected)"
    fi
  else
    if [ "$HTTP_CODE" -eq 429 ]; then
      echo "  Request $i: ✅ 429 (rate limited as expected)"
    else
      echo "  Request $i: ❌ $HTTP_CODE (expected 429)"
    fi
  fi
  
  sleep 0.5
done
echo ""

# Test 3: Invalid input - empty text
echo "Test 3: Empty input text"
echo "----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/ai/decks/from-text" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "inputText": "",
    "maxCards": 3
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo "✅ Test 3 PASSED (400 Bad Request)"
  echo "Response: $BODY" | jq '.error'
else
  echo "❌ Test 3 FAILED (Expected 400, got $HTTP_CODE)"
  echo "Response: $BODY" | jq '.'
fi
echo ""

# Test 4: Invalid input - too long text
echo "Test 4: Too long input text"
echo "----------------------------------------------"
# Test with text exceeding max length (20001 chars > 20000 max)
LONG_TEXT=$(printf 'A%.0s' {1..20001})
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/ai/decks/from-text" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "inputText": "'"$LONG_TEXT"'",
    "maxCards": 3
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo "✅ Test 4 PASSED (400 Bad Request)"
  echo "Response: $BODY" | jq '.error'
else
  echo "❌ Test 4 FAILED (Expected 400, got $HTTP_CODE)"
  echo "Response: $BODY" | jq '.'
fi
echo ""

# Test 5: Invalid maxCards
echo "Test 5: Invalid maxCards (out of range)"
echo "----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/ai/decks/from-text" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "inputText": "Test content for invalid maxCards",
    "maxCards": 51
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo "✅ Test 5 PASSED (400 Bad Request)"
  echo "Response: $BODY" | jq '.error'
else
  echo "❌ Test 5 FAILED (Expected 400, got $HTTP_CODE)"
  echo "Response: $BODY" | jq '.'
fi
echo ""

# Test 6: GET /api/v1/ai/logs - List logs
echo "Test 6: List AI generation logs"
echo "----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/ai/logs?limit=10&sort=createdAt&order=desc" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Test 6 PASSED (200 OK)"
  LOGS_COUNT=$(echo "$BODY" | jq '.items | length')
  TOTAL=$(echo "$BODY" | jq '.total')
  echo "Retrieved $LOGS_COUNT logs (total: $TOTAL)"
  echo "Latest log: $(echo "$BODY" | jq '.items[0]')"
else
  echo "❌ Test 6 FAILED (Expected 200, got $HTTP_CODE)"
  echo "Response: $BODY" | jq '.'
fi
echo ""

# Test 7: GET /api/v1/ai/logs - Filter by deckId
if [ ! -z "$DECK_ID" ]; then
  echo "Test 7: Filter logs by deckId"
  echo "----------------------------------------------"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/ai/logs?deckId=$DECK_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Test 7 PASSED (200 OK)"
    FILTERED_COUNT=$(echo "$BODY" | jq '.items | length')
    echo "Logs for deck $DECK_ID: $FILTERED_COUNT"
  else
    echo "❌ Test 7 FAILED (Expected 200, got $HTTP_CODE)"
    echo "Response: $BODY" | jq '.'
  fi
  echo ""
fi

# Test 8: GET /api/v1/ai/logs - Invalid query params
echo "Test 8: Invalid query parameters"
echo "----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/ai/logs?limit=200" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo "✅ Test 8 PASSED (400 Bad Request)"
  echo "Response: $BODY" | jq '.error'
else
  echo "❌ Test 8 FAILED (Expected 400, got $HTTP_CODE)"
  echo "Response: $BODY" | jq '.'
fi
echo ""

echo "======================================"
echo "✅ All tests completed!"
echo "======================================"

#!/bin/bash
# ============================================================================
# Manual Tests for POST /api/v1/cards/{cardId}/review
# ============================================================================

echo "============================================================================"
echo "MANUAL TESTS: POST /api/v1/cards/{cardId}/review"
echo "============================================================================"
echo ""

# Configuration
API_URL="http://localhost:3003"
echo "API URL: $API_URL"
echo "Card ID: $CARD_ID"
echo ""

# Test Counter
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Helper Functions
# ============================================================================

test_result() {
    local test_name="$1"
    local expected_status="$2"
    local actual_status="$3"
    
    if [ "$expected_status" = "$actual_status" ]; then
        echo "✅ PASS: $test_name (Status: $actual_status)"
        ((TESTS_PASSED++))
        return 0
    else
        echo "❌ FAIL: $test_name (Expected: $expected_status, Got: $actual_status)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# ============================================================================
# TEST 1: Success case - Grade 4 (Correct with hesitation)
# ============================================================================

echo "============================================================================"
echo "TEST 1: Success - Grade 4 (Correct with hesitation)"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 4}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Grade 4 review" "200" "$STATUS"

if [ "$STATUS" = "200" ]; then
    echo "Response: $BODY" | head -c 200
    echo "..."
    echo ""
    
    # Verify card was updated
    CARD=$(curl -s -X GET "$API_URL/api/v1/cards/$CARD_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN")
    
    EASE_FACTOR=$(echo "$CARD" | grep -o '"easeFactor":[^,]*' | cut -d':' -f2)
    INTERVAL=$(echo "$CARD" | grep -o '"intervalDays":[^,]*' | cut -d':' -f2)
    REPS=$(echo "$CARD" | grep -o '"repetitions":[^,]*' | cut -d':' -f2)
    
    echo "Card updated:"
    echo "  - Ease Factor: $EASE_FACTOR (expected: 2.58)"
    echo "  - Interval Days: $INTERVAL (expected: 1)"
    echo "  - Repetitions: $REPS (expected: 1)"
    echo ""
fi

# ============================================================================
# TEST 2: Success - Grade 5 (Perfect recall)
# ============================================================================

echo "============================================================================"
echo "TEST 2: Success - Grade 5 (Perfect recall)"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 5}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Grade 5 review" "200" "$STATUS"

if [ "$STATUS" = "200" ]; then
    echo "Response: $BODY" | head -c 200
    echo "..."
    echo ""
fi

# ============================================================================
# TEST 3: Success - Grade 2 (Failed, reset progress)
# ============================================================================

echo "============================================================================"
echo "TEST 3: Success - Grade 2 (Failed, reset progress)"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 2}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Grade 2 review (failed)" "200" "$STATUS"

if [ "$STATUS" = "200" ]; then
    echo "Response: $BODY" | head -c 200
    echo "..."
    echo ""
    
    # Verify card was reset
    CARD=$(curl -s -X GET "$API_URL/api/v1/cards/$CARD_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN")
    
    REPS=$(echo "$CARD" | grep -o '"repetitions":[^,]*' | cut -d':' -f2)
    INTERVAL=$(echo "$CARD" | grep -o '"intervalDays":[^,]*' | cut -d':' -f2)
    
    echo "Card reset after failure:"
    echo "  - Repetitions: $REPS (expected: 0)"
    echo "  - Interval Days: $INTERVAL (expected: 1)"
    echo ""
fi

# ============================================================================
# TEST 4: Validation Error - Invalid grade (> 5)
# ============================================================================

echo "============================================================================"
echo "TEST 4: Validation Error - Invalid grade (> 5)"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 6}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Invalid grade 6" "400" "$STATUS"

if [ "$STATUS" = "400" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 5: Validation Error - Invalid grade (< 0)
# ============================================================================

echo "============================================================================"
echo "TEST 5: Validation Error - Invalid grade (< 0)"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": -1}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Invalid grade -1" "400" "$STATUS"

if [ "$STATUS" = "400" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 6: Validation Error - Missing grade
# ============================================================================

echo "============================================================================"
echo "TEST 6: Validation Error - Missing grade"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Missing grade" "400" "$STATUS"

if [ "$STATUS" = "400" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 7: Validation Error - Invalid JSON
# ============================================================================

echo "============================================================================"
echo "TEST 7: Validation Error - Invalid JSON"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{invalid json}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Invalid JSON" "400" "$STATUS"

if [ "$STATUS" = "400" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 8: Authentication Error - No token
# ============================================================================

echo "============================================================================"
echo "TEST 8: Authentication Error - No token"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"grade": 4}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "No authentication token" "401" "$STATUS"

if [ "$STATUS" = "401" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 9: Not Found - Invalid card ID
# ============================================================================

echo "============================================================================"
echo "TEST 9: Not Found - Invalid card ID"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/00000000-0000-0000-0000-000000000000/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 4}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Non-existent card" "404" "$STATUS"

if [ "$STATUS" = "404" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 10: Validation Error - Invalid card ID format
# ============================================================================

echo "============================================================================"
echo "TEST 10: Validation Error - Invalid card ID format"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/not-a-uuid/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 4}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Invalid UUID format" "400" "$STATUS"

if [ "$STATUS" = "400" ]; then
    echo "Error response: $BODY"
    echo ""
fi

# ============================================================================
# TEST 11: Success - With custom reviewDate
# ============================================================================

echo "============================================================================"
echo "TEST 11: Success - With custom reviewDate"
echo "============================================================================"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/cards/$CARD_ID/review" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade": 3, "reviewDate": "2025-10-19T10:00:00Z"}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

test_result "Custom reviewDate" "200" "$STATUS"

if [ "$STATUS" = "200" ]; then
    echo "Response: $BODY" | head -c 200
    echo "..."
    echo ""
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo "============================================================================"
echo "TEST SUMMARY"
echo "============================================================================"
echo "✅ Tests Passed: $TESTS_PASSED"
echo "❌ Tests Failed: $TESTS_FAILED"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️ Some tests failed"
    exit 1
fi

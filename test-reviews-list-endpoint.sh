#!/bin/bash

# Test script for GET /api/v1/reviews endpoint
# Tests pagination, filtering, and error handling

BASE_URL="http://localhost:3003"
AUTH_TOKEN="${AUTH_TOKEN}"
CARD_ID="${CARD_ID:-2703e9e6-e6fd-4015-a00e-c03f4e5a31dd}"
DECK_ID="${DECK_ID:-0efe7855-613c-4706-bc29-f653fd801a99}"

echo "======================================"
echo "Testing GET /api/v1/reviews endpoint"
echo "======================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local test_name="$1"
    local url="$2"
    local expected_status="$3"
    local headers="$4"
    
    echo -e "${YELLOW}TEST: ${test_name}${NC}"
    echo "URL: $url"
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "$headers" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" "$url")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    echo "Status: $status_code"
    echo "Response: $body" | jq '.' 2>/dev/null || echo "$body"
    
    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED (expected $expected_status, got $status_code)${NC}"
        ((FAILED++))
    fi
    echo ""
}

# TEST 1: Get all reviews (default pagination)
test_endpoint \
    "Get all reviews with default pagination" \
    "$BASE_URL/api/v1/reviews" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 2: Get reviews with custom limit
test_endpoint \
    "Get reviews with limit=5" \
    "$BASE_URL/api/v1/reviews?limit=5" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 3: Get reviews with pagination (offset)
test_endpoint \
    "Get reviews with offset=1" \
    "$BASE_URL/api/v1/reviews?limit=2&offset=1" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 4: Filter by cardId
test_endpoint \
    "Filter reviews by cardId" \
    "$BASE_URL/api/v1/reviews?cardId=$CARD_ID" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 5: Filter by deckId
test_endpoint \
    "Filter reviews by deckId" \
    "$BASE_URL/api/v1/reviews?deckId=$DECK_ID" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 6: Filter by date range
test_endpoint \
    "Filter reviews by date range" \
    "$BASE_URL/api/v1/reviews?from=2025-01-01T00:00:00Z&to=2025-12-31T23:59:59Z" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 7: Sort ascending
test_endpoint \
    "Sort reviews ascending" \
    "$BASE_URL/api/v1/reviews?order=asc" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 8: Invalid limit (too large)
test_endpoint \
    "Invalid limit (> 100)" \
    "$BASE_URL/api/v1/reviews?limit=150" \
    "400" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 9: Invalid limit (negative)
test_endpoint \
    "Invalid limit (negative)" \
    "$BASE_URL/api/v1/reviews?limit=-1" \
    "400" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 10: Invalid cardId format
test_endpoint \
    "Invalid cardId (not UUID)" \
    "$BASE_URL/api/v1/reviews?cardId=invalid-uuid" \
    "400" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 11: Invalid deckId format
test_endpoint \
    "Invalid deckId (not UUID)" \
    "$BASE_URL/api/v1/reviews?deckId=not-a-uuid" \
    "400" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 12: Invalid from date format
test_endpoint \
    "Invalid from date format" \
    "$BASE_URL/api/v1/reviews?from=2025-10-01" \
    "400" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 13: Invalid to date format
test_endpoint \
    "Invalid to date format" \
    "$BASE_URL/api/v1/reviews?to=invalid-date" \
    "400" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 14: No authentication
test_endpoint \
    "No authentication token" \
    "$BASE_URL/api/v1/reviews" \
    "401" \
    ""

# TEST 15: Invalid authentication
test_endpoint \
    "Invalid authentication token" \
    "$BASE_URL/api/v1/reviews" \
    "401" \
    "Authorization: Bearer invalid-token-12345"

# TEST 16: Non-existent cardId (should return empty)
test_endpoint \
    "Non-existent cardId (should return empty)" \
    "$BASE_URL/api/v1/reviews?cardId=00000000-0000-0000-0000-000000000000" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

# TEST 17: Combined filters
test_endpoint \
    "Combined filters (cardId + date range)" \
    "$BASE_URL/api/v1/reviews?cardId=$CARD_ID&from=2025-01-01T00:00:00Z&limit=10" \
    "200" \
    "Authorization: Bearer $AUTH_TOKEN"

echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi

#!/bin/bash
#
# Authentication Endpoints Test Script
#
# PURPOSE:
#   Tests the authentication API endpoints (/api/v1/auth/*) for the 10x-cards application.
#   Validates sign-up, sign-in, and sign-out flows with various scenarios.
#
# USAGE:
#   ./test-auth-endpoints.sh
#
# REQUIREMENTS:
#   - curl: For making HTTP requests
#   - jq: For parsing and formatting JSON responses
#   - Running server: Application must be running on http://localhost:3000
#
# TESTS PERFORMED:
#   1. Sign-up with valid data
#   2. Sign-up with mismatched passwords (validation error)
#   3. Sign-up with short password (validation error)
#   4. Sign-in with invalid credentials (authentication error)
#   5. Sign-in with valid credentials (after creating test user)
#   6. Sign-out (using session from previous sign-in)
#
# NOTES:
#   - Creates temporary test users with timestamped emails
#   - Uses cookies.txt file for session management (auto-cleaned)
#   - All responses are formatted with jq for readability
#
# EXIT CODES:
#   0: All tests completed (check output for individual test results)
#

BASE_URL="http://localhost:3000"

echo "=== Testing Authentication Endpoints ==="
echo ""

# Test 1: Sign-up with new user
echo "Test 1: Sign-up with valid data"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-'$(date +%s)'@example.com",
    "password": "SecurePass123",
    "confirmPassword": "SecurePass123"
  }')
echo "Response: $SIGNUP_RESPONSE"
echo ""

# Test 2: Sign-up with validation error (passwords don't match)
echo "Test 2: Sign-up with mismatched passwords"
curl -s -X POST "$BASE_URL/api/v1/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "confirmPassword": "DifferentPass"
  }' | jq '.'
echo ""

# Test 3: Sign-up with short password
echo "Test 3: Sign-up with short password"
curl -s -X POST "$BASE_URL/api/v1/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "short",
    "confirmPassword": "short"
  }' | jq '.'
echo ""

# Test 4: Sign-in with invalid credentials
echo "Test 4: Sign-in with invalid credentials"
curl -s -X POST "$BASE_URL/api/v1/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "WrongPassword123"
  }' | jq '.'
echo ""

# Test 5: Sign-in with valid credentials (you need to create a user first)
echo "Test 5: Sign-in with valid credentials"
echo "First, create a test user..."
TEST_EMAIL="test-signin-$(date +%s)@example.com"
curl -s -X POST "$BASE_URL/api/v1/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"TestPassword123\",
    \"confirmPassword\": \"TestPassword123\"
  }" > /dev/null

echo "Now signing in with that user..."
SIGNIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/v1/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"TestPassword123\"
  }")
echo "Response: $SIGNIN_RESPONSE"
echo ""

# Test 6: Sign-out
echo "Test 6: Sign-out"
curl -s -b cookies.txt -X POST "$BASE_URL/api/v1/auth/sign-out" -i
echo ""

# Cleanup
rm -f cookies.txt

echo "=== All tests completed ==="

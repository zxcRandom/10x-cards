#!/bin/bash

# Test Password Reset Flow (OTP-based)
# Tests the complete password reset flow using OTP codes

BASE_URL="${BASE_URL:-http://localhost:4321}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
NEW_PASSWORD="${NEW_PASSWORD:-NewPassword123}"

echo "========================================="
echo "Password Reset Flow Test (OTP)"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Step 1: Request OTP Code
echo "Step 1: Requesting OTP code for $TEST_EMAIL..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/password/request-reset" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAILED: Expected 200, got $HTTP_CODE"
  exit 1
fi

echo "✅ Step 1 PASSED: OTP request successful"
echo ""
echo "========================================="
echo "📧 CHECK YOUR EMAIL for the OTP code"
echo "========================================="
echo ""
echo "The OTP code should be a 6-digit number."
echo "It is valid for 60 seconds."
echo ""
echo "After you receive the OTP, run Step 2:"
echo ""
echo "# Step 2: Verify OTP and Reset Password"
echo "OTP_CODE=123456  # Replace with your actual OTP"
echo ""
echo "curl -X POST \"$BASE_URL/api/v1/auth/password/verify-and-reset\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"email\":\"$TEST_EMAIL\",\"otp\":\"'\$OTP_CODE'\",\"newPassword\":\"$NEW_PASSWORD\",\"confirmNewPassword\":\"$NEW_PASSWORD\"}'"
echo ""
echo "========================================="
echo ""

# Manual Step 2 (uncomment and set OTP_CODE to test)
# OTP_CODE="123456"  # Replace with actual OTP from email
# 
# if [ -n "$OTP_CODE" ]; then
#   echo "Step 2: Verifying OTP and resetting password..."
#   RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/password/verify-and-reset" \
#     -H "Content-Type: application/json" \
#     -d "{\"email\":\"$TEST_EMAIL\",\"otp\":\"$OTP_CODE\",\"newPassword\":\"$NEW_PASSWORD\",\"confirmNewPassword\":\"$NEW_PASSWORD\"}")
#   
#   HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
#   BODY2=$(echo "$RESPONSE2" | sed '$d')
#   
#   echo "HTTP Status: $HTTP_CODE2"
#   echo "Response: $BODY2"
#   echo ""
#   
#   if [ "$HTTP_CODE2" != "200" ]; then
#     echo "❌ FAILED: Expected 200, got $HTTP_CODE2"
#     exit 1
#   fi
#   
#   echo "✅ Step 2 PASSED: Password reset successful"
#   echo ""
#   
#   # Step 3: Test login with new password
#   echo "Step 3: Testing login with new password..."
#   RESPONSE3=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/sign-in" \
#     -H "Content-Type: application/json" \
#     -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$NEW_PASSWORD\"}")
#   
#   HTTP_CODE3=$(echo "$RESPONSE3" | tail -n1)
#   
#   echo "HTTP Status: $HTTP_CODE3"
#   echo ""
#   
#   if [ "$HTTP_CODE3" != "303" ]; then
#     echo "❌ FAILED: Expected 303, got $HTTP_CODE3"
#     exit 1
#   fi
#   
#   echo "✅ Step 3 PASSED: Login successful with new password"
#   echo ""
#   echo "========================================="
#   echo "✅ ALL TESTS PASSED"
#   echo "========================================="
# fi

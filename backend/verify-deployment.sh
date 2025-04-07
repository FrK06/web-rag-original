#!/bin/bash
set -e

echo "🧪 Railway Deployment Verification 🧪"
echo "===================================="

# Get environment variables
echo "Loading environment variables..."
if [ -f .env ]; then
    source .env
else
    echo "⚠️ .env file not found. Please input the required variables:"
    read -p "Frontend URL: " FRONTEND_URL
    read -p "API Gateway URL: " API_GATEWAY_URL
    read -p "Auth Service URL: " AUTH_SERVICE_URL
fi

# Check frontend
echo "✅ Checking frontend..."
curl -s "$FRONTEND_URL" | grep -q "<title>" && echo "Frontend is up!" || echo "Frontend check failed!"

# Check API Gateway health
echo "✅ Checking API Gateway..."
curl -s "$API_GATEWAY_URL/api/health" | grep -q "healthy" && echo "API Gateway is up!" || echo "API Gateway check failed!"

# Check Auth Service health
echo "✅ Checking Auth Service..."
curl -s "$AUTH_SERVICE_URL/health" | grep -q "healthy" && echo "Auth Service is up!" || echo "Auth Service check failed!"

# Full user authentication flow test (optional)
echo "🔄 Do you want to test the authentication flow? (y/n)"
read testAuth
if [ "$testAuth" = "y" ]; then
    echo "Testing registration and login..."
    
    # Generate a test email
    TEST_EMAIL="test-$(date +%s)@example.com"
    TEST_PASSWORD="TestPass123!"
    
    # Get CSRF token
    CSRF_TOKEN=$(curl -s -c cookies.txt "$AUTH_SERVICE_URL/csrf-token" | jq -r '.token')
    
    # Register test user
    REGISTER_RESPONSE=$(curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
        "$AUTH_SERVICE_URL/register")
    
    echo "$REGISTER_RESPONSE" | grep -q "access_token" && echo "Registration successful!" || echo "Registration failed!"
    
    # Login test
    LOGIN_RESPONSE=$(curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$TEST_EMAIL&password=$TEST_PASSWORD" \
        "$AUTH_SERVICE_URL/login")
    
    echo "$LOGIN_RESPONSE" | grep -q "access_token" && echo "Login successful!" || echo "Login failed!"
    
    # Clean up
    rm cookies.txt
fi

echo "✅ Deployment verification completed!"
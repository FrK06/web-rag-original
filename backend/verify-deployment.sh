#!/bin/bash
set -e

echo "🧪 Railway Deployment Verification 🧪"
echo "===================================="
echo "Checking all microservices deployment status"
echo "------------------------------------"

# Get environment variables
echo "Loading environment variables..."
if [ -f .env ]; then
    source .env
else
    echo "⚠️ .env file not found. Please input the required URLs:"
    read -p "Frontend URL: " FRONTEND_URL
    read -p "API Gateway URL: " API_GATEWAY_URL
    read -p "Conversation Service URL: " CONVERSATION_SERVICE_URL
    read -p "Search Service URL: " SEARCH_SERVICE_URL
    read -p "Multimedia Service URL: " MULTIMEDIA_SERVICE_URL
    read -p "Notification Service URL: " NOTIFICATION_SERVICE_URL
    read -p "LLM Service URL: " LLM_SERVICE_URL
    read -p "Auth Service URL: " AUTH_SERVICE_URL
fi

# Function for service health checks
check_service() {
    local name=$1
    local url=$2
    echo -n "🔍 Checking $name... "
    
    HEALTH_CHECK=$(curl -s -o response.txt -w "%{http_code}" "$url")
    
    if [ "$HEALTH_CHECK" == "200" ]; then
        if grep -q "\"status\":\"healthy\"" response.txt; then
            echo "✅ $name is healthy!"
            return 0
        else
            echo "⚠️ $name returned 200 but reports unhealthy status!"
            cat response.txt
            return 1
        fi
    else
        echo "❌ $name check failed with HTTP $HEALTH_CHECK!"
        cat response.txt
        return 1
    fi
}

# Check frontend
echo -n "🔍 Checking frontend... "
if curl -s "$FRONTEND_URL" | grep -q "<title>"; then
    echo "✅ Frontend is up!"
else
    echo "❌ Frontend check failed!"
fi

# Check API Gateway health 
check_service "API Gateway" "$API_GATEWAY_URL/api/health"
API_GATEWAY_STATUS=$?

# Check all individual microservices
echo -e "\n📊 Checking individual microservices:"
check_service "Conversation Service" "$CONVERSATION_SERVICE_URL/health"
check_service "Search Service" "$SEARCH_SERVICE_URL/health"
check_service "Multimedia Service" "$MULTIMEDIA_SERVICE_URL/health"
check_service "Notification Service" "$NOTIFICATION_SERVICE_URL/health"
check_service "LLM Service" "$LLM_SERVICE_URL/health"
check_service "Auth Service" "$AUTH_SERVICE_URL/health"

# Verify API Gateway connections to all services
if [ $API_GATEWAY_STATUS -eq 0 ]; then
    echo -e "\n🔌 Verifying API Gateway connections to all microservices:"
    
    API_HEALTH=$(curl -s "$API_GATEWAY_URL/api/health")
    
    # Check connections status for each service
    echo "$API_HEALTH" | jq -r '.services | to_entries[] | "\(.key): \(.value)"' | while read line; do
        service_name=$(echo $line | cut -d':' -f1)
        status=$(echo $line | cut -d':' -f2- | xargs)
        
        if [ "$status" == "healthy" ]; then
            echo "✅ Connection to $service_name is working"
        else
            echo "❌ Connection to $service_name failed: $status"
        fi
    done
    
    # Check overall status
    if echo "$API_HEALTH" | grep -q "\"status\":\"healthy\""; then
        echo -e "\n🎉 All services are properly connected through API Gateway!"
    else
        echo -e "\n⚠️ Some services are not properly connected. Check configuration!"
    fi
fi

# Test authorization flow (optional)
echo -e "\n🔐 Do you want to test the authentication flow? (y/n)"
read testAuth
if [ "$testAuth" = "y" ]; then
    echo "Testing registration and login..."
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        echo "⚠️ jq is required for this test but not installed. Skipping auth flow test."
    else
        # Generate a test email
        TEST_EMAIL="test-$(date +%s)@example.com"
        TEST_PASSWORD="TestPass123!"
        
        echo "🔑 Getting CSRF token..."
        CSRF_RESPONSE=$(curl -s -c cookies.txt "$API_GATEWAY_URL/api/auth/csrf-token")
        CSRF_TOKEN=$(echo $CSRF_RESPONSE | jq -r '.token')
        
        if [ -z "$CSRF_TOKEN" ] || [ "$CSRF_TOKEN" == "null" ]; then
            echo "❌ Failed to get CSRF token!"
            echo $CSRF_RESPONSE
        else
            echo "✅ Got CSRF token: ${CSRF_TOKEN:0:10}..."
            
            # Register test user
            echo "👤 Registering test user: $TEST_EMAIL"
            REGISTER_RESPONSE=$(curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" \
                -H "Content-Type: application/json" \
                -d "{\"name\":\"Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
                "$API_GATEWAY_URL/api/auth/register")
            
            if echo "$REGISTER_RESPONSE" | grep -q "access_token"; then
                echo "✅ Registration successful!"
                
                # Extract tokens for future API calls
                ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.access_token')
                REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.refresh_token')
                
                # Login test
                echo "🔑 Testing login with same credentials"
                LOGIN_RESPONSE=$(curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" \
                    -H "Content-Type: application/x-www-form-urlencoded" \
                    -d "username=$TEST_EMAIL&password=$TEST_PASSWORD" \
                    "$API_GATEWAY_URL/api/auth/login")
                
                if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
                    echo "✅ Login successful!"
                    
                    # Test authenticated API call
                    echo "🔒 Testing authenticated API call"
                    ME_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
                        "$API_GATEWAY_URL/api/auth/me")
                    
                    if echo "$ME_RESPONSE" | grep -q "user"; then
                        echo "✅ Authenticated API call successful!"
                    else
                        echo "❌ Authenticated API call failed!"
                        echo $ME_RESPONSE
                    fi
                    
                    # Test refresh token
                    echo "🔄 Testing token refresh"
                    REFRESH_RESPONSE=$(curl -s -H "Content-Type: application/json" \
                        -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" \
                        "$API_GATEWAY_URL/api/auth/refresh")
                    
                    if echo "$REFRESH_RESPONSE" | grep -q "access_token"; then
                        echo "✅ Token refresh successful!"
                    else
                        echo "❌ Token refresh failed!"
                        echo $REFRESH_RESPONSE
                    fi
                else
                    echo "❌ Login failed!"
                    echo $LOGIN_RESPONSE
                fi
            else
                echo "❌ Registration failed!"
                echo $REGISTER_RESPONSE
            fi
        fi
        
        # Clean up
        rm -f cookies.txt response.txt
    fi
fi

# Test LLM service (optional)
echo -e "\n🤖 Do you want to test the LLM service? (y/n)"
read testLLM
if [ "$testLLM" = "y" ]; then
    echo "Sending a sample query to LLM service..."
    
    QUERY_RESPONSE=$(curl -s -H "Content-Type: application/json" \
        -d '{"query": "What is the current date?", "thread_id": "test-thread", "mode": "explore"}' \
        "$API_GATEWAY_URL/api/chat/")
    
    if echo "$QUERY_RESPONSE" | grep -q "message"; then
        echo "✅ LLM query successful!"
        echo "Response preview: $(echo $QUERY_RESPONSE | jq -r '.message' | head -c 100)..."
    else
        echo "❌ LLM query failed!"
        echo $QUERY_RESPONSE
    fi
fi

echo -e "\n✅ Deployment verification completed!"
echo "===================================="
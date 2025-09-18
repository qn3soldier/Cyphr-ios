#!/bin/bash

# 🚀 CYPHR MESSENGER - REAL USER TESTING SETUP
# This script prepares your environment for real user testing

echo "🚀 CYPHR MESSENGER - REAL USER TESTING SETUP"
echo "============================================="
echo ""

# Check if servers are running
echo "📊 Checking service status..."

# Check frontend server
if curl -s http://localhost:5173/ > /dev/null; then
    echo "✅ Frontend server running on http://localhost:5173"
else
    echo "❌ Frontend server not running"
    echo "   Starting frontend server..."
    npm run dev &
    sleep 5
    if curl -s http://localhost:5173/ > /dev/null; then
        echo "✅ Frontend server started successfully"
    else
        echo "❌ Failed to start frontend server"
        exit 1
    fi
fi

# Check backend server
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server running on http://localhost:3001"
else
    echo "❌ Backend server not running"
    echo "   Starting backend server..."
    node server.ts &
    sleep 3
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "✅ Backend server started successfully"
    else
        echo "❌ Failed to start backend server"
        exit 1
    fi
fi

# Check Supabase
echo "📊 Checking Supabase status..."
if npx supabase status > /dev/null 2>&1; then
    echo "✅ Supabase local development running"
else
    echo "❌ Supabase not running"
    echo "   Please start Supabase with: npx supabase start"
    exit 1
fi

# Check database connectivity
echo "📊 Testing database connectivity..."
if curl -s "http://127.0.0.1:54321/rest/v1/users?select=id&limit=1" \
   -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" > /dev/null; then
    echo "✅ Database connectivity working"
else
    echo "❌ Database connectivity failed"
    echo "   Check Supabase configuration"
    exit 1
fi

# Install Playwright if needed
echo "📊 Checking Playwright installation..."
if command -v npx playwright --version > /dev/null 2>&1; then
    echo "✅ Playwright already installed"
else
    echo "📦 Installing Playwright..."
    npm install playwright
    npx playwright install
fi

# Create screenshots directory
mkdir -p screenshots

# Clear any existing user sessions (optional)
echo ""
echo "🧹 CLEANUP OPTIONS:"
echo "1. Keep existing user sessions (recommended for quick testing)"
echo "2. Clear all user sessions (clean slate)"
read -p "Choose option (1 or 2): " cleanup_choice

if [ "$cleanup_choice" = "2" ]; then
    echo "🧹 Clearing user sessions..."
    # This would clear browser localStorage, but that's browser-specific
    echo "   Manual step: Clear browser data for localhost:5173 in both browsers"
    echo "   Chrome: Settings → Privacy → Clear browsing data → Cookies and site data"
    echo "   Firefox: Settings → Privacy → Clear Data → Cookies and Site Data"
fi

echo ""
echo "🎯 ENVIRONMENT READY FOR TESTING!"
echo "=================================="
echo ""
echo "📱 NEXT STEPS:"
echo "1. Get a friend/colleague with a real phone number"
echo "2. Run the automated test helper:"
echo "   node test-two-real-users.mjs"
echo ""
echo "📖 OR follow the manual guide:"
echo "   cat REAL_USER_TESTING_GUIDE.md"
echo ""
echo "🌐 TEST URLS:"
echo "   Frontend: http://localhost:5173"
echo "   Backend Health: http://localhost:3001/health"
echo "   Supabase Studio: http://127.0.0.1:54323"
echo ""
echo "📞 REQUIRED: Two real phone numbers that can receive SMS"
echo "🌐 REQUIRED: Two browsers/devices on same network"
echo ""
echo "🚀 HAPPY TESTING!"
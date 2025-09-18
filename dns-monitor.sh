#!/bin/bash

# DNS Propagation Monitor for Cyphr Messenger
# This script checks if DNS has propagated to AWS servers

echo "🔍 DNS Propagation Monitor for cyphrmessenger.app"
echo "=================================================="
echo ""
echo "📋 Expected AWS Nameservers:"
echo "  • ns-227.awsdns-28.com"
echo "  • ns-1538.awsdns-00.co.uk"
echo "  • ns-568.awsdns-07.net"
echo "  • ns-1298.awsdns-34.org"
echo ""
echo "🎯 Expected IP for all domains: 23.22.159.209"
echo ""
echo "=================================================="

while true; do
    clear
    echo "🔍 DNS Propagation Status - $(date)"
    echo "=================================================="
    echo ""
    
    # Check nameservers
    echo "📌 NAMESERVERS CHECK:"
    NS_RESULT=$(dig cyphrmessenger.app NS +short 2>/dev/null)
    if echo "$NS_RESULT" | grep -q "awsdns"; then
        echo "✅ Nameservers: MIGRATED TO AWS!"
        echo "$NS_RESULT" | sed 's/^/   /'
    else
        echo "⏳ Nameservers: Still on GoDaddy"
        echo "$NS_RESULT" | sed 's/^/   /'
    fi
    echo ""
    
    # Check main domain
    echo "📌 DOMAIN IP RESOLUTION:"
    echo ""
    
    # Check root domain
    ROOT_IP=$(dig cyphrmessenger.app A +short 2>/dev/null | head -1)
    if [ "$ROOT_IP" = "23.22.159.209" ]; then
        echo "✅ cyphrmessenger.app → $ROOT_IP (NEW SERVER!)"
    elif [ -z "$ROOT_IP" ]; then
        echo "⏳ cyphrmessenger.app → No A record yet"
    else
        echo "❌ cyphrmessenger.app → $ROOT_IP (OLD/WRONG)"
    fi
    
    # Check www subdomain
    WWW_IP=$(dig www.cyphrmessenger.app A +short 2>/dev/null | head -1)
    if [ "$WWW_IP" = "23.22.159.209" ]; then
        echo "✅ www.cyphrmessenger.app → $WWW_IP (NEW SERVER!)"
    elif echo "$WWW_IP" | grep -q "netlify"; then
        echo "❌ www.cyphrmessenger.app → Still on Netlify"
    elif [ -z "$WWW_IP" ]; then
        echo "⏳ www.cyphrmessenger.app → Resolving..."
    else
        echo "❌ www.cyphrmessenger.app → $WWW_IP (OLD/WRONG)"
    fi
    
    # Check app subdomain
    APP_IP=$(dig app.cyphrmessenger.app A +short 2>/dev/null | head -1)
    if [ "$APP_IP" = "23.22.159.209" ]; then
        echo "✅ app.cyphrmessenger.app → $APP_IP (NEW SERVER!)"
    elif [ "$APP_IP" = "18.207.49.24" ]; then
        echo "❌ app.cyphrmessenger.app → $APP_IP (OLD SERVER!)"
    elif [ -z "$APP_IP" ]; then
        echo "⏳ app.cyphrmessenger.app → Resolving..."
    else
        echo "❌ app.cyphrmessenger.app → $APP_IP (UNKNOWN)"
    fi
    echo ""
    
    # Check with different DNS servers
    echo "📌 GLOBAL DNS PROPAGATION:"
    echo ""
    
    # Google DNS
    GOOGLE_CHECK=$(dig @8.8.8.8 app.cyphrmessenger.app +short 2>/dev/null | head -1)
    if [ "$GOOGLE_CHECK" = "23.22.159.209" ]; then
        echo "✅ Google DNS (8.8.8.8): Updated"
    else
        echo "⏳ Google DNS (8.8.8.8): Not yet ($GOOGLE_CHECK)"
    fi
    
    # Cloudflare DNS
    CF_CHECK=$(dig @1.1.1.1 app.cyphrmessenger.app +short 2>/dev/null | head -1)
    if [ "$CF_CHECK" = "23.22.159.209" ]; then
        echo "✅ Cloudflare DNS (1.1.1.1): Updated"
    else
        echo "⏳ Cloudflare DNS (1.1.1.1): Not yet ($CF_CHECK)"
    fi
    
    # OpenDNS
    OPEN_CHECK=$(dig @208.67.222.222 app.cyphrmessenger.app +short 2>/dev/null | head -1)
    if [ "$OPEN_CHECK" = "23.22.159.209" ]; then
        echo "✅ OpenDNS (208.67.222.222): Updated"
    else
        echo "⏳ OpenDNS (208.67.222.222): Not yet ($OPEN_CHECK)"
    fi
    
    echo ""
    echo "=================================================="
    
    # Check if all are migrated
    if [ "$ROOT_IP" = "23.22.159.209" ] && [ "$WWW_IP" = "23.22.159.209" ] && [ "$APP_IP" = "23.22.159.209" ] && echo "$NS_RESULT" | grep -q "awsdns"; then
        echo ""
        echo "🎉 🎉 🎉 MIGRATION COMPLETE! 🎉 🎉 🎉"
        echo "All domains now point to the new AWS server!"
        echo ""
        echo "You can now access:"
        echo "  • https://www.cyphrmessenger.app (Landing)"
        echo "  • https://app.cyphrmessenger.app (Application)"
        echo ""
        break
    else
        echo ""
        echo "⏳ Migration in progress..."
        echo "   This can take 5-48 hours after changing nameservers in GoDaddy"
        echo ""
        echo "💡 TIP: Clear your DNS cache:"
        echo "   macOS: sudo dscacheutil -flushcache"
        echo "   Chrome: chrome://net-internals/#dns → Clear host cache"
        echo ""
        echo "🔄 Refreshing in 60 seconds... (Press Ctrl+C to stop)"
    fi
    
    sleep 60
done
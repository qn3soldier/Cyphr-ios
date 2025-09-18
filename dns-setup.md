# DNS Configuration for Cyphr Messenger

## Required DNS Records

### Main Domain
```
Type: A
Name: app
Value: 18.207.49.24
TTL: 300
```

### API Subdomain
```
Type: A
Name: api
Value: 18.207.49.24
TTL: 300
```

### WebSocket Subdomain
```
Type: A
Name: ws
Value: 18.207.49.24
TTL: 300
```

## Cloudflare Configuration (if using)

1. **SSL/TLS Setting**: Full (strict)
2. **Always Use HTTPS**: ON
3. **HTTP Strict Transport Security (HSTS)**: Enable
4. **Minimum TLS Version**: 1.2
5. **Opportunistic Encryption**: ON
6. **TLS 1.3**: ON
7. **Automatic HTTPS Rewrites**: ON

## Verification

After DNS propagation (5-30 minutes), verify with:

```bash
dig app.cyphrmessenger.app
nslookup app.cyphrmessenger.app
curl -I https://app.cyphrmessenger.app
```

## Production URLs

- Frontend: https://app.cyphrmessenger.app
- API: https://api.cyphrmessenger.app
- WebSocket: wss://ws.cyphrmessenger.app

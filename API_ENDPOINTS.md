# 📡 API ENDPOINTS - ПОЛНЫЙ СПИСОК
## Обновлено: 19 августа 2025

## 🔐 AUTHENTICATION ENDPOINTS

### **POST /api/send-otp**
```javascript
Body: { phone: "+1234567890" }
Response: { success: true, message: "OTP sent" }
Auth: None
```

### **POST /api/auth/verify-otp-jwt**
```javascript
Body: { phone: "+1234567890", code: "123456" }
Response: { 
  success: true, 
  accessToken: "jwt...",
  refreshToken: "jwt...",
  user: { id, phone, name }
}
Auth: None
```

### **POST /api/login**
```javascript
Body: { phone: "+1234567890" }
Response: { success: true, message: "Login OTP sent", userId: "uuid" }
Auth: None
```

### **POST /api/verify-login**
```javascript
Body: { phone: "+1234567890", code: "123456" }
Response: { success: true, accessToken: "jwt...", refreshToken: "jwt..." }
Auth: None
```

### **POST /api/refresh-token**
```javascript
Body: { refreshToken: "jwt..." }
Response: { accessToken: "new-jwt..." }
Auth: None
```

### **POST /api/logout**
```javascript
Headers: { Authorization: "Bearer jwt..." }
Response: { success: true }
Auth: JWT Required
```

## 👤 USER ENDPOINTS

### **GET /api/profile**
```javascript
Headers: { Authorization: "Bearer jwt..." }
Response: { user: { id, phone, name, avatar_url, cyphr_id } }
Auth: JWT Required
```

### **PUT /api/profile**
```javascript
Headers: { Authorization: "Bearer jwt..." }
Body: { name: "John", bio: "Hello" }
Response: { success: true }
Auth: JWT Required
```

## 🔍 DISCOVERY ENDPOINTS (ALL REQUIRE JWT)

### **POST /api/discovery/check-cyphr-id**
```javascript
Body: { cyphrId: "alice_quantum" }
Response: { success: true, available: true, suggestions: [] }
Auth: JWT Required
```

### **POST /api/discovery/set-cyphr-id**
```javascript
Body: { cyphrId: "alice_quantum" }
Response: { success: true, cyphrId: "@alice_quantum" }
Auth: JWT Required
```

### **GET /api/discovery/search-cyphr-id/:cyphrId**
```javascript
Response: { success: true, user: { id, cyphr_id, full_name }, found: true }
Auth: JWT Required
```

### **POST /api/discovery/generate-qr-token**
```javascript
Response: { 
  success: true, 
  qrCode: "data:image/png;base64...",
  token: "abc123",
  expiresAt: "2025-08-19T..."
}
Auth: JWT Required
```

### **POST /api/discovery/scan-qr-token**
```javascript
Body: { token: "abc123" }
Response: { success: true, user: { id, cyphr_id, full_name } }
Auth: JWT Required
```

### **POST /api/discovery/generate-share-link**
```javascript
Response: { success: true, shareLink: "cyphr.me/add/alice_quantum" }
Auth: JWT Required
```

### **POST /api/discovery/enable-nearby**
```javascript
Body: { durationMinutes: 10 }
Response: { success: true, visible: true, expiresAt: "..." }
Auth: JWT Required
```

### **POST /api/discovery/get-nearby**
```javascript
Body: { regionHash: "region_north_123" }
Response: { success: true, users: [...] }
Auth: JWT Required
```

### **POST /api/discovery/enable-phone-discovery**
```javascript
Body: { phoneNumber: "+1234567890" }
Response: { success: true }
Auth: JWT Required
```

### **POST /api/discovery/search-phone-hash**
```javascript
Body: { phoneNumber: "+1234567890" }
Response: { success: true, user: { ... } }
Auth: JWT Required
```

## 💬 MESSAGING ENDPOINTS

### **POST /api/messages/send**
```javascript
Body: { 
  recipientId: "uuid",
  content: "encrypted-content",
  type: "text"
}
Response: { success: true, messageId: "uuid" }
Auth: JWT Required
```

### **GET /api/messages/thread/:userId**
```javascript
Response: { messages: [...], pagination: {} }
Auth: JWT Required
```

### **POST /api/messages/mark-read**
```javascript
Body: { messageIds: ["uuid1", "uuid2"] }
Response: { success: true }
Auth: JWT Required
```

## 💰 WALLET ENDPOINTS

### **POST /api/wallet/create**
```javascript
Body: { pin: "1234" }
Response: { 
  success: true,
  publicKey: "G...",
  encryptedSeed: "encrypted..."
}
Auth: JWT Required
```

### **GET /api/wallet/balance**
```javascript
Response: { 
  balances: [
    { asset: "XLM", amount: "100.50" },
    { asset: "USDC", amount: "50.00" }
  ]
}
Auth: JWT Required
```

### **POST /api/wallet/send**
```javascript
Body: {
  destination: "G...",
  amount: "10",
  asset: "XLM",
  memo: "Payment"
}
Response: { success: true, transactionHash: "..." }
Auth: JWT Required
```

### **GET /api/wallet/history**
```javascript
Response: { transactions: [...], pagination: {} }
Auth: JWT Required
```

## 📞 CALL ENDPOINTS

### **GET /api/ice-servers**
```javascript
Response: {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:23.22.159.209:3478", username: "...", credential: "..." }
  ]
}
Auth: JWT Required
```

### **POST /api/calls/initiate**
```javascript
Body: { recipientId: "uuid", type: "video" }
Response: { success: true, callId: "uuid" }
Auth: JWT Required
```

## 🔧 UTILITY ENDPOINTS

### **GET /api/health**
```javascript
Response: { status: "healthy", timestamp: "..." }
Auth: None
```

### **GET /api/version**
```javascript
Response: { version: "1.0.0", features: [...] }
Auth: None
```

## 📝 ПРИМЕЧАНИЯ

1. **JWT Format**: `Bearer eyJhbGciOiJIUzI1NiIs...`
2. **Error Format**: `{ success: false, error: "Error message" }`
3. **Rate Limits**: 
   - Auth: 5 requests/minute
   - Messages: 30 requests/minute
   - Wallet: 10 requests/minute
4. **Timeout**: 30 seconds for all endpoints

---

**ВСЕГДА ПРОВЕРЯТЬ ЭТОТ ФАЙЛ ПЕРЕД РАБОТОЙ С API!**
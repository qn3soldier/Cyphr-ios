# 🔐 CYPHR ID AUTHENTICATION FIX PLAN

## 🚨 **ТЕКУЩИЕ ПРОБЛЕМЫ:**
1. ❌ Frontend передает `password`, backend ожидает `pin`
2. ❌ Нет проверки статуса пользователя перед логином 
3. ❌ Всегда показывается password поле, даже если PIN не установлен
4. ❌ Нет поддержки биометрии в Cyphr ID login
5. ❌ Нет "direct login" для пользователей без защиты

## 🎯 **ПЛАН ИСПРАВЛЕНИЯ:**

### **ФАЗА 1: BACKEND ENDPOINTS**
1. **Создать `/api/auth/check-cyphr-id-status` endpoint**:
   ```javascript
   POST /api/auth/check-cyphr-id-status
   { cyphrId: "user123" }
   → { hasPin: true/false, hasBiometry: true/false, userId: "uuid" }
   ```

2. **Обновить `/api/auth/cyphr-id-login` endpoint**:
   - Поддержка параметра `pin` (не `password`)
   - Поддержка direct login без PIN
   - Правильная обработка biometry флага

### **ФАЗА 2: FRONTEND LOGIC**
1. **Обновить `CyphrIdLogin.jsx`**:
   - Добавить проверку статуса пользователя при загрузке
   - Условное отображение полей (PIN/direct login)
   - Убрать hardcoded "password" поле

2. **Обновить `authService.js`**:
   - Добавить метод `checkCyphrIdStatus(cyphrId)`
   - Исправить параметры в `cyphrIdLogin()` (password → pin)
   - Добавить поддержку direct login

### **ФАЗА 3: UX FLOW**
1. **Новый Authentication Flow**:
   ```
   User enters Cyphr ID → 
   Check user status →
   IF hasPin: Show PIN field →
   IF hasBiometry: Show biometry option →
   IF neither: Direct login →
   Success: Navigate to /chats
   ```

2. **UI States**:
   - Loading: "Checking account..."
   - PIN required: Show PIN input
   - Direct login: Auto-login button
   - Error: Clear error messages

### **ФАЗА 4: TESTING**
1. **Test Cases**:
   - User with PIN set
   - User with biometry set  
   - User with no security (direct login)
   - Invalid Cyphr ID
   - Wrong PIN
   - Network errors

## 🔧 **IMPLEMENTATION ORDER:**
1. ✅ Backup created: `backups/cyphr-id-auth-fix-20250901-161056/`
2. 🔄 Backend: Create `check-cyphr-id-status` endpoint
3. 🔄 Backend: Fix `cyphr-id-login` parameter handling
4. 🔄 Frontend: Add status checking logic
5. 🔄 Frontend: Update UI conditional rendering
6. 🔄 Frontend: Fix authService method calls
7. 🔄 Testing: All authentication scenarios
8. 🔄 Deploy and verify production

## 🎯 **SUCCESS CRITERIA:**
- ✅ User with PIN can login with PIN
- ✅ User without PIN can login directly  
- ✅ No parameter mismatches in API calls
- ✅ Clean UX without unnecessary fields
- ✅ Proper error handling for all cases
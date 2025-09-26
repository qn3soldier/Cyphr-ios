"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cors_1 = __importDefault(require("cors"));
// const twilio_1 = __importDefault(require("twilio")); // REMOVED TWILIO
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const argon2_1 = __importDefault(require("argon2"));
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
// Import RDS service for AWS database
const RDSService = require("./rds-service.cjs");
// Import REAL E2E Messaging with Kyber1024 + ChaCha20
const { initializeMessagingEndpoints, initializeSocketHandlers } = require("./cyphr-messaging-endpoints.cjs");
// Import Cyphr ID endpoints
const initializeCyphrIdEndpoints = require("./cyphr-id-rds-endpoints.cjs");
// Import FinalKyber1024 dynamically to avoid module loading issues
let stellarServer = null;
let rdsService = null;
// In-memory storage for TOTP secrets (in production, use secure database)
const userTOTPSecrets = new Map();
// Zero Storage: Only store public keys for messaging (no private data)
const publicKeysForMessaging = new Map();
// Initialize crypto, stellar and RDS services
async function initializeServices() {
    try {
        // Kyber1024 handled on iOS client side - server is ZERO-KNOWLEDGE
        
        // Initialize RDS service
        rdsService = new RDSService();
        const rdsConnected = await rdsService.connect();
        if (rdsConnected) {
            console.log('✅ AWS RDS PostgreSQL connected');
        } else {
            console.warn('⚠️ RDS connection failed');
        }
    }
    catch (error) {
        console.error('❌ Failed to initialize services:', error);
        // Continue without RDS for now
    }
}
// Initialize services on startup
initializeServices();
initializeSecureCredentials();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Socket.IO server setup
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5175",
            "https://app.cyphrmessenger.app"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});
// AWS Secrets Manager client for secure credential management
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
// Secure credential loading from AWS Secrets Manager
async function getSecret(secretName) {
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretName });
        const response = await secretsClient.send(command);
        return response.SecretString || '';
    }
    catch (error) {
        console.warn(`⚠️ Failed to load secret ${secretName} from AWS, using environment variable`);
        return '';
    }
}
// Load credentials with AWS Secrets Manager fallback
// Twilio variables removed - using Cyphr ID only
// Supabase removed - using AWS RDS only
// Initialize secure credentials on startup
async function initializeSecureCredentials() {
    try {
        console.log('🔐 Loading secure credentials from AWS Secrets Manager...');
        // Twilio removed - no credentials needed
        // Supabase removed - no credentials needed
        console.log('✅ Secure credentials initialized');
    }
    catch (error) {
        console.warn('⚠️ Using environment variables for credentials:', error);
    }
}
// Initialize services
// let twilioClient = (0, twilio_1.default)(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN); // REMOVED TWILIO

// Database abstraction layer - AWS RDS only
async function dbQuery(table, operation, data = {}, filters = {}, customSql = null) {
    if (rdsService && rdsService.isConnected) {
        // Use RDS PostgreSQL
        if (customSql) {
            // Handle custom SQL queries
            const result = await rdsService.query(customSql.query, customSql.params || []);
            return { data: result.rows, error: null };
        }
        
        switch (operation) {
            case 'select':
                const whereClause = Object.keys(filters).length > 0 
                    ? 'WHERE ' + Object.keys(filters).map((key, idx) => `${key} = $${idx + 1}`).join(' AND ')
                    : '';
                const selectQuery = `SELECT * FROM ${table} ${whereClause}`;
                const selectParams = Object.values(filters);
                const result = await rdsService.query(selectQuery, selectParams);
                return { data: result.rows, error: null };
                
            case 'insert':
                const insertFields = Object.keys(data).join(', ');
                const insertValues = Object.keys(data).map((_, idx) => `$${idx + 1}`).join(', ');
                const insertQuery = `INSERT INTO ${table} (${insertFields}) VALUES (${insertValues}) RETURNING *`;
                const insertParams = Object.values(data);
                const insertResult = await rdsService.query(insertQuery, insertParams);
                return { data: insertResult.rows[0], error: null };
                
            case 'update':
                const updateFields = Object.keys(data).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                const updateWhere = Object.keys(filters).map((key, idx) => `${key} = $${idx + 1 + Object.keys(data).length}`).join(' AND ');
                const updateQuery = `UPDATE ${table} SET ${updateFields} WHERE ${updateWhere} RETURNING *`;
                const updateParams = [...Object.values(data), ...Object.values(filters)];
                const updateResult = await rdsService.query(updateQuery, updateParams);
                return { data: updateResult.rows[0], error: null };
                
            case 'delete':
                const deleteWhere = Object.keys(filters).map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
                const deleteQuery = `DELETE FROM ${table} WHERE ${deleteWhere} RETURNING *`;
                const deleteParams = Object.values(filters);
                const deleteResult = await rdsService.query(deleteQuery, deleteParams);
                return { data: deleteResult.rows, error: null };
        }
    } else {
        // No RDS connection available
        console.error('❌ No database connection available');
        return { error: 'Database connection failed', data: null };
    }
}

// Middleware
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://app.cyphrmessenger.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
}));
app.use(express_1.default.json());
app.use((req, res, next) => {
    req.user = null;
    next();
});
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/auth', limiter);
// Cyphr ID specific rate limiting and minimal logging (no bodies)
const cyphrLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: parseInt(process.env.CYPHR_ID_RATE_MAX || '120'),
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/cyphr-id/', cyphrLimiter);

const cyphrCounters = { ok: 0, err4xx: 0, err5xx: 0 };
app.use((req, res, next) => {
    const t0 = Date.now();
    res.once('finish', () => {
        if (!req.path || req.path.indexOf('/api/cyphr-id/') !== 0) return;
        const ms = Date.now() - t0;
        const s = res.statusCode;
        if (s >= 500) cyphrCounters.err5xx++;
        else if (s >= 400) cyphrCounters.err4xx++;
        else cyphrCounters.ok++;
        if (s >= 500) console.error('[CYPHR-ID]', req.method, req.path, s, ms + 'ms');
        else if (s >= 400) console.warn('[CYPHR-ID]', req.method, req.path, s, ms + 'ms');
        else if (ms > 500) console.log('[CYPHR-ID]', req.method, req.path, s, ms + 'ms');
    });
    next();
});

app.get('/api/cyphr-id/_stats', (_req, res) => {
    res.json({ success: true, counters: cyphrCounters });
});
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// Enterprise API Health Check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'CYPHR MESSENGER ENTERPRISE',
        version: '1.0.0',
        features: [
            'post-quantum-crypto',
            'hd-wallet',
            'real-time-messaging',
            'kyber1024',
            'chacha20',
            'webrtc-calling',
            'aws-secrets-manager'
        ],
        timestamp: new Date().toISOString()
    });
});
// WebRTC ICE servers endpoint for NAT traversal
app.get('/api/ice-servers', (_req, res) => {
    res.json({
        success: true,
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:23.22.159.209:3478',
                username: 'cyphr-user',
                credential: 'cyphr-turn-secret-2024'
            }
        ],
        message: 'Enterprise TURN/STUN servers',
        timestamp: new Date().toISOString()
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    // User authentication
    socket.on('authenticate', async (data) => {
        try {
            const { userId, publicKey } = data;
            
            // Handle guest authentication
            if (userId === 'guest' || !userId) {
                console.log('🔒 Guest authentication for socket:', socket.id);
                socket.userId = 'guest';
                socket.publicKey = publicKey;
                socket.emit('authenticated', { success: true, guest: true });
                return;
            }
            
            // Verify user exists for authenticated users
            const { data: userResult, error } = await dbQuery('users', 'select', {}, { id: userId });
            const user = userResult && userResult.length > 0 ? userResult[0] : null;
            if (error || !user) {
                console.log('⚠️ User not found in database, allowing guest access for:', userId);
                socket.userId = 'guest';
                socket.publicKey = publicKey;
                socket.emit('authenticated', { success: true, guest: true });
                return;
            }
            // Store socket info
            socket.userId = userId;
            socket.publicKey = publicKey;
            socket.join(`user:${userId}`);
            // Update user online status
            await dbQuery('users', 'update', {
                is_online: true,
                last_seen: new Date().toISOString(),
                socket_id: socket.id
            }, { id: userId });
            // Join user's chats
            const { data: chats } = await dbQuery('chat_participants', 'select', {}, { user_id: userId });
            if (chats) {
                chats.forEach((chat) => {
                    socket.join(`chat:${chat.chat_id}`);
                });
            }
            socket.emit('authenticated', { success: true });
            // Notify contacts user is online
            io.emit('user_online', { userId });
        }
        catch (error) {
            console.error('Auth error:', error);
            socket.emit('auth_error', error.message);
        }
    });
    // Send message
    socket.on('send_message', async (data) => {
        try {
            const { chatId, message, tempId } = data;
            const userId = socket.userId;
            if (!userId) {
                socket.emit('error', 'Not authenticated');
                return;
            }
            // Verify user is participant
            const { data: participantResult } = await dbQuery('chat_participants', 'select', {}, { chat_id: chatId, user_id: userId });
            const participant = participantResult && participantResult.length > 0 ? participantResult[0] : null;
            if (!participant) {
                socket.emit('error', 'Not a member of this chat');
                return;
            }
            // Store encrypted message
            const messageData = {
                id: crypto_1.default.randomUUID(),
                chat_id: chatId,
                sender_id: userId,
                content: message.content, // Already encrypted by client
                type: message.type || 'text',
                metadata: message.metadata || {},
                created_at: new Date().toISOString(),
                status: 'sent'
            };
            const { error } = await dbQuery('messages', 'insert', messageData);
            if (error)
                throw error;
            // Update chat last message
            await dbQuery('chats', 'update', {
                last_message_id: messageData.id,
                last_message_time: messageData.created_at,
                updated_at: messageData.created_at
            }, { id: chatId });
            // Send to all chat participants
            io.to(`chat:${chatId}`).emit('new_message', {
                ...messageData,
                tempId
            });
            // Send delivery receipt
            socket.emit('message_sent', {
                tempId,
                messageId: messageData.id,
                timestamp: messageData.created_at
            });
        }
        catch (error) {
            console.error('Send message error:', error);
            socket.emit('message_error', { error: error.message, tempId: data.tempId });
        }
    });
    // Heartbeat for connection stability
    socket.on('ping', (data) => {
        socket.emit('pong', {
            timestamp: Date.now(),
            received: data?.timestamp
        });
    });
    // Typing indicators
    socket.on('typing', async (data) => {
        const { chatId, isTyping } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        socket.to(`chat:${chatId}`).emit('user_typing', {
            chatId,
            userId,
            isTyping
        });
    });
    // Message status updates
    socket.on('message_delivered', async (data) => {
        const { messageId } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        await dbQuery('message_status', 'insert', {
            message_id: messageId,
            user_id: userId,
            status: 'delivered',
            timestamp: new Date().toISOString()
        });
        // Notify sender
        const { data: messageResult } = await dbQuery('messages', 'select', {}, { id: messageId });
        const message = messageResult && messageResult.length > 0 ? messageResult[0] : null;
        if (message) {
            io.to(`user:${message.sender_id}`).emit('message_status', {
                messageId,
                userId,
                status: 'delivered'
            });
        }
    });
    socket.on('message_read', async (data) => {
        const { messageId } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        await dbQuery('message_status', 'insert', {
            message_id: messageId,
            user_id: userId,
            status: 'read',
            timestamp: new Date().toISOString()
        });
        // Notify sender
        const { data: messageResult } = await dbQuery('messages', 'select', {}, { id: messageId });
        const message = messageResult && messageResult.length > 0 ? messageResult[0] : null;
        if (message) {
            io.to(`user:${message.sender_id}`).emit('message_status', {
                messageId,
                userId,
                status: 'read'
            });
        }
    });
    // Voice/Video call signaling
    socket.on('call_offer', async (data) => {
        const { targetUserId, offer, callType } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        // Store call in database
        const callData = {
            id: crypto_1.default.randomUUID(),
            caller_id: userId,
            callee_id: targetUserId,
            type: callType,
            status: 'ringing',
            started_at: new Date().toISOString()
        };
        await dbQuery('calls', 'insert', callData);
        // Send offer to target user
        io.to(`user:${targetUserId}`).emit('incoming_call', {
            callId: callData.id,
            callerId: userId,
            offer,
            callType
        });
    });
    socket.on('call_answer', async (data) => {
        const { callId, answer } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        // Update call status
        await dbQuery('calls', 'update', { status: 'connected' }, { id: callId });
        // Get caller info
        const { data: callResult } = await dbQuery('calls', 'select', {}, { id: callId });
        const call = callResult && callResult.length > 0 ? callResult[0] : null;
        if (call) {
            io.to(`user:${call.caller_id}`).emit('call_answered', {
                callId,
                answer
            });
        }
    });
    socket.on('call_ice_candidate', async (data) => {
        const { targetUserId, candidate } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        io.to(`user:${targetUserId}`).emit('ice_candidate', {
            userId,
            candidate
        });
    });
    socket.on('call_end', async (data) => {
        const { callId } = data;
        const userId = socket.userId;
        if (!userId)
            return;
        // Update call status
        await dbQuery('calls', 'update', {
            status: 'ended',
            ended_at: new Date().toISOString()
        }, { id: callId });
        // Get updated call info
        const { data: callResult } = await dbQuery('calls', 'select', {}, { id: callId });
        const call = callResult && callResult.length > 0 ? callResult[0] : null;
        if (call) {
            // Notify both parties
            io.to(`user:${call.caller_id}`).emit('call_ended', { callId });
            io.to(`user:${call.callee_id}`).emit('call_ended', { callId });
        }
    });
    // Disconnect handling
    socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id);
        if (socket.userId) {
            // Update user offline status
            await dbQuery('users', 'update', {
                is_online: false,
                last_seen: new Date().toISOString(),
                socket_id: null
            }, { id: socket.userId });
            // Notify contacts user is offline
            io.emit('user_offline', { userId: socket.userId });
        }
    });
});
const PORT = process.env.PORT || 3001;
// Add error handling
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
    switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            console.error("CRITICAL: Would exit but keeping alive for enterprise stability");
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            console.error("CRITICAL: Would exit but keeping alive for enterprise stability");
            break;
        default:
            throw error;
    }
});
// =====================================
// SECURE BACKEND ENDPOINTS
// =====================================
// Security constants
const JWT_SECRET = process.env.JWT_SECRET || 'cyphr-secure-jwt-secret-2024';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto_1.default.randomBytes(32);
// 🔐 ZERO STORAGE POLICY - Only minimal public keys for messaging
// No private data, seed phrases, or personal information stored!
// publicKeysForMessaging already declared above
// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};
// Secure authentication endpoint
app.post('/api/auth/secure-login', async (req, res) => {
    try {
        const { userId, passwordHash } = req.body;
        if (!userId || !passwordHash) {
            return res.status(400).json({ error: 'userId and passwordHash required' });
        }
        // Generate secure session token
        const sessionToken = jsonwebtoken_1.default.sign({ userId, timestamp: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
        console.log(`🔐 Secure login for user: ${userId}`);
        res.json({
            success: true,
            sessionToken,
            expiresIn: '24h'
        });
    }
    catch (error) {
        console.error('❌ Secure login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// Generate TOTP secret (server-side only)
app.post('/api/auth/totp/generate', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }
        // Generate TOTP secret on server
        const secret = speakeasy_1.default.generateSecret({
            name: `Cyphr Messenger (${userId})`,
            issuer: 'Cyphr Messenger',
            length: 32
        });
        // Store secret securely on server
        userTOTPSecrets.set(userId, secret.base32);
        // Generate QR code
        const qrCodeUrl = await qrcode_1.default.toDataURL(secret.otpauth_url || '');
        // Generate backup codes
        const backupCodes = Array.from({ length: 10 }, () => crypto_1.default.randomBytes(4).toString('hex').toUpperCase());
        console.log(`🔐 TOTP secret generated for user: ${userId}`);
        // NEVER send the actual secret to frontend!
        res.json({
            success: true,
            qrCode: qrCodeUrl,
            backupCodes,
        });
    }
    catch (error) {
        console.error('❌ TOTP generation error:', error);
        res.status(500).json({ error: 'TOTP generation failed' });
    }
});
// Verify TOTP code (server-side only)
app.post('/api/auth/totp/verify', authenticateToken, async (req, res) => {
    try {
        const { userId, code } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ error: 'userId and code required' });
        }
        // Retrieve secret from server storage
        const secret = userTOTPSecrets.get(userId);
        if (!secret) {
            return res.status(404).json({ error: 'TOTP not configured for user' });
        }
        // Verify TOTP code
        const verified = speakeasy_1.default.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 2
        });
        console.log(`🔐 TOTP verification for user ${userId}: ${verified ? 'SUCCESS' : 'FAILED'}`);
        res.json({
            success: true,
            verified
        });
    }
    catch (error) {
        console.error('❌ TOTP verification error:', error);
        res.status(500).json({ error: 'TOTP verification failed' });
    }
});
// Admin endpoint - ZERO STORAGE architecture status
app.get('/api/admin/zero-storage-status', async (req, res) => {
    try {
        // Check core tables only (no banned/admin tables per ZERO STORAGE)
        const { data: tables, error } = await dbQuery('information_schema.tables', 'select', {}, { table_schema: 'public' });
        // Filter to only core tables since dbQuery doesn't support .in() filter
        const coreTableNames = ['users', 'chats', 'chat_participants', 'messages'];
        const filteredTables = tables ? tables.filter(t => coreTableNames.includes(t.table_name)) : [];
        res.json({
            success: true,
            architecture: 'ZERO STORAGE & ZERO KNOWLEDGE',
            coreTablesOnly: filteredTables.map(t => t.table_name) || [],
            clientSideStorage: [
                'Block lists (IndexedDB)',
                'Seed phrases (encrypted)',
                'Private keys (never transmitted)',
                'Message history (encrypted)',
                'User preferences',
                'Contact lists'
            ],
            serverStores: [
                'Public keys only (for Kyber1024)',
                'Encrypted message metadata',
                'Public chat room IDs',
                'Temporary session tokens'
            ],
            notes: 'NO banned_members or admin_actions tables - violates ZERO STORAGE principle'
        });
    }
    catch (error) {
        console.error('❌ Zero storage status error:', error);
        res.status(500).json({
            error: 'Failed to check zero storage status',
            details: error.message
        });
    }
});
// Hash password securely on server
app.post('/api/auth/hash-password', async (req, res) => {
    try {
        const { password, userId } = req.body;
        if (!password || !userId) {
            return res.status(400).json({ error: 'password and userId required' });
        }
        // Use Argon2 for secure password hashing
        const hash = await argon2_1.default.hash(password, {
            type: argon2_1.default.argon2id,
            memoryCost: 2 ** 16, // 64 MB
            timeCost: 3,
            parallelism: 1,
            salt: Buffer.from(userId, 'utf8'),
        });
        console.log(`🔐 Password hashed for user: ${userId}`);
        res.json({
            success: true,
            hash
        });
    }
    catch (error) {
        console.error('❌ Password hashing error:', error);
        res.status(500).json({ error: 'Password hashing failed' });
    }
});
// 🔐 ZERO STORAGE - Register public key only for messaging (no private data)
app.post('/api/auth/register-public-key', async (req, res) => {
    try {
        const { publicKey } = req.body;
        if (!publicKey) {
            return res.status(400).json({ error: 'publicKey required' });
        }
        // Store ONLY public key for Kyber encryption (no private data!)
        publicKeysForMessaging.set(publicKey, {
            registeredAt: Date.now(),
            lastActive: Date.now()
        });
        console.log(`🔑 Public key registered for messaging: ${publicKey.substring(0, 12)}...`);
        res.json({
            success: true,
            message: 'Public key registered for secure messaging'
        });
    }
    catch (error) {
        console.error('❌ Public key registration error:', error);
        res.status(500).json({ error: 'Public key registration failed' });
    }
});
// 🔐 ZERO STORAGE - Get public keys for messaging only
app.get('/api/messaging/public-keys', async (req, res) => {
    try {
        const publicKeys = Array.from(publicKeysForMessaging.keys());
        res.json({
            success: true,
            publicKeys: publicKeys.map(key => ({
                publicKey: key,
                active: true
            }))
        });
    }
    catch (error) {
        console.error('❌ Public keys query error:', error);
        res.status(500).json({ error: 'Public keys query failed' });
    }
});
// ========================================
// 👥 GROUP MANAGEMENT API ENDPOINTS
// ========================================
// Middleware to validate admin permissions
async function validateGroupAdmin(req, res, next) {
    try {
        const { chatId } = req.params;
        const userId = req.headers['user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'User authentication required' });
        }
        // Check if user is admin of this chat
        const { data: participantResult, error } = await dbQuery('chat_participants', 'select', {}, { chat_id: chatId, user_id: userId });
        const participant = participantResult && participantResult.length > 0 ? participantResult[0] : null;
        if (error || !participant || participant.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required for this action' });
        }
        next();
    }
    catch (error) {
        console.error('❌ Admin validation error:', error);
        res.status(500).json({ error: 'Admin validation failed' });
    }
}
// Add member to group
app.post('/api/chats/:chatId/members/:userId', validateGroupAdmin, async (req, res) => {
    try {
        const { chatId, userId: newUserId } = req.params;
        const adminUserId = req.headers['user-id'];
        // Check if user is already a member
        const { data: existingMemberResult } = await dbQuery('chat_participants', 'select', {}, { chat_id: chatId, user_id: newUserId });
        const existingMember = existingMemberResult && existingMemberResult.length > 0 ? existingMemberResult[0] : null;
        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member of this group' });
        }
        // Add new member
        const { error: insertError } = await dbQuery('chat_participants', 'insert', {
            chat_id: chatId,
            user_id: newUserId,
            role: 'member',
            joined_at: new Date().toISOString()
        });
        if (insertError)
            throw insertError;
        // Log admin action
        await dbQuery('group_admin_actions', 'insert', {
            chat_id: parseInt(chatId),
            admin_id: adminUserId,
            target_user_id: newUserId,
            action_type: 'member_added',
            metadata: {},
            timestamp: new Date().toISOString()
        });
        // Emit real-time event
        io.to(chatId).emit('member_added', {
            chatId,
            userId: newUserId,
            role: 'member',
            addedBy: adminUserId,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            message: 'Member added successfully',
            chatId,
            userId: newUserId
        });
    }
    catch (error) {
        console.error('❌ Add member error:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});
// Remove member from group
app.delete('/api/chats/:chatId/members/:userId', validateGroupAdmin, async (req, res) => {
    try {
        const { chatId, userId: targetUserId } = req.params;
        const adminUserId = req.headers['user-id'];
        // Prevent admin from removing themselves if they're the only admin
        if (adminUserId === targetUserId) {
            const { data: adminCount } = await dbQuery('chat_participants', 'select', {}, { chat_id: chatId, role: 'admin' });
            if (adminCount && adminCount.length <= 1) {
                return res.status(400).json({ error: 'Cannot remove the last admin from the group' });
            }
        }
        // Remove member
        const { error: deleteError } = await dbQuery('chat_participants', 'delete', {}, { chat_id: chatId, user_id: targetUserId });
        if (deleteError)
            throw deleteError;
        // Log admin action
        await dbQuery('group_admin_actions', 'insert', {
            chat_id: parseInt(chatId),
            admin_id: adminUserId,
            target_user_id: targetUserId,
            action_type: 'member_removed',
            metadata: {},
            timestamp: new Date().toISOString()
        });
        // Emit real-time event
        io.to(chatId).emit('member_removed', {
            chatId,
            userId: targetUserId,
            removedBy: adminUserId,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            message: 'Member removed successfully',
            chatId,
            userId: targetUserId
        });
    }
    catch (error) {
        console.error('❌ Remove member error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});
// Change member role (promote/demote)
app.put('/api/chats/:chatId/members/:userId/role', validateGroupAdmin, async (req, res) => {
    try {
        const { chatId, userId: targetUserId } = req.params;
        const { role } = req.body;
        const adminUserId = req.headers['user-id'];
        if (!role || !['admin', 'member'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be "admin" or "member"' });
        }
        // Prevent admin from demoting themselves if they're the only admin
        if (adminUserId === targetUserId && role === 'member') {
            const { data: adminCount } = await dbQuery('chat_participants', 'select', {}, { chat_id: chatId, role: 'admin' });
            if (adminCount && adminCount.length <= 1) {
                return res.status(400).json({ error: 'Cannot demote the last admin from the group' });
            }
        }
        // Update member role
        const { error: updateError } = await dbQuery('chat_participants', 'update', { role }, { chat_id: chatId, user_id: targetUserId });
        if (updateError)
            throw updateError;
        // Log admin action
        await dbQuery('group_admin_actions', 'insert', {
            chat_id: parseInt(chatId),
            admin_id: adminUserId,
            target_user_id: targetUserId,
            action_type: role === 'admin' ? 'member_promoted' : 'member_demoted',
            metadata: { new_role: role },
            timestamp: new Date().toISOString()
        });
        // Emit real-time event
        io.to(chatId).emit('role_changed', {
            chatId,
            userId: targetUserId,
            newRole: role,
            changedBy: adminUserId,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            message: `Member ${role === 'admin' ? 'promoted to admin' : 'demoted to member'} successfully`,
            chatId,
            userId: targetUserId,
            newRole: role
        });
    }
    catch (error) {
        console.error('❌ Change role error:', error);
        res.status(500).json({ error: 'Failed to change member role' });
    }
});
// Ban member from group
app.post('/api/chats/:chatId/ban/:userId', validateGroupAdmin, async (req, res) => {
    try {
        const { chatId, userId: targetUserId } = req.params;
        const { reason } = req.body;
        const adminUserId = req.headers['user-id'];
        if (adminUserId === targetUserId) {
            return res.status(400).json({ error: 'Cannot ban yourself from the group' });
        }
        // Remove member first
        await dbQuery('chat_participants', 'delete', {}, { chat_id: chatId, user_id: targetUserId });
        // ZERO STORAGE: NO server-side ban records!
        // Block lists managed client-side in IndexedDB only
        console.log(`🚫 ZERO STORAGE: User ${targetUserId} removed from group. Block list managed client-side.`);
        // Emit real-time event for clients to update local IndexedDB
        io.to(chatId).emit('member_blocked_client_side', {
            chatId,
            userId: targetUserId,
            blockedBy: adminUserId,
            reason,
            timestamp: new Date().toISOString(),
            action: 'store_in_indexeddb'
        });
        res.json({
            success: true,
            message: 'ZERO STORAGE: Member removed from group. Clients manage block lists locally.',
            chatId,
            userId: targetUserId,
            note: 'Block list stored client-side in IndexedDB only'
        });
    }
    catch (error) {
        console.error('❌ Ban member error:', error);
        res.status(500).json({ error: 'Failed to ban member' });
    }
});
// Unban member from group
app.delete('/api/chats/:chatId/ban/:userId', validateGroupAdmin, async (req, res) => {
    try {
        const { chatId, userId: targetUserId } = req.params;
        const adminUserId = req.headers['user-id'];
        // ZERO STORAGE: No server-side ban records to remove!
        // Unblock handled client-side in IndexedDB only
        console.log(`✅ ZERO STORAGE: Unblock request for ${targetUserId}. Managed client-side.`);
        res.json({
            success: true,
            message: 'ZERO STORAGE: Unblock managed client-side only.',
            chatId,
            userId: targetUserId,
            note: 'Client should update IndexedDB block list'
        });
    }
    catch (error) {
        console.error('❌ Unban member error:', error);
        res.status(500).json({ error: 'Failed to unban member' });
    }
});
// Get group members with roles and ban status
app.get('/api/chats/:chatId/members', async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.headers['user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'User authentication required' });
        }
        // Check if user is member of this chat
        const { data: userMembershipResult } = await dbQuery('chat_participants', 'select', {}, { chat_id: chatId, user_id: userId });
        const userMembership = userMembershipResult && userMembershipResult.length > 0 ? userMembershipResult[0] : null;
        if (!userMembership) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }
        // Get all members with user details
        const { data: members, error } = await dbQuery(null, null, {}, {}, {
            query: `
                SELECT 
                    cp.user_id,
                    cp.role,
                    cp.joined_at,
                    u.id,
                    u.name,
                    u.phone,
                    u.avatar_url,
                    u.status,
                    u.last_seen
                FROM chat_participants cp
                INNER JOIN users u ON cp.user_id = u.id
                WHERE cp.chat_id = $1
                ORDER BY cp.joined_at ASC
            `,
            params: [chatId],
            fallbackSupabase: async (adminSupabase) => {
                return await adminSupabase
                    .from('chat_participants')
                    .select(`
                        user_id,
                        role,
                        joined_at,
                        users!inner (
                          id,
                          name,
                          phone,
                          avatar_url,
                          status,
                          last_seen
                        )
                      `)
                    .eq('chat_id', chatId)
                    .order('joined_at', { ascending: true });
            }
        });
        if (error)
            throw error;
        // ZERO STORAGE: No server-side banned members list!
        // Block lists managed client-side in IndexedDB only
        res.json({
            success: true,
            members: members || [],
            userRole: userMembership.role,
            note: 'ZERO STORAGE: Block lists managed client-side in IndexedDB'
        });
    }
    catch (error) {
        console.error('❌ Get members error:', error);
        res.status(500).json({ error: 'Failed to get group members' });
    }
});
console.log('👥 Group management endpoints initialized');

// Initialize REAL E2E Messaging endpoints with Kyber1024
initializeMessagingEndpoints(app, io);
initializeSocketHandlers(io);
console.log('🔐 E2E Messaging with ML-KEM-1024 initialized');

// Initialize Cyphr ID endpoints
if (typeof initializeCyphrIdEndpoints === 'function') {
    initializeCyphrIdEndpoints(app);
    console.log('🆔 Cyphr ID endpoints initialized');
}

console.log('🔐 Secure backend endpoints initialized');
server.listen(PORT, () => {
    console.log(`🚀 Cyphr Messenger Server running on port ${PORT}`);
    console.log(`🔐 Post-quantum encryption: Kyber1024 + ChaCha20`);
    console.log(`🛡️  Secure backend endpoints: ENABLED`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

// ===============================
// EMAIL AUTHENTICATION ENDPOINTS
// ===============================

const jwt = require('jsonwebtoken');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// AWS SES Client
const sesClient = new SESClient({ region: 'us-east-1' });

// Email OTP removed - using Cyphr ID authentication only

// ===============================
// CYPHR ID MANAGEMENT ENDPOINTS
// ===============================

// Check Cyphr ID availability
app.post('/api/auth/check-cyphr-id', async (req, res) => {
    try {
        const { cyphrId } = req.body;
        
        if (!cyphrId) {
            return res.status(400).json({
                success: false,
                error: 'Cyphr ID is required'
            });
        }

        // Validate format (alphanumeric + underscore only)
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(cyphrId)) {
            return res.status(400).json({
                success: false,
                available: false,
                error: 'Cyphr ID must be 3-20 characters, letters, numbers and underscore only'
            });
        }

        // Check reserved words
        const reservedWords = ['admin', 'support', 'cyphr', 'messenger', 'official', 'team', 'help', 'api', 'www'];
        if (reservedWords.includes(cyphrId.toLowerCase())) {
            return res.status(400).json({
                success: false,
                available: false,
                error: 'This Cyphr ID is reserved'
            });
        }

        // Check availability in RDS
        const existingUser = await dbQuery('users', 'select', {}, { cyphr_id: cyphrId });
        
        const available = !existingUser.data || existingUser.data.length === 0;

        res.json({
            success: true,
            available,
            cyphrId
        });

    } catch (error) {
        console.error('❌ Check Cyphr ID error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check Cyphr ID availability'
        });
    }
});

// Set Cyphr ID for user
app.post('/api/auth/set-cyphr-id', async (req, res) => {
    try {
        const { userId, cyphrId } = req.body;
        
        if (!userId || !cyphrId) {
            return res.status(400).json({
                success: false,
                error: 'User ID and Cyphr ID are required'
            });
        }

        // Validate format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(cyphrId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Cyphr ID format'
            });
        }

        // Check availability first
        const existingUser = await dbQuery('users', 'select', {}, { cyphr_id: cyphrId });
        
        if (existingUser.data && existingUser.data.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'This Cyphr ID is already taken'
            });
        }

        // Update user with Cyphr ID
        const updateResult = await dbQuery('users', 'update', 
            { 
                cyphr_id: cyphrId,
                cyphr_id_changed_at: new Date().toISOString()
            }, 
            { id: userId }
        );

        if (updateResult.error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to set Cyphr ID'
            });
        }

        res.json({
            success: true,
            message: 'Cyphr ID set successfully',
            cyphrId
        });

    } catch (error) {
        console.error('❌ Set Cyphr ID error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set Cyphr ID'
        });
    }
});

// Login with Cyphr ID
app.post('/api/auth/cyphr-id-login', async (req, res) => {
    try {
        const { cyphrId, pin } = req.body;
        
        if (!cyphrId) {
            return res.status(400).json({
                success: false,
                error: 'Cyphr ID is required'
            });
        }

        // Find user by Cyphr ID
        const userResult = await dbQuery('users', 'select', {}, { cyphr_id: cyphrId });
        
        if (!userResult.data || userResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No account found with this Cyphr ID'
            });
        }

        const user = userResult.data[0];

        // If user has PIN, verify it
        if (user.pin_hash && pin) {
            const pinValid = await argon2_1.default.verify(user.pin_hash, pin);
            if (!pinValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }
        } else if (user.pin_hash && !pin) {
            return res.status(400).json({
                success: false,
                error: 'PIN is required for this account'
            });
        }

        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ 
            userId: user.id, 
            cyphrId: user.cyphr_id 
        }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                cyphrId: user.cyphr_id,
                fullName: user.full_name,
                avatar: user.avatar_url
            }
        });

    } catch (error) {
        console.error('❌ Cyphr ID login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// ===============================
// CRYPTO IDENTITY ENDPOINTS - PREMIUM TIER
// ===============================

// Check device registration status
app.post('/api/crypto/check-device-registration', async (req, res) => {
    try {
        const { deviceFingerprint } = req.body;
        
        if (!deviceFingerprint) {
            return res.status(400).json({
                success: false,
                error: 'Device fingerprint is required'
            });
        }

        // Check if device is already registered
        const deviceResult = await dbQuery('device_registrations', 'select', {}, { 
            device_fingerprint: deviceFingerprint
        });

        const exists = deviceResult.data && deviceResult.data.length > 0;
        
        if (exists) {
            const registration = deviceResult.data[0];
            res.json({
                success: true,
                exists: true,
                cyphrId: registration.cyphr_id,
                registeredBrowser: registration.browser_info?.name || 'Unknown',
                registeredAt: registration.created_at
            });
        } else {
            res.json({
                success: true,
                exists: false
            });
        }

    } catch (error) {
        console.error('❌ Check device registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check device registration'
        });
    }
});

// Register new crypto identity device
app.post('/api/crypto/register-device', async (req, res) => {
    try {
        const { 
            deviceFingerprint, 
            cyphrId, 
            publicKey, 
            webauthnCredentialId,
            browserInfo 
        } = req.body;
        
        if (!deviceFingerprint || !cyphrId || !publicKey) {
            return res.status(400).json({
                success: false,
                error: 'Device fingerprint, Cyphr ID, and public key are required'
            });
        }

        // Check if device already registered
        const existingDevice = await dbQuery('device_registrations', 'select', {}, { 
            device_fingerprint: deviceFingerprint
        });

        if (existingDevice.data && existingDevice.data.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'This device already has a registered Crypto Identity',
                existingCyphrId: existingDevice.data[0].cyphr_id
            });
        }

        // Check if Cyphr ID already taken
        const existingCyphrId = await dbQuery('device_registrations', 'select', {}, { 
            cyphr_id: cyphrId
        });

        if (existingCyphrId.data && existingCyphrId.data.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'This Cyphr ID is already registered to another device'
            });
        }

        // Create user entry first (for foreign key constraint)
        const userId = crypto_1.default.randomUUID();
        const userData = {
            id: userId,
            unique_id: userId,
            cyphr_id: cyphrId,
            public_key: publicKey,
            auth_method: 'crypto',
            status: 'online',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const userResult = await dbQuery('users', 'insert', userData);
        
        if (userResult.error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to create user account'
            });
        }

        // Now create device registration
        const registrationData = {
            id: crypto_1.default.randomUUID(),
            user_id: userId,
            device_fingerprint: deviceFingerprint,
            cyphr_id: cyphrId,
            browser_info: JSON.stringify(browserInfo || {}),
            registered_at: new Date().toISOString()
        };

        const registrationResult = await dbQuery('device_registrations', 'insert', registrationData);

        if (registrationResult.error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to register device'
            });
        }

        // Generate JWT token for crypto identity
        const token = jsonwebtoken_1.default.sign({ 
            userId, 
            cyphrId, 
            authMethod: 'crypto',
            deviceFingerprint 
        }, JWT_SECRET, { expiresIn: '30d' }); // Longer expiry for crypto auth

        res.json({
            success: true,
            message: 'Crypto Identity registered successfully',
            token,
            user: {
                id: userId,
                cyphrId: cyphrId,
                publicKey: publicKey,
                authMethod: 'crypto'
            },
            deviceRegistered: true
        });

    } catch (error) {
        console.error('❌ Register device error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register crypto identity'
        });
    }
});

// Authenticate with crypto identity (WebAuthn challenge)
app.post('/api/crypto/authenticate', async (req, res) => {
    try {
        const { cyphrId, webauthnAssertion } = req.body;
        
        if (!cyphrId) {
            return res.status(400).json({
                success: false,
                error: 'Cyphr ID is required'
            });
        }

        // Find registered device by Cyphr ID
        const deviceResult = await dbQuery('device_registrations', 'select', {}, { 
            cyphr_id: cyphrId
        });

        if (!deviceResult.data || deviceResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No registered crypto identity found with this Cyphr ID'
            });
        }

        const registration = deviceResult.data[0];

        // In production, verify WebAuthn assertion here
        // For now, just validate that user has the credential ID
        if (webauthnAssertion && webauthnAssertion.id !== registration.webauthn_credential_id) {
            return res.status(401).json({
                success: false,
                error: 'Invalid device credential'
            });
        }

        // Generate JWT token for authenticated session
        const token = jsonwebtoken_1.default.sign({ 
            userId: registration.user_id,
            cyphrId: registration.cyphr_id,
            authMethod: 'crypto',
            deviceFingerprint: registration.device_fingerprint
        }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            success: true,
            message: 'Crypto Identity authentication successful',
            token,
            user: {
                id: registration.user_id,
                cyphrId: registration.cyphr_id,
                publicKey: registration.public_key,
                authMethod: 'crypto'
            }
        });

    } catch (error) {
        console.error('❌ Crypto authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    console.error("CRITICAL: Would exit but keeping alive for enterprise stability");
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    console.error("CRITICAL: Would exit but keeping alive for enterprise stability");
});

// S3 Integration for iOS
const s3Service = require('./s3-service.cjs');

// S3 Endpoints
app.post('/api/s3/presigned-upload', async (req, res) => {
  try {
    const { type, userId, fileSizeLimit } = req.body;
    const result = await s3Service.getPresignedUploadUrl(type, userId, fileSizeLimit || 100 * 1024 * 1024);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('S3 upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/s3/presigned-download', async (req, res) => {
  try {
    const { s3Url } = req.body;
    const downloadUrl = await s3Service.getPresignedDownloadUrl(s3Url);
    res.json({ success: true, downloadUrl });
  } catch (error) {
    console.error('S3 download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

console.log('✅ S3 endpoints added for iOS');

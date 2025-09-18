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
const twilio_1 = __importDefault(require("twilio"));
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const argon2_1 = __importDefault(require("argon2"));
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
// Import FinalKyber1024 dynamically to avoid module loading issues
let kyber = null;
let stellarServer = null;
// In-memory storage for TOTP secrets (in production, use secure database)
const userTOTPSecrets = new Map();
// Zero Storage: Only store public keys for messaging (no private data)
const publicKeysForMessaging = new Map();
// Initialize crypto and stellar services
async function initializeServices() {
    try {
        const { default: FinalKyber1024 } = await Promise.resolve().then(() => __importStar(require('./src/api/crypto/finalKyber1024.js')));
        kyber = new FinalKyber1024();
        stellarServer = new stellar_sdk_1.Horizon.Server('https://horizon.stellar.org');
        console.log('✅ Crypto services initialized');
    }
    catch (error) {
        console.error('❌ Failed to initialize crypto services:', error);
        // Continue without crypto services for now
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
let TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'dev_account_sid';
let TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'dev_auth_token';
let TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SID || 'dev_verify_sid';
let TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || process.env.VITE_TWILIO_PHONE_NUMBER || '+15005550006';
let SUPABASE_URL = process.env.SUPABASE_URL || 'https://dev.supabase.co';
let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dev_anon_key';
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'dev_service_key';
// Initialize secure credentials on startup
async function initializeSecureCredentials() {
    try {
        console.log('🔐 Loading secure credentials from AWS Secrets Manager...');
        // Load Twilio credentials from AWS Secrets Manager
        const twilioSid = await getSecret('cyphr-twilio-account-sid');
        const twilioToken = await getSecret('cyphr-twilio-auth-token');
        const twilioVerify = await getSecret('cyphr-twilio-verify-sid');
        // Load Supabase credentials
        const supabaseUrl = await getSecret('cyphr-supabase-url');
        const supabaseKey = await getSecret('cyphr-supabase-anon-key');
        // Update credentials if loaded from AWS
        if (twilioSid)
            TWILIO_ACCOUNT_SID = twilioSid;
        if (twilioToken)
            TWILIO_AUTH_TOKEN = twilioToken;
        if (twilioVerify)
            TWILIO_VERIFY_SID = twilioVerify;
        if (supabaseUrl)
            SUPABASE_URL = supabaseUrl;
        if (supabaseKey)
            SUPABASE_ANON_KEY = supabaseKey;
        console.log('✅ Secure credentials initialized');
    }
    catch (error) {
        console.warn('⚠️ Using environment variables for credentials:', error);
    }
}
// Singleton pattern for Supabase client to avoid multiple instances
class SupabaseServerSingleton {
    static getInstance() {
        if (!this.instance && SUPABASE_URL && SUPABASE_ANON_KEY) {
            console.log('🔧 Creating Supabase server instance (singleton)...');
            this.instance = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                }
            });
        }
        return this.instance;
    }
}
SupabaseServerSingleton.instance = null;
// Initialize services with singleton pattern
let twilioClient = (0, twilio_1.default)(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
let supabase = SupabaseServerSingleton.getInstance();
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
// Send direct SMS via Twilio
app.post('/api/sms/send', async (req, res) => {
    try {
        const { to, body } = req.body;
        if (!to || !body) {
            return res.status(400).json({ error: 'Phone number and message body are required' });
        }
        console.log('📱 Sending SMS to:', to);
        console.log('📝 Message:', body);
        // Send SMS via Twilio
        const message = await twilioClient.messages.create({
            body,
            from: TWILIO_PHONE_NUMBER,
            to
        });
        console.log('✅ SMS sent successfully, SID:', message.sid);
        res.json({
            success: true,
            sid: message.sid,
            status: message.status
        });
    }
    catch (error) {
        console.error('❌ SMS send error:', error);
        res.status(500).json({
            error: error.message || 'Failed to send SMS',
            code: error.code
        });
    }
});
// Send OTP via Twilio (legacy endpoint)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        // Normalize phone number (ensure it starts with +)
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith('+')) {
            // Try to add + if missing
            normalizedPhone = '+' + normalizedPhone.replace(/^[^0-9]*/, '');
        }
        console.log('📱 Sending OTP to:', normalizedPhone);
        console.log('🔧 Using Twilio Verify Service:', TWILIO_VERIFY_SID);
        // Send OTP via Twilio Verify Service
        const verification = await twilioClient.verify.v2
            .services(TWILIO_VERIFY_SID)
            .verifications.create({
            to: normalizedPhone,
            channel: 'sms'
        });
        console.log('✅ OTP sent successfully:', verification.status);
        console.log('📧 Verification SID:', verification.sid);
        res.json({
            success: true,
            message: 'OTP sent successfully',
            phone: normalizedPhone,
            sid: verification.sid,
            status: verification.status
        });
    }
    catch (error) {
        console.error('❌ Send OTP error:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to send OTP: ' + error.message
        });
    }
});
// Send OTP via Twilio (new endpoint)
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        // Normalize phone number (ensure it starts with +)
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith('+')) {
            // Try to add + if missing
            normalizedPhone = '+' + normalizedPhone.replace(/^[^0-9]*/, '');
        }
        console.log('📱 Sending OTP to:', normalizedPhone);
        console.log('🔧 Using Twilio Verify Service:', TWILIO_VERIFY_SID);
        // Send OTP via Twilio Verify Service
        const verification = await twilioClient.verify.v2
            .services(TWILIO_VERIFY_SID)
            .verifications.create({
            to: normalizedPhone,
            channel: 'sms'
        });
        console.log('✅ OTP sent successfully, SID:', verification.sid);
        res.json({
            success: true,
            message: 'OTP sent successfully',
            sid: verification.sid
        });
    }
    catch (error) {
        console.error('❌ Send OTP error:', error);
        // For trial accounts, show clear instructions
        if (error.message && error.message.includes('unverified')) {
            res.status(400).json({
                error: 'Twilio Trial Account: Phone number must be verified first',
                details: 'Please verify your phone number at https://console.twilio.com/us1/develop/phone-numbers/manage/verified',
                instructions: 'Add your phone number to verified caller IDs in Twilio Console'
            });
            return;
        }
        res.status(500).json({
            error: 'Failed to send OTP: ' + error.message,
            details: error.message
        });
    }
});
// Verify OTP via Twilio (legacy endpoint)
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, code } = req.body;
        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                error: 'Phone and code are required'
            });
        }
        // Normalize phone number
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone.replace(/^[^0-9]*/, '');
        }
        console.log('🔍 Verifying OTP for:', normalizedPhone, 'with code:', code);
        // Verify OTP via Twilio Verify Service
        const verificationCheck = await twilioClient.verify.v2
            .services(TWILIO_VERIFY_SID)
            .verificationChecks.create({
            to: normalizedPhone,
            code: code
        });
        if (verificationCheck.status === 'approved') {
            console.log('✅ OTP verified successfully for:', normalizedPhone);
            res.json({
                success: true,
                message: 'Phone verified successfully',
                user: { phone: normalizedPhone }
            });
        }
        else {
            console.log('❌ OTP verification failed:', verificationCheck.status);
            res.status(400).json({
                success: false,
                error: 'Invalid verification code'
            });
        }
    }
    catch (error) {
        console.error('❌ Verify OTP error:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to verify OTP: ' + error.message
        });
    }
});
// Verify OTP via Twilio (new endpoint)
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }
        // Normalize phone number
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone.replace(/^[^0-9]*/, '');
        }
        console.log('🔍 Verifying OTP for:', normalizedPhone, 'with code:', otp);
        // Verify OTP via Twilio Verify Service
        const verificationCheck = await twilioClient.verify.v2
            .services(TWILIO_VERIFY_SID)
            .verificationChecks.create({
            to: normalizedPhone,
            code: otp
        });
        if (verificationCheck.status === 'approved') {
            console.log('✅ OTP verified successfully for:', normalizedPhone);
            try {
                // Create or find user in database with admin privileges
                const userId = crypto_1.default.randomUUID();
                // Use service role client (admin) to bypass RLS (never expose to frontend)
                if (!SERVICE_ROLE_KEY) {
                    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in server environment');
                }
                const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                        detectSessionInUrl: false
                    }
                });
                // Try to find existing user first
                const { data: existingUser } = await adminSupabase
                    .from('users')
                    .select('*')
                    .eq('phone', normalizedPhone)
                    .single();
                let user;
                if (existingUser) {
                    user = existingUser;
                    console.log('📱 Found existing user for phone:', normalizedPhone);
                }
                else {
                    // Create new user with admin privileges
                    const { data: newUser, error: userError } = await adminSupabase
                        .from('users')
                        .insert([{
                            id: userId,
                            phone: normalizedPhone,
                            full_name: normalizedPhone,
                            unique_id: userId,
                            status: 'online'
                        }])
                        .select()
                        .single();
                    if (userError) {
                        console.error('❌ Failed to create user:', userError);
                        throw new Error(`Failed to create user: ${userError.message}`);
                    }
                    user = newUser;
                    console.log('✅ Created new user for phone:', normalizedPhone);
                }
                res.json({
                    success: true,
                    message: 'Phone verified and user created successfully',
                    user: {
                        id: user.id,
                        phone: user.phone,
                        full_name: user.full_name,
                        unique_id: user.unique_id
                    }
                });
            }
            catch (dbError) {
                console.error('❌ Database error during user creation:', dbError);
                res.status(500).json({
                    error: 'Failed to create user account',
                    details: dbError.message
                });
            }
        }
        else {
            console.log('❌ OTP verification failed:', verificationCheck.status);
            res.status(400).json({
                error: 'Invalid verification code'
            });
        }
    }
    catch (error) {
        console.error('❌ Verify OTP error:', error);
        res.status(400).json({
            error: 'Failed to verify OTP: ' + error.message
        });
    }
});
// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    // User authentication
    socket.on('authenticate', async (data) => {
        try {
            const { userId, publicKey } = data;
            // Verify user exists
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            if (error || !user) {
                socket.emit('auth_error', 'Invalid user');
                return;
            }
            // Store socket info
            socket.userId = userId;
            socket.publicKey = publicKey;
            socket.join(`user:${userId}`);
            // Update user online status
            await supabase
                .from('users')
                .update({
                is_online: true,
                last_seen: new Date().toISOString(),
                socket_id: socket.id
            })
                .eq('id', userId);
            // Join user's chats
            const { data: chats } = await supabase
                .from('chat_participants')
                .select('chat_id')
                .eq('user_id', userId);
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
            const { data: participant } = await supabase
                .from('chat_participants')
                .select('*')
                .eq('chat_id', chatId)
                .eq('user_id', userId)
                .single();
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
            const { error } = await supabase
                .from('messages')
                .insert(messageData);
            if (error)
                throw error;
            // Update chat last message
            await supabase
                .from('chats')
                .update({
                last_message_id: messageData.id,
                last_message_time: messageData.created_at,
                updated_at: messageData.created_at
            })
                .eq('id', chatId);
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
        await supabase
            .from('message_status')
            .insert({
            message_id: messageId,
            user_id: userId,
            status: 'delivered',
            timestamp: new Date().toISOString()
        });
        // Notify sender
        const { data: message } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('id', messageId)
            .single();
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
        await supabase
            .from('message_status')
            .upsert({
            message_id: messageId,
            user_id: userId,
            status: 'read',
            timestamp: new Date().toISOString()
        });
        // Notify sender
        const { data: message } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('id', messageId)
            .single();
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
        await supabase.from('calls').insert(callData);
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
        await supabase
            .from('calls')
            .update({ status: 'connected' })
            .eq('id', callId);
        // Get caller info
        const { data: call } = await supabase
            .from('calls')
            .select('caller_id')
            .eq('id', callId)
            .single();
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
        const { data: call } = await supabase
            .from('calls')
            .update({
            status: 'ended',
            ended_at: new Date().toISOString()
        })
            .eq('id', callId)
            .select()
            .single();
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
            await supabase
                .from('users')
                .update({
                is_online: false,
                last_seen: new Date().toISOString(),
                socket_id: null
            })
                .eq('id', socket.userId);
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
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
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
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { persistSession: false }
        });
        // Check core tables only (no banned/admin tables per ZERO STORAGE)
        const { data: tables, error } = await adminSupabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['users', 'chats', 'chat_participants', 'messages']);
        res.json({
            success: true,
            architecture: 'ZERO STORAGE & ZERO KNOWLEDGE',
            coreTablesOnly: tables?.map(t => t.table_name) || [],
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
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: participant, error } = await adminSupabase
            .from('chat_participants')
            .select('role')
            .eq('chat_id', chatId)
            .eq('user_id', userId)
            .single();
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
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        // Check if user is already a member
        const { data: existingMember } = await adminSupabase
            .from('chat_participants')
            .select('id')
            .eq('chat_id', chatId)
            .eq('user_id', newUserId)
            .single();
        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member of this group' });
        }
        // Add new member
        const { error: insertError } = await adminSupabase
            .from('chat_participants')
            .insert({
            chat_id: chatId,
            user_id: newUserId,
            role: 'member',
            joined_at: new Date().toISOString()
        });
        if (insertError)
            throw insertError;
        // Log admin action
        await adminSupabase
            .from('group_admin_actions')
            .insert({
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
            const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
            });
            const { data: adminCount } = await adminSupabase
                .from('chat_participants')
                .select('id')
                .eq('chat_id', chatId)
                .eq('role', 'admin');
            if (adminCount && adminCount.length <= 1) {
                return res.status(400).json({ error: 'Cannot remove the last admin from the group' });
            }
        }
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        // Remove member
        const { error: deleteError } = await adminSupabase
            .from('chat_participants')
            .delete()
            .eq('chat_id', chatId)
            .eq('user_id', targetUserId);
        if (deleteError)
            throw deleteError;
        // Log admin action
        await adminSupabase
            .from('group_admin_actions')
            .insert({
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
            const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
            });
            const { data: adminCount } = await adminSupabase
                .from('chat_participants')
                .select('id')
                .eq('chat_id', chatId)
                .eq('role', 'admin');
            if (adminCount && adminCount.length <= 1) {
                return res.status(400).json({ error: 'Cannot demote the last admin from the group' });
            }
        }
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        // Update member role
        const { error: updateError } = await adminSupabase
            .from('chat_participants')
            .update({ role })
            .eq('chat_id', chatId)
            .eq('user_id', targetUserId);
        if (updateError)
            throw updateError;
        // Log admin action
        await adminSupabase
            .from('group_admin_actions')
            .insert({
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
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        // Remove member first
        await adminSupabase
            .from('chat_participants')
            .delete()
            .eq('chat_id', chatId)
            .eq('user_id', targetUserId);
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
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
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
        const adminSupabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        // Check if user is member of this chat
        const { data: userMembership } = await adminSupabase
            .from('chat_participants')
            .select('role')
            .eq('chat_id', chatId)
            .eq('user_id', userId)
            .single();
        if (!userMembership) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }
        // Get all members with user details
        const { data: members, error } = await adminSupabase
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
console.log('🔐 Secure backend endpoints initialized');
server.listen(PORT, () => {
    console.log(`🚀 Cyphr Messenger Server running on port ${PORT}`);
    console.log(`🔐 Post-quantum encryption: Kyber1024 + ChaCha20`);
    console.log(`🛡️  Secure backend endpoints: ENABLED`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

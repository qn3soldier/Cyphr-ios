// JWT Authentication Middleware for Enterprise Cyphr Messenger
const jwt = require('jsonwebtoken');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'cyphr-secure-jwt-secret-2024';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Generate JWT Access and Refresh Tokens
function generateTokens(userId, userMetadata = {}) {
  const accessToken = jwt.sign(
    { 
      userId, 
      type: 'access',
      ...userMetadata
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { 
      userId, 
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

// JWT Authentication Middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid token type' 
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token expired' 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid access token' 
    });
  }
}

// Refresh Token Middleware
function validateRefreshToken(req, res, next) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ 
      success: false, 
      error: 'Refresh token required' 
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid refresh token type' 
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Refresh token expired' 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid refresh token' 
    });
  }
}

// Socket.IO JWT Authentication
function authenticateSocketJWT(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    socket.userId = decoded.userId;
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
}

module.exports = {
  generateTokens,
  authenticateJWT,
  validateRefreshToken,
  authenticateSocketJWT,
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
};
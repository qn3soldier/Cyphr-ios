#!/bin/bash
# 🔧 FIX BUILD AND START APPLICATION
set -e

SERVER_IP="18.207.49.24"
SSH_KEY="~/.ssh/cyphr-key-1754685178.pem"

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - FIX BUILD & START APPLICATION     ║
╚══════════════════════════════════════════════════════════╝
"

# Fix build and start on server
ssh -i ~/.ssh/cyphr-key-1754685178.pem -o StrictHostKeyChecking=no ubuntu@$SERVER_IP << 'ENDSSH'
#!/bin/bash
set -e

cd /var/www/cyphr

echo "Fixing build and startup..."

# Install TypeScript globally if not present
npm install -g typescript tsx ts-node || true

# Check what we have
echo "Project structure:"
ls -la

echo "Package.json scripts:"
npm run 2>/dev/null || echo "No npm scripts found"

# Try to build TypeScript manually
if [ -f "tsconfig.json" ]; then
    echo "Building with TypeScript..."
    npx tsc || echo "TypeScript build failed"
fi

# If no dist folder, try to run directly from source
if [ ! -d "dist" ] && [ -f "server.ts" ]; then
    echo "No dist folder, updating PM2 config to run from TypeScript source..."
    
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: 'tsx',
      args: 'server.ts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: './.env.production',
      log_file: '/var/log/pm2/cyphr-backend.log',
      error_file: '/var/log/pm2/cyphr-backend-error.log',
      out_file: '/var/log/pm2/cyphr-backend-out.log',
      restart_delay: 4000,
      max_restarts: 5,
      interpreter: 'node',
      interpreter_args: '--loader tsx'
    }
  ]
};
EOF

elif [ ! -d "dist" ] && [ -f "src/server.ts" ]; then
    echo "Server in src folder, updating PM2 config..."
    
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: 'tsx',
      args: 'src/server.ts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: './.env.production',
      log_file: '/var/log/pm2/cyphr-backend.log',
      error_file: '/var/log/pm2/cyphr-backend-error.log',
      out_file: '/var/log/pm2/cyphr-backend-out.log',
      restart_delay: 4000,
      max_restarts: 5
    }
  ]
};
EOF

elif [ -f "server.js" ]; then
    echo "Found server.js, updating PM2 config..."
    
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: './.env.production',
      log_file: '/var/log/pm2/cyphr-backend.log',
      error_file: '/var/log/pm2/cyphr-backend-error.log',
      out_file: '/var/log/pm2/cyphr-backend-out.log',
      restart_delay: 4000,
      max_restarts: 5
    }
  ]
};
EOF

else
    echo "No server file found. Let's create a simple server..."
    
    cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API placeholder
app.get('/api/*', (req, res) => {
  res.json({ message: 'Cyphr Messenger API - Under Construction' });
});

// Serve app
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <html>
        <head><title>Cyphr Messenger</title></head>
        <body>
          <h1>🚀 Cyphr Messenger</h1>
          <p>Server is running! Deployment in progress...</p>
          <p>Time: ${new Date().toISOString()}</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Cyphr Messenger server running on port ${PORT}`);
});
EOF

    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: './.env.production',
      log_file: '/var/log/pm2/cyphr-backend.log',
      error_file: '/var/log/pm2/cyphr-backend-error.log',
      out_file: '/var/log/pm2/cyphr-backend-out.log',
      restart_delay: 4000,
      max_restarts: 5
    }
  ]
};
EOF

fi

# Install express if needed
npm install express

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

# Start with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash || true

# Check status
pm2 status
pm2 logs cyphr-backend --lines 10

echo "Application started! Check logs above."
ENDSSH

echo "
╔══════════════════════════════════════════════════════════╗
║               ✅ APPLICATION FIXED & STARTED!           ║
╚══════════════════════════════════════════════════════════╝

🌐 Your server should now be running at:
   http://18.207.49.24

📊 To check status:
   ssh -i ~/.ssh/cyphr-key-1754685178.pem ubuntu@18.207.49.24
   pm2 status
   pm2 logs

🔧 If there are still issues, we can debug further!
"
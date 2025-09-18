module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_file: './logs/pm2-backend-combined.log',
      time: true,
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', '.git'],
      
      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 5000,
      shutdown_with_message: true,
      
      // Health check
      health_check: {
        interval: 30,
        url: 'http://localhost:3001/health',
        max_consecutive_failures: 3
      },
      
      // Monitoring
      monitoring: {
        http: true,
        https: false,
        url: 'http://localhost:3001/health'
      }
    },
    {
      name: 'cyphr-websocket',
      script: './websocket-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/pm2-websocket-error.log',
      out_file: './logs/pm2-websocket-out.log',
      log_file: './logs/pm2-websocket-combined.log',
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false
    }
  ],

  // Deploy configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_EC2_IP',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/cyphr-messenger.git',
      path: '/var/www/cyphr',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Starting deployment setup"',
      'post-setup': 'echo "Deployment setup complete"',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
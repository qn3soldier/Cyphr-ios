module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: './server.ts',
      interpreter: 'tsx',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      restart_delay: 4000
    },
    {
      name: 'cyphr-websocket',
      script: './websocket-server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log',
      log_file: './logs/websocket-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};

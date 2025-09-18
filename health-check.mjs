#!/usr/bin/env node
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const SERVICES = [
  { name: 'Backend API', url: 'http://localhost:3001/health' },
  { name: 'Frontend', url: 'http://localhost:5173/' },
  { name: 'WebSocket', url: 'http://localhost:3002/health' },
  { name: 'Production', url: 'https://app.cyphrmessenger.app/health' }
];

async function checkHealth() {
  const results = [];
  
  for (const service of SERVICES) {
    try {
      const response = await fetch(service.url, { timeout: 5000 });
      results.push({
        service: service.name,
        status: response.ok ? 'UP' : 'DOWN',
        statusCode: response.status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        service: service.name,
        status: 'DOWN',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Check if any service is down
  const downServices = results.filter(r => r.status === 'DOWN');
  
  if (downServices.length > 0) {
    console.error('⚠️ Services Down:', downServices);
    // Send alert (implement email/slack notification here)
  } else {
    console.log('✅ All services healthy');
  }
  
  return results;
}

// Run health check
if (import.meta.url === `file://${process.argv[1]}`) {
  checkHealth()
    .then(results => console.log(JSON.stringify(results, null, 2)))
    .catch(console.error);
}

export { checkHealth };

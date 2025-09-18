import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import existing server
import('./server.js').then(module => {
  const app = module.default || module.app;
  
  // SSL Certificate paths
  const certDir = process.env.CERT_DIR || `${process.env.HOME}/.cyphr-ssl`;
  
  const httpsOptions = {
    key: fs.readFileSync(`${certDir}/key.pem`),
    cert: fs.readFileSync(`${certDir}/cert.pem`)
  };
  
  // Create HTTPS server
  const httpsServer = https.createServer(httpsOptions, app);
  
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server running on https://localhost:${HTTPS_PORT}`);
    console.log(`🔐 Post-quantum encryption: Kyber1024 + ChaCha20`);
    console.log(`✅ SSL/TLS enabled for production security`);
  });
});

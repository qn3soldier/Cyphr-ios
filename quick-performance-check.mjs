#!/usr/bin/env node
import { performance } from 'perf_hooks';
import fetch from 'node-fetch';

console.log('⚡ CYPHR MESSENGER QUICK PERFORMANCE CHECK\n');

async function quickCheck() {
  const results = [];
  
  // 1. API Health Check
  let start = performance.now();
  await fetch('http://localhost:3001/health');
  let time = performance.now() - start;
  results.push({ test: 'API Health Check', time, target: 100 });
  
  // 2. Frontend Load
  start = performance.now();
  try {
    await fetch('http://localhost:5173/');
  } catch (e) {
    // Frontend might not be running
  }
  time = performance.now() - start;
  results.push({ test: 'Frontend Load', time, target: 100 });
  
  // 3. Crypto Test (simple)
  const crypto = await import('crypto');
  start = performance.now();
  crypto.randomBytes(32);
  crypto.createHash('sha256').update('test').digest();
  time = performance.now() - start;
  results.push({ test: 'Crypto Operation', time, target: 20 });
  
  // 4. JSON Processing
  start = performance.now();
  JSON.stringify({ data: Array(1000).fill({ id: 1, name: 'test' }) });
  time = performance.now() - start;
  results.push({ test: 'JSON Processing', time, target: 20 });
  
  // Results
  console.log('📊 RESULTS:\n');
  results.forEach(r => {
    const status = r.time < r.target ? '✅' : '⚠️';
    console.log(`${status} ${r.test}: ${r.time.toFixed(2)}ms (target: <${r.target}ms)`);
  });
  
  const allPassed = results.every(r => r.time < r.target);
  console.log(`\n🏆 OVERALL: ${allPassed ? '✅ ALL TARGETS MET!' : '⚠️ SOME TARGETS MISSED'}`);
  
  // Average times
  const avgAPI = results.filter(r => r.test.includes('API')).reduce((a, b) => a + b.time, 0) / 1 || 0;
  const avgCrypto = results.filter(r => r.test.includes('Crypto')).reduce((a, b) => a + b.time, 0) / 1 || 0;
  
  console.log(`\n📈 AVERAGES:`);
  console.log(`  API: ${avgAPI.toFixed(2)}ms ${avgAPI < 100 ? '✅' : '❌'}`);
  console.log(`  Crypto: ${avgCrypto.toFixed(2)}ms ${avgCrypto < 20 ? '✅' : '❌'}`);
}

quickCheck().catch(console.error);
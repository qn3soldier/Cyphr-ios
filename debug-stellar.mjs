#!/usr/bin/env node
import * as StellarSdk from '@stellar/stellar-sdk';

console.log('Available in StellarSdk:');
console.log(Object.keys(StellarSdk));
console.log('');
console.log('Server:', typeof StellarSdk.Server);
console.log('Horizon:', typeof StellarSdk.Horizon);
console.log('Default export:', StellarSdk.default);
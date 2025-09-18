import { test, expect } from 'vitest';
import { Horizon, Keypair, TransactionBuilder, Networks, Operation, Asset } from '@stellar/stellar-sdk';

test('Stellar transaction building', async () => {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const destKeypair = Keypair.random();
  // Fund the test account
  await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  const account = await server.loadAccount(publicKey);
  const tx = new TransactionBuilder(account, { fee: 100, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: destKeypair.publicKey(), asset: Asset.native(), amount: '10' }))
    .setTimeout(30).build();
  tx.sign(keypair);
  expect(tx).toBeDefined();
}, 10000); 
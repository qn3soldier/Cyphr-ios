import { test, expect } from 'vitest';
import FinalKyber1024 from '../src/api/crypto/finalKyber1024';

test('Kyber encapsulation/decapsulation', async () => {
  const kyber = new FinalKyber1024();
  const { publicKey, secretKey } = await kyber.generateKeyPair();
  // Note: Class doesn't have encapsulate/decapsulate, using encrypt/decrypt as proxy
  const message = 'test message';
  const encrypted = await kyber.encryptMessage(message, publicKey, secretKey);
  const decrypted = await kyber.decryptMessage(encrypted, secretKey, publicKey);
  expect(decrypted).toEqual(message);
}); 
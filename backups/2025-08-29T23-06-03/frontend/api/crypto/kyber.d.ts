declare module '@ayxdele/kinetic-keys' {
  export const PQC: {
    KEM: {
      generateKeyPair(): Promise<{ publicKey: string; privateKey: string }>;
      encapsulate(publicKey: string): Promise<{ ciphertext: string; sharedSecret: string }>;
      decapsulate(ciphertext: string, privateKey: string): Promise<string>;
      toBase64(bytes: Uint8Array): string;
      fromBase64(base64: string): Uint8Array;
    };
  };
} 
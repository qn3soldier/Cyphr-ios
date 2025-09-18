import { PQC } from '@ayxdele/kinetic-keys';

export class Kyber1024 {
  private kem: any;

  constructor() {
    this.kem = PQC.KEM;
  }

  async generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    const keyPair = await this.kem.generateKeyPair();
    return {
      publicKey: this.kem.fromBase64(keyPair.publicKey),
      privateKey: this.kem.fromBase64(keyPair.privateKey)
    };
  }

  async encapsulate(publicKey: Uint8Array): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
    const publicKeyBase64 = this.kem.toBase64(publicKey);
    const result = await this.kem.encapsulate(publicKeyBase64);
    return {
      ciphertext: this.kem.fromBase64(result.ciphertext),
      sharedSecret: this.kem.fromBase64(result.sharedSecret)
    };
  }

  async decapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    const ciphertextBase64 = this.kem.toBase64(ciphertext);
    const privateKeyBase64 = this.kem.toBase64(privateKey);
    const sharedSecret = await this.kem.decapsulate(ciphertextBase64, privateKeyBase64);
    return this.kem.fromBase64(sharedSecret);
  }

  // Helper method to convert Uint8Array to base64 string
  static toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  // Helper method to convert base64 string to Uint8Array
  static fromBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
  }
}

export default new Kyber1024();
// Or export { generateKeyPair, encapsulate, decapsulate } as functions 
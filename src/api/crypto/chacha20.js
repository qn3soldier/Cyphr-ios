"use strict";
// ChaCha20 Stream Cipher Implementation
// RFC 8439 specification
Object.defineProperty(exports, "__esModule", { value: true });
class ChaCha20 {
    constructor() {
        this.blockSize = 64; // 512 bits
        this.keySize = 32; // 256 bits
        this.nonceSize = 12; // 96 bits
    }
    // Rotate left function
    rotl(a, b) {
        return ((a << b) | (a >>> (32 - b))) >>> 0;
    }
    // Quarter round function
    quarterRound(state, a, b, c, d) {
        state[a] = (state[a] + state[b]) >>> 0;
        state[d] = this.rotl(state[d] ^ state[a], 16);
        state[c] = (state[c] + state[d]) >>> 0;
        state[b] = this.rotl(state[b] ^ state[c], 12);
        state[a] = (state[a] + state[b]) >>> 0;
        state[d] = this.rotl(state[d] ^ state[a], 8);
        state[c] = (state[c] + state[d]) >>> 0;
        state[b] = this.rotl(state[b] ^ state[c], 7);
    }
    // ChaCha20 block function
    chacha20Block(key, nonce, counter) {
        // Constants
        const constants = [
            0x61707865, 0x3320646e, 0x79622d32, 0x6b206574
        ];
        // Initialize state
        const state = new Uint32Array(16);
        // Set constants
        state[0] = constants[0];
        state[1] = constants[1];
        state[2] = constants[2];
        state[3] = constants[3];
        // Set key (8 words)
        for (let i = 0; i < 8; i++) {
            state[4 + i] = (key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3];
        }
        // Set counter
        state[12] = counter;
        // Set nonce (3 words)
        for (let i = 0; i < 3; i++) {
            state[13 + i] = (nonce[i * 4] << 24) | (nonce[i * 4 + 1] << 16) | (nonce[i * 4 + 2] << 8) | nonce[i * 4 + 3];
        }
        // Create working copy
        const workingState = new Uint32Array(state);
        // 20 rounds (10 double rounds)
        for (let i = 0; i < 10; i++) {
            // Column rounds
            this.quarterRound(workingState, 0, 4, 8, 12);
            this.quarterRound(workingState, 1, 5, 9, 13);
            this.quarterRound(workingState, 2, 6, 10, 14);
            this.quarterRound(workingState, 3, 7, 11, 15);
            // Diagonal rounds
            this.quarterRound(workingState, 0, 5, 10, 15);
            this.quarterRound(workingState, 1, 6, 11, 12);
            this.quarterRound(workingState, 2, 7, 8, 13);
            this.quarterRound(workingState, 3, 4, 9, 14);
        }
        // Add original state
        for (let i = 0; i < 16; i++) {
            workingState[i] = (workingState[i] + state[i]) >>> 0;
        }
        // Convert to byte array
        const output = new Uint8Array(64);
        for (let i = 0; i < 16; i++) {
            output[i * 4] = (workingState[i] >>> 24) & 0xFF;
            output[i * 4 + 1] = (workingState[i] >>> 16) & 0xFF;
            output[i * 4 + 2] = (workingState[i] >>> 8) & 0xFF;
            output[i * 4 + 3] = workingState[i] & 0xFF;
        }
        return output;
    }
    // Generate keystream
    generateKeystream(key, nonce, length) {
        const keystream = new Uint8Array(length);
        const blocks = Math.ceil(length / this.blockSize);
        for (let i = 0; i < blocks; i++) {
            const block = this.chacha20Block(key, nonce, i);
            const start = i * this.blockSize;
            const end = Math.min(start + this.blockSize, length);
            for (let j = start; j < end; j++) {
                keystream[j] = block[j - start];
            }
        }
        return keystream;
    }
    // Encrypt plaintext
    encrypt(plaintext, key, nonce) {
        if (key.length !== this.keySize) {
            throw new Error(`Key must be ${this.keySize} bytes`);
        }
        if (nonce.length !== this.nonceSize) {
            throw new Error(`Nonce must be ${this.nonceSize} bytes`);
        }
        const keystream = this.generateKeystream(key, nonce, plaintext.length);
        const ciphertext = new Uint8Array(plaintext.length);
        for (let i = 0; i < plaintext.length; i++) {
            ciphertext[i] = plaintext[i] ^ keystream[i];
        }
        return ciphertext;
    }
    // Decrypt ciphertext (same as encrypt for stream cipher)
    decrypt(ciphertext, key, nonce) {
        return this.encrypt(ciphertext, key, nonce);
    }
    // Generate random key
    generateKey() {
        const key = new Uint8Array(this.keySize);
        crypto.getRandomValues(key);
        return key;
    }
    // Generate random nonce
    generateNonce() {
        const nonce = new Uint8Array(this.nonceSize);
        crypto.getRandomValues(nonce);
        return nonce;
    }
    // Encrypt with random nonce
    encryptWithRandomNonce(plaintext, key) {
        const nonce = this.generateNonce();
        const ciphertext = this.encrypt(plaintext, key, nonce);
        // Return nonce + ciphertext
        const result = new Uint8Array(this.nonceSize + ciphertext.length);
        result.set(nonce, 0);
        result.set(ciphertext, this.nonceSize);
        return result;
    }
    // Decrypt with nonce prefix
    decryptWithNoncePrefix(data, key) {
        if (data.length < this.nonceSize) {
            throw new Error('Data too short');
        }
        const nonce = data.slice(0, this.nonceSize);
        const ciphertext = data.slice(this.nonceSize);
        return this.decrypt(ciphertext, key, nonce);
    }
}
exports.default = ChaCha20;

// src/services/encryption.ts

export class EncryptionService {
  private static instance: EncryptionService;
  private encoder: TextEncoder;
  private decoder: TextDecoder;

  private constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: string, key: CryptoKey): Promise<string> {
    const encodedData = this.encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encodedData
    );
    
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );
    
    return this.decoder.decode(decryptedData);
  }

  async encryptObject<T>(obj: T, key: CryptoKey): Promise<string> {
    return this.encrypt(JSON.stringify(obj), key);
  }

  async decryptObject<T>(encrypted: string, key: CryptoKey): Promise<T> {
    const decrypted = await this.decrypt(encrypted, key);
    return JSON.parse(decrypted);
  }
}

export const encryption = EncryptionService.getInstance();
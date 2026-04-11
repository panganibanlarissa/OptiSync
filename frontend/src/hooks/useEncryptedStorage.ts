// src/hooks/useEncryptedStorage.ts
import { useState, useEffect, useCallback } from 'react';
import { encryption } from '@/services/encryption';

interface EncryptedStorageOptions {
  keyName: string;
  encryptionKey?: CryptoKey;
}

export function useEncryptedStorage<T>({ keyName, encryptionKey }: EncryptedStorageOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load encrypted data from localStorage
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const encrypted = localStorage.getItem(`${keyName}_encrypted`);
      
      if (encrypted && encryptionKey) {
        const decrypted = await encryption.decryptObject<T>(encrypted, encryptionKey);
        setData(decrypted);
      } else if (encrypted) {
        // Legacy unencrypted data
        const parsed = JSON.parse(encrypted);
        setData(parsed);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load encrypted data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [keyName, encryptionKey]);

  // Save data with encryption
  const saveData = useCallback(async (newData: T) => {
    try {
      if (encryptionKey) {
        const encrypted = await encryption.encryptObject(newData, encryptionKey);
        localStorage.setItem(`${keyName}_encrypted`, encrypted);
      } else {
        localStorage.setItem(`${keyName}_encrypted`, JSON.stringify(newData));
      }
      setData(newData);
      setError(null);
    } catch (err) {
      console.error('Failed to save encrypted data:', err);
      setError('Failed to save data');
      throw err;
    }
  }, [keyName, encryptionKey]);

  // Clear encrypted data
  const clearData = useCallback(() => {
    localStorage.removeItem(`${keyName}_encrypted`);
    setData(null);
  }, [keyName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, saveData, clearData, loadData };
}
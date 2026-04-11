// src/services/backupService.ts
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit, Timestamp } from 'firebase/firestore';

interface BackupStatus {
  lastBackupTime: Date | null;
  backupStatus: 'success' | 'failed' | 'pending' | 'never';
  recordCount: number;
  errorMessage?: string;
}

class BackupService {
  private static instance: BackupService;
  private backupHistory: BackupStatus[] = [];
  private CLINIC_ID: string;

  private constructor() {
    this.CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || 'rlDgfGc4fZYrriUVdGnYI6Zhj3a2';
    this.startPeriodicCheck();
  }

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  private startPeriodicCheck() {
    // Check backup every hour
    setInterval(() => {
      this.verifyBackup();
    }, 60 * 60 * 1000); // 1 hour
  }

  async verifyBackup(): Promise<BackupStatus> {
    try {
      const startTime = Date.now();
      
      // Test query to verify database is accessible
      const productsRef = collection(db, `clinics/${this.CLINIC_ID}/products`);
      const productsQuery = query(productsRef, limit(1));
      await getDocs(productsQuery);
      
      const responseTime = Date.now() - startTime;
      
      const status: BackupStatus = {
        lastBackupTime: new Date(),
        backupStatus: responseTime < 5000 ? 'success' : 'pending',
        recordCount: await this.getRecordCount(),
      };
      
      this.backupHistory.unshift(status);
      // Keep last 24 hours of history
      if (this.backupHistory.length > 24) {
        this.backupHistory.pop();
      }
      
      // Store in localStorage for persistence
      localStorage.setItem('backupHistory', JSON.stringify(this.backupHistory));
      
      return status;
    } catch (error) {
      const status: BackupStatus = {
        lastBackupTime: new Date(),
        backupStatus: 'failed',
        recordCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
      
      this.backupHistory.unshift(status);
      localStorage.setItem('backupHistory', JSON.stringify(this.backupHistory));
      
      return status;
    }
  }

  private async getRecordCount(): Promise<number> {
    try {
      const productsRef = collection(db, `clinics/${this.CLINIC_ID}/products`);
      const snapshot = await getDocs(productsRef);
      return snapshot.size;
    } catch {
      return 0;
    }
  }

  getBackupHistory(): BackupStatus[] {
    return this.backupHistory;
  }

  getLastBackupStatus(): BackupStatus | null {
    return this.backupHistory[0] || null;
  }
}

export const backupService = BackupService.getInstance();
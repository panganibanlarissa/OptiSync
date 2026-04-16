// frontend/src/services/notificationMigration.ts
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { NotificationType } from '@/components/NotificationProvider';

const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || 'rlDgfGc4fZYrriUVdGnYI6Zhj3a2';

interface LegacyNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
  link?: string;
  data?: any;
}

class NotificationMigration {
  private static instance: NotificationMigration;
  private constructor() {}

  static getInstance(): NotificationMigration {
    if (!NotificationMigration.instance) {
      NotificationMigration.instance = new NotificationMigration();
    }
    return NotificationMigration.instance;
  }

  async migrateFromLocalStorage(): Promise<{ migrated: number; skipped: number }> {
    try {
      const stored = localStorage.getItem('notifications');
      if (!stored) {
        console.log('No existing notifications found in localStorage');
        return { migrated: 0, skipped: 0 };
      }

      const legacyNotifications: LegacyNotification[] = JSON.parse(stored);
      
      if (legacyNotifications.length === 0) {
        console.log('No notifications to migrate');
        return { migrated: 0, skipped: 0 };
      }

      console.log(`Found ${legacyNotifications.length} notifications to migrate`);

      let migrated = 0;
      let skipped = 0;

      for (const legacyNotif of legacyNotifications) {
        const triggerEventId = this.generateTriggerEventId(legacyNotif);
        
        const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
        const existingQuery = query(
          notificationsRef,
          where('triggerEventId', '==', triggerEventId)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          skipped++;
          continue;
        }

        await addDoc(notificationsRef, {
          title: legacyNotif.title,
          message: legacyNotif.message,
          type: legacyNotif.type,
          eventTimestamp: Timestamp.fromDate(legacyNotif.timestamp),
          createdAt: serverTimestamp(),
          read: legacyNotif.read,
          readAt: legacyNotif.read ? serverTimestamp() : null,
          link: legacyNotif.link || null,
          data: legacyNotif.data || null,
          forAdmin: this.determineForAdmin(legacyNotif),
          forStaff: true,
          triggerEventId: triggerEventId,
          isResolved: this.isNotificationResolved(legacyNotif),
          resolvedAt: this.isNotificationResolved(legacyNotif) ? serverTimestamp() : null
        });
        
        migrated++;
      }

      console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`);
      
      if (migrated > 0) {
        localStorage.removeItem('notifications');
        localStorage.setItem('notifications_migrated', new Date().toISOString());
      }
      
      return { migrated, skipped };
    } catch (error) {
      console.error('Error migrating notifications:', error);
      return { migrated: 0, skipped: 0 };
    }
  }

  private generateTriggerEventId(notification: LegacyNotification): string {
    let productId = 'unknown';
    
    if (notification.data?.productId) {
      productId = notification.data.productId;
    } else {
      const match = notification.message.match(/([A-Za-z0-9\s]+?)(?:\s+is|\s+hasn't|\s+expires)/);
      if (match) {
        productId = match[1].toLowerCase().replace(/\s+/g, '-');
      }
    }
    
    let eventType = 'general';
    if (notification.title.includes('Low Stock')) eventType = 'low-stock';
    else if (notification.title.includes('Out of Stock')) eventType = 'out-of-stock';
    else if (notification.title.includes('Liquidation')) eventType = 'liquidation';
    else if (notification.title.includes('Expiry')) eventType = 'expiry';
    
    const dateStr = notification.timestamp.toISOString().split('T')[0];
    
    return `${eventType}-${productId}-${dateStr}`;
  }

  private determineForAdmin(notification: LegacyNotification): boolean {
    return notification.title.includes('Liquidation') || 
           notification.title.includes('Report') ||
           notification.type === 'info';
  }

  private isNotificationResolved(notification: LegacyNotification): boolean {
    if (notification.title.includes('Low Stock')) {
      const daysOld = (Date.now() - notification.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysOld > 7;
    }
    
    if (notification.title.includes('Expiry') && notification.data?.expiryDate) {
      const expiryDate = new Date(notification.data.expiryDate);
      return expiryDate < new Date();
    }
    
    const daysOld = (Date.now() - notification.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld > 30;
  }

  async runMigrationIfNeeded(): Promise<void> {
    const migratedFlag = localStorage.getItem('notifications_migrated');
    
    if (!migratedFlag) {
      console.log('First time running with persistent notifications. Migrating existing data...');
      await this.migrateFromLocalStorage();
    } else {
      console.log('Notifications already migrated on:', migratedFlag);
    }
  }
}

export const notificationMigration = NotificationMigration.getInstance();
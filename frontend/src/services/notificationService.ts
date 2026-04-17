// frontend/src/services/notificationService.ts
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  DocumentSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import { NotificationType, NotificationData } from '@/components/NotificationProvider';

const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || 'rlDgfGc4fZYrriUVdGnYI6Zhj3a2';

export interface StoredNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  eventTimestamp: Timestamp;
  createdAt: Timestamp;
  read: boolean;
  readAt?: Timestamp;
  link?: string;
  data?: NotificationData;
  forAdmin: boolean;
  forStaff: boolean;
  triggerEventId: string;
  isResolved: boolean;
  resolvedAt?: Timestamp;
}

class NotificationService {
  private static instance: NotificationService;
  private listeners: Array<(notifications: StoredNotification[]) => void> = [];
  private unsubscribe: (() => void) | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  subscribe(callback: (notifications: StoredNotification[]) => void): () => void {
    this.listeners.push(callback);
    
    if (!this.unsubscribe) {
      this.startListening();
    }
    
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
      if (this.listeners.length === 0 && this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }

  async fetchNotifications(): Promise<StoredNotification[]> {
    try {
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      const q = query(
        notificationsRef,
        orderBy('eventTimestamp', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const notifications: StoredNotification[] = [];
      
      snapshot.forEach((doc: DocumentSnapshot) => {
        const data = doc.data();
        if (data) {
          notifications.push({
            id: doc.id,
            ...data
          } as StoredNotification);
        }
      });
      
      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  private startListening() {
    try {
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      const q = query(
        notificationsRef,
        orderBy('eventTimestamp', 'desc'),
        limit(100)
      );

      this.unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot) => {
        const notifications: StoredNotification[] = [];
        snapshot.forEach((doc: DocumentSnapshot) => {
          const data = doc.data();
          if (data) {
            notifications.push({
              id: doc.id,
              ...data
            } as StoredNotification);
          }
        });
        
        this.listeners.forEach(callback => callback(notifications));
      }, (error: Error) => {
        console.error('Error listening to notifications:', error);
      });
    } catch (error) {
      console.error('Failed to start notification listener:', error);
    }
  }

  async createNotification(
    title: string,
    message: string,
    type: NotificationType,
    triggerEventId: string,
    options?: {
      link?: string;
      data?: NotificationData;
      forAdmin?: boolean;
      forStaff?: boolean;
      eventTimestamp?: Date;
    }
  ): Promise<string | null> {
    try {
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      
      const existingQuery = query(
        notificationsRef,
        where('triggerEventId', '==', triggerEventId),
        where('isResolved', '==', false)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        console.log(`Notification already exists for event: ${triggerEventId}`);
        return existingSnapshot.docs[0].id;
      }

      const eventTimestamp = options?.eventTimestamp 
        ? Timestamp.fromDate(options.eventTimestamp)
        : serverTimestamp();

      const docRef = await addDoc(notificationsRef, {
        title,
        message,
        type,
        eventTimestamp,
        createdAt: serverTimestamp(),
        read: false,
        link: options?.link || null,
        data: options?.data || null,
        forAdmin: options?.forAdmin ?? false,
        forStaff: options?.forStaff ?? true,
        triggerEventId,
        isResolved: false
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, `clinics/${CLINIC_ID}/notifications`, notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      const q = query(notificationsRef, where('read', '==', false));
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc: DocumentSnapshot) => {
        batch.update(doc.ref, {
          read: true,
          readAt: serverTimestamp()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, `clinics/${CLINIC_ID}/notifications`, notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  async resolveNotification(triggerEventId: string): Promise<void> {
    try {
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      const q = query(
        notificationsRef,
        where('triggerEventId', '==', triggerEventId),
        where('isResolved', '==', false)
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc: DocumentSnapshot) => {
        batch.update(doc.ref, {
          isResolved: true,
          resolvedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error resolving notification:', error);
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      const q = query(
        notificationsRef,
        where('read', '==', false),
        where('isResolved', '==', false)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async cleanupOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const notificationsRef = collection(db, `clinics/${CLINIC_ID}/notifications`);
      const q = query(
        notificationsRef,
        where('isResolved', '==', true),
        where('resolvedAt', '<', Timestamp.fromDate(thirtyDaysAgo))
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc: DocumentSnapshot) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
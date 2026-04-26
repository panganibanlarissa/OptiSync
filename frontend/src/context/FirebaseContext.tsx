// src/context/FirebaseContext.tsx

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef
} from "react";

import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  initializeAuth,
  browserLocalPersistence,
  getAuth,
  updateProfile,
  sendEmailVerification
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
  Timestamp,
  getDoc,
  setDoc,
  limit,
  onSnapshot,
  writeBatch,
  where
} from "firebase/firestore";

import { app as firebaseApp, auth, db } from "@/lib/firebase";
import { initializeApp, getApps } from "firebase/app";

// 🔥 CONFIG
const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

// 🔐 SECONDARY AUTH - Used for creating users without affecting main auth
const getSecondaryAuth = () => {
  const name = "secondary-auth-app";
  const existing = getApps().find((app) => app.name === name);

  if (existing) return getAuth(existing);

  const newApp = initializeApp(firebaseApp.options, name);
  return initializeAuth(newApp, {
    persistence: browserLocalPersistence
  });
};

// ================= TYPES =================

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  specifications: string;
  baseCost: number;
  markupPrice: number;
  supplierInfo: string;
  stock: number;
  beginningInventory?: number;
  lastMovedDaysAgo: number;
  imageColor: string;
  image: string | null;
  leadTimeDays: number;
  reorderPoint: number;
  expiryDate?: string | null;
  batchNumber?: string;
  manufacturingDate?: Date;
  totalSold?: number;
  damageExchanged?: number;
  restockCount?: number;
  deleted?: boolean;
  archived?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Transaction {
  id: string;
  total: number;
  date: Date;
  status: "completed" | "processing_replacement" | "replaced";
  items: any[];
  patientName?: string;
  paymentMethod?: "cash" | "online";
  amountReceive?: number;
  change?: number;
  warrantyStartDate?: Date | string;
  warrantyEndDate?: Date | string;
  referenceNumber?: string;
  synced?: boolean;
  staffName?: string;
  staffId?: string;
  replacementReason?: string;
  replacedAt?: Date;
  replacedBy?: string;
  processedAt?: Date;
  processedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StaffUser {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  status: "Active" | "Inactive" | "Deleted" | "PendingVerification";
  lastLogin: string;
  lastLoginTimestamp?: Date | null;
  emailVerified?: boolean;
  createdAt?: Timestamp;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: "admin" | "staff";
  name?: string;
  status?: string;
  emailVerified?: boolean;
}

// ================= CONTEXT =================

interface FirebaseContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  products: Product[];
  addProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, newStock: number, reason: string, staffName?: string, staffId?: string) => Promise<void>;
  archiveProduct: (id: string, archived: boolean, reason?: string, markDeleted?: boolean) => Promise<void>;

  transactions: Transaction[];
  addTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<string>;
  processReplacement: (id: string, reason: string, processedBy: string) => Promise<void>;
  markReplacementAsCompleted: (id: string, replacedBy: string) => Promise<void>;

  staffUsers: StaffUser[];
  fetchStaffUsers: (forceRefresh?: boolean) => Promise<void>;

  createStaffUser: (email: string, password: string, name: string, role: "admin" | "staff") => Promise<string>;
  updateStaffUser: (uid: string, data: Partial<StaffUser>) => Promise<void>;
  deleteStaffUser: (uid: string) => Promise<void>;
  deactivateStaffUser: (uid: string) => Promise<void>;
  reactivateStaffUser: (uid: string) => Promise<void>;
  resetStaffPassword: (email: string) => Promise<void>;
  resendVerificationEmail: (email: string, password?: string) => Promise<void>;

  getLowStockProducts: () => Product[];
  getDeadstockProducts: () => Product[];

  userRole: string | null;
  userName: string;
  userId: string;
  userEmail: string;

  isOnline: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined
);

// Helper function to format last login date
const formatLastLogin = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper function to create or update user document
const ensureUserDocument = async (uid: string, email: string | null, name?: string) => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: email || "",
      name: name || email?.split('@')[0] || "User",
      role: "staff",
      status: "Active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: "Never",
      lastLoginAt: null,
      emailVerified: true,
      isLegacyAccount: true
    });
    console.log("Created user document for existing account:", uid);
  }
  
  return userRef;
};

// Helper function to log logout events
const logLogout = async (staffName: string, staffId: string, userEmail: string | null, sessionDuration?: number) => {
  try {
    const logoutRef = collection(db, `clinics/${CLINIC_ID}/logout_logs`);
    
    const logoutData = {
      staffName: staffName || 'Unknown User',
      staffId: staffId || 'unknown',
      email: userEmail || null,
      timestamp: serverTimestamp(),
      sessionDurationSeconds: sessionDuration || 0,
      sessionDurationMinutes: sessionDuration ? Math.floor(sessionDuration / 60) : 0,
      logoutDate: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(logoutRef, logoutData);
    console.log("✅ Logout event logged successfully with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error logging logout:", error);
    return null;
  }
};

// Helper function to log stock adjustments (for MANUAL adjustments only)
const logStockAdjustment = async (
  productId: string, 
  oldStock: number, 
  newStock: number, 
  reason: string, 
  staffId: string, 
  staffName: string,
  productName?: string
) => {
  try {
    const stockAdjustmentsRef = collection(db, `clinics/${CLINIC_ID}/stockAdjustments`);
    await addDoc(stockAdjustmentsRef, {
      productId,
      productName: productName || null,
      oldStock,
      newStock,
      reason,
      staffId,
      staffName,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Stock adjustment logged: ${staffName} changed stock from ${oldStock} to ${newStock}. Reason: ${reason}`);
  } catch (error) {
    console.error("Error logging stock adjustment:", error);
  }
};

// Helper function to get product details string for activity logging
const getProductDetailsForLog = (items: any[]): string => {
  if (!items || items.length === 0) return '';
  
  const productDetails = items.map(item => {
    const itemName = item.name || 'Unknown Product';
    const itemQuantity = item.quantity || 1;
    return `${itemQuantity}x ${itemName}`;
  }).join(', ');
  
  return productDetails;
};

// Helper function to log product deletion
const logProductDeletion = async (productId: string, productName: string, staffName: string, staffId: string) => {
  try {
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    
    await addDoc(activityRef, {
      type: 'product_delete',
      action: 'product_deleted',
      description: `${staffName} deleted product "${productName}" (ID: ${productId}) from inventory`,
      staffName: staffName,
      staffId: staffId,
      productId: productId,
      productName: productName,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Product deletion logged for ${productName}`);
  } catch (error) {
    console.error('Error logging product deletion:', error);
  }
};

// Helper function to log product archival/unarchival
const logProductArchive = async (productId: string, productName: string, archived: boolean, staffName: string, staffId: string, reason?: string) => {
  try {
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    const actionText = archived ? 'archived' : 'restored from archive';
    
    await addDoc(activityRef, {
      type: 'product_archive',  // Change from 'product_archive' to a distinct type
      action: archived ? 'product_archived' : 'product_unarchived',
      description: `${staffName} ${actionText} product "${productName}" (ID: ${productId})${reason ? ` Reason: ${reason}` : ''}`,
      staffName: staffName,
      staffId: staffId,
      productId: productId,
      productName: productName,
      archived: archived,
      reason: reason || null,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Product ${actionText} logged for ${productName}`);
  } catch (error) {
    console.error('Error logging product archive:', error);
  }
};

// Helper function to log product addition
const logProductAddition = async (productId: string, productName: string, productSku: string, productCategory: string, productPrice: number, staffName: string, staffId: string) => {
  try {
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    
    await addDoc(activityRef, {
      type: 'product_add',
      action: 'product_added',
      description: `${staffName} added new product "${productName}" (SKU: ${productSku}, Category: ${productCategory}, Price: ₱${productPrice.toLocaleString()}) to inventory`,
      staffName: staffName,
      staffId: staffId,
      productId: productId,
      productName: productName,
      productSku: productSku,
      productCategory: productCategory,
      productPrice: productPrice,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Product addition logged for ${productName}`);
  } catch (error) {
    console.error('Error logging product addition:', error);
  }
};

// Helper function to log product edit with changes
const logProductEdit = async (
  productId: string, 
  productName: string, 
  changes: Array<{ field: string; oldValue: any; newValue: any }>, 
  staffName: string, 
  staffId: string
) => {
  try {
    if (changes.length === 0) return;
    
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    
    // Format changes for display
    const changesText = changes.map(change => {
      const fieldName = change.field === 'markupPrice' ? 'price' : 
                        change.field === 'baseCost' ? 'cost' :
                        change.field === 'reorderPoint' ? 'reorder point' :
                        change.field === 'leadTimeDays' ? 'lead time' : change.field;
      
      if (typeof change.oldValue === 'number' && typeof change.newValue === 'number') {
        if (change.field === 'markupPrice' || change.field === 'baseCost') {
          return `${fieldName}: ₱${change.oldValue.toLocaleString()} → ₱${change.newValue.toLocaleString()}`;
        }
        return `${fieldName}: ${change.oldValue} → ${change.newValue}`;
      }
      return `${fieldName}: "${change.oldValue}" → "${change.newValue}"`;
    }).join(', ');
    
    await addDoc(activityRef, {
      type: 'product_edit',
      action: 'product_edited',
      description: `${staffName} edited product "${productName}". Changes: ${changesText}`,
      staffName: staffName,
      staffId: staffId,
      productId: productId,
      productName: productName,
      changes: changes,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Product edit logged for ${productName}`);
  } catch (error) {
    console.error('Error logging product edit:', error);
  }
};

// Helper function to log scan in/out activity
const logScanActivity = async (
  productId: string,
  productName: string,
  oldStock: number,
  newStock: number,
  scanType: 'in' | 'out',
  staffName: string,
  staffId: string
) => {
  try {
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    const changeAmount = Math.abs(newStock - oldStock);
    const actionText = scanType === 'in' ? 'Scanned In' : 'Scanned Out';
    const description = scanType === 'in'
      ? `${staffName} scanned in ${changeAmount} unit(s) of "${productName}". Stock updated from ${oldStock} to ${newStock}.`
      : `${staffName} scanned out ${changeAmount} unit(s) of "${productName}". Stock updated from ${oldStock} to ${newStock}.`;
    
    await addDoc(activityRef, {
      type: scanType === 'in' ? 'scan_in' : 'scan_out',
      action: actionText,
      description: description,
      staffName: staffName,
      staffId: staffId,
      productId: productId,
      productName: productName,
      oldStock: oldStock,
      newStock: newStock,
      quantityChanged: changeAmount,
      timestamp: serverTimestamp()
    });
    console.log(`✅ ${actionText} activity logged for ${productName}`);
  } catch (error) {
    console.error('Error logging scan activity:', error);
  }
};

// Helper function to log sale completed activity
const logSaleCompleted = async (transactionId: string, staffName: string, patientName: string, total: number, items: any[]) => {
  try {
    const productDetails = getProductDetailsForLog(items);
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    
    await addDoc(activityRef, {
      type: 'transaction',
      action: 'sale_completed',
      description: `${staffName} processed sale for ${patientName || 'Walk-in Patient'}. Total: ₱${total.toLocaleString()}. Products: ${productDetails}`,
      staffName: staffName,
      staffId: staffName,
      transactionId: transactionId,
      patientName: patientName || 'Walk-in Patient',
      total: total,
      productDetails: productDetails,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Sale completed activity logged for transaction ${transactionId}`);
  } catch (error) {
    console.error('Error logging sale completed activity:', error);
  }
};

// Helper function to log replacement initiated activity
const logReplacementInitiated = async (transactionId: string, reason: string, staffName: string, patientName: string, total: number, items: any[]) => {
  try {
    const productDetails = getProductDetailsForLog(items);
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    
    await addDoc(activityRef, {
      type: 'replacement',
      action: 'replacement_initiated',
      description: `${staffName} initiated replacement for transaction #${transactionId.slice(-8).toUpperCase()} (${patientName || 'Walk-in Patient'} - ₱${total.toLocaleString()})${reason ? ` Reason: ${reason}` : ''}. Products: ${productDetails}`,
      staffName: staffName,
      staffId: staffName,
      transactionId: transactionId,
      patientName: patientName || 'Walk-in Patient',
      total: total,
      productDetails: productDetails,
      reason: reason || null,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Replacement initiated activity logged for transaction ${transactionId}`);
  } catch (error) {
    console.error('Error logging replacement initiated activity:', error);
  }
};

// Helper function to log replacement completed activity
const logReplacementCompleted = async (transactionId: string, staffName: string, patientName: string, total: number, items: any[]) => {
  try {
    const productDetails = getProductDetailsForLog(items);
    const activityRef = collection(db, `clinics/${CLINIC_ID}/activityLogs`);
    
    await addDoc(activityRef, {
      type: 'replacement',
      action: 'replacement_completed',
      description: `${staffName} completed replacement for transaction #${transactionId.slice(-8).toUpperCase()} (${patientName || 'Walk-in Patient'} - ₱${total.toLocaleString()}). Products: ${productDetails}`,
      staffName: staffName,
      staffId: staffName,
      transactionId: transactionId,
      patientName: patientName || 'Walk-in Patient',
      total: total,
      productDetails: productDetails,
      timestamp: serverTimestamp()
    });
    console.log(`✅ Replacement completed activity logged for transaction ${transactionId}`);
  } catch (error) {
    console.error('Error logging replacement completed activity:', error);
  }
};

// Helper function to compare objects for changes
const getChangedFields = (oldData: any, newData: any, ignoredFields: string[] = ['updatedAt', 'createdAt', 'id']): Array<{ field: string; oldValue: any; newValue: any }> => {
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  
  for (const key of allKeys) {
    if (ignoredFields.includes(key)) continue;
    
    const oldValue = oldData?.[key];
    const newValue = newData?.[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        oldValue: oldValue,
        newValue: newValue
      });
    }
  }
  
  return changes;
};

// ================= PROVIDER =================

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [isOnline, setIsOnline] = useState(true);

  // Cache flags
  const hasFetchedProductsRef = useRef(false);
  const hasFetchedTransactionsRef = useRef(false);
  const hasFetchedUsersRef = useRef(false);
  
  const isFetchingProductsRef = useRef(false);
  const isFetchingTransactionsRef = useRef(false);
  const isFetchingUsersRef = useRef(false);
  
  const lastProductsFetchRef = useRef<number>(0);
  const lastTransactionsFetchRef = useRef<number>(0);
  const lastUsersFetchRef = useRef<number>(0);
  
  const CACHE_TTL = 10 * 60 * 1000;

  const sessionStartTimeRef = useRef<number | null>(null);
  const pendingUserPasswords = useRef<Map<string, string>>(new Map());
  const listenersSetupRef = useRef(false);
  const initialStaffFetchDoneRef = useRef(false);

  // ================= AUTH =================

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        setUserId(u.uid);
        setUserEmail(u.email || "");
        
        sessionStartTimeRef.current = Date.now();

        await ensureUserDocument(u.uid, u.email);
        
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          const isLegacy = data.isLegacyAccount === true;
          
          const createdAt = data.createdAt?.toDate?.() || new Date(0);
          const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const isNewAccount = !isLegacy && data.emailVerified === false && daysSinceCreation < 30;
          
          setUserRole(data.role || "staff");
          setUserName(data.name || "Staff");

          setAppUser({
            uid: u.uid,
            email: u.email,
            role: data.role,
            name: data.name,
            status: data.status || "Active",
            emailVerified: isNewAccount ? false : true
          });
        } else {
          setUserRole("staff");
          setUserName("Staff");
          setAppUser({
            uid: u.uid,
            email: u.email,
            role: "staff",
            name: "Staff",
            status: "Active",
            emailVerified: true
          });
        }
      } else {
        setAppUser(null);
        setUserRole(null);
        setUserName("");
        setUserId("");
        setUserEmail("");
        setStaffUsers([]);
        hasFetchedProductsRef.current = false;
        hasFetchedTransactionsRef.current = false;
        hasFetchedUsersRef.current = false;
        listenersSetupRef.current = false;
        initialStaffFetchDoneRef.current = false;
        sessionStartTimeRef.current = null;
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ================= NETWORK =================

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ================= FETCH STAFF USERS =================

  const fetchStaffUsers = useCallback(async (forceRefresh = false) => {
    if (userRole !== "admin") {
      return;
    }
    
    const now = Date.now();
    
    if (!forceRefresh && hasFetchedUsersRef.current && (now - lastUsersFetchRef.current) < CACHE_TTL) {
      return;
    }
    
    if (isFetchingUsersRef.current) return;
    
    isFetchingUsersRef.current = true;

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("createdAt", "desc"), limit(50));
      
      const snap = await getDocs(q);

      const fetchedUsers = snap.docs.map((d) => {
        const data = d.data();
        const lastLoginTimestamp = data.lastLoginAt?.toDate() || null;
        const createdAt = data.createdAt?.toDate?.() || new Date(0);
        const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const isLegacy = data.isLegacyAccount === true;
        
        let displayStatus = data.status;
        const isNewAccount = !isLegacy && data.emailVerified === false && daysSinceCreation < 30;
        
        if (isNewAccount && displayStatus !== "Inactive" && displayStatus !== "Deleted") {
          displayStatus = "PendingVerification";
        } else if (!isNewAccount && displayStatus === "PendingVerification") {
          displayStatus = "Active";
        }
        
        return {
          uid: d.id,
          ...data,
          status: displayStatus,
          lastLogin: lastLoginTimestamp ? formatLastLogin(lastLoginTimestamp) : (data.lastLogin || "Never"),
          lastLoginTimestamp: lastLoginTimestamp,
          emailVerified: isNewAccount ? false : true,
          createdAt: data.createdAt
        };
      }) as StaffUser[];

      setStaffUsers(fetchedUsers);
      hasFetchedUsersRef.current = true;
      lastUsersFetchRef.current = now;
    } catch (error) {
      console.error("Error fetching staff users:", error);
    } finally {
      isFetchingUsersRef.current = false;
    }
  }, [userRole]);

  // ================= FETCH PRODUCTS =================

  const fetchProducts = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    
    if (!forceRefresh && hasFetchedProductsRef.current && (now - lastProductsFetchRef.current) < CACHE_TTL) {
      return;
    }
    
    if (isFetchingProductsRef.current) return;
    
    isFetchingProductsRef.current = true;
    
    try {
      const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
      const q = query(productsRef, orderBy("createdAt", "desc"), limit(100));
      
      const snap = await getDocs(q);

      const fetchedProducts = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as Product[];

      setProducts(fetchedProducts);
      hasFetchedProductsRef.current = true;
      lastProductsFetchRef.current = now;
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      isFetchingProductsRef.current = false;
    }
  }, []);

  // ================= FETCH TRANSACTIONS =================

  const fetchTransactions = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    const now = Date.now();
    
    if (!forceRefresh && hasFetchedTransactionsRef.current && (now - lastTransactionsFetchRef.current) < CACHE_TTL) {
      return;
    }
    
    if (isFetchingTransactionsRef.current) return;

    isFetchingTransactionsRef.current = true;

    try {
      const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
      const q = query(transactionsRef, orderBy("date", "desc"), limit(200));
      
      const snap = await getDocs(q);

      const fetchedTransactions = snap.docs.map((d) => {
        const rawData = d.data();
        return {
          id: d.id,
          ...rawData,
          date: rawData.date?.toDate() || new Date(),
          warrantyStartDate: rawData.warrantyStartDate?.toDate?.() || rawData.warrantyStartDate,
          warrantyEndDate: rawData.warrantyEndDate?.toDate?.() || rawData.warrantyEndDate
        };
      }) as Transaction[];

      setTransactions(fetchedTransactions);
      hasFetchedTransactionsRef.current = true;
      lastTransactionsFetchRef.current = now;
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      isFetchingTransactionsRef.current = false;
    }
  }, [user]);

  // ================= REAL-TIME LISTENERS =================
  useEffect(() => {
    if (!user || listenersSetupRef.current) return;
    
    listenersSetupRef.current = true;
    
    const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
    const productsQuery = query(productsRef, orderBy("createdAt", "desc"), limit(100));
    
    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      const fetchedProducts = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as Product[];

      setProducts(fetchedProducts);
      hasFetchedProductsRef.current = true;
      lastProductsFetchRef.current = Date.now();
    }, (error) => {
      console.error("Error in products listener:", error);
    });

    const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
    const transactionsQuery = query(transactionsRef, orderBy("date", "desc"), limit(200));
    
    const unsubTransactions = onSnapshot(transactionsQuery, (snap) => {
      const fetchedTransactions = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate() || new Date(),
        warrantyStartDate: d.data().warrantyStartDate?.toDate?.() || d.data().warrantyStartDate,
        warrantyEndDate: d.data().warrantyEndDate?.toDate?.() || d.data().warrantyEndDate
      })) as Transaction[];

      setTransactions(fetchedTransactions);
      hasFetchedTransactionsRef.current = true;
      lastTransactionsFetchRef.current = Date.now();
    }, (error) => {
      console.error("Error in transactions listener:", error);
    });

    return () => {
      unsubProducts();
      unsubTransactions();
      listenersSetupRef.current = false;
    };
  }, [user]);

  // ================= STAFF USERS REAL-TIME LISTENER =================
  useEffect(() => {
    if (!user || userRole !== "admin") return;
    
    const usersRef = collection(db, "users");
    const usersQuery = query(usersRef, orderBy("createdAt", "desc"), limit(50));
    
    const unsubscribe = onSnapshot(usersQuery, (snap) => {
      const fetchedUsers = snap.docs.map((d) => {
        const data = d.data();
        const lastLoginTimestamp = data.lastLoginAt?.toDate() || null;
        const createdAt = data.createdAt?.toDate?.() || new Date(0);
        const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const isLegacy = data.isLegacyAccount === true;
        
        let displayStatus = data.status;
        const isNewAccount = !isLegacy && data.emailVerified === false && daysSinceCreation < 30;
        
        if (isNewAccount && displayStatus !== "Inactive" && displayStatus !== "Deleted") {
          displayStatus = "PendingVerification";
        } else if (!isNewAccount && displayStatus === "PendingVerification") {
          displayStatus = "Active";
        }
        
        return {
          uid: d.id,
          ...data,
          status: displayStatus,
          lastLogin: lastLoginTimestamp ? formatLastLogin(lastLoginTimestamp) : (data.lastLogin || "Never"),
          lastLoginTimestamp: lastLoginTimestamp,
          emailVerified: isNewAccount ? false : true
        };
      }) as StaffUser[];

      setStaffUsers(fetchedUsers);
      hasFetchedUsersRef.current = true;
      lastUsersFetchRef.current = Date.now();
    }, (error) => {
      console.error("Error in users listener:", error);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Initial data fetch
  useEffect(() => {
    if (user && !hasFetchedProductsRef.current && !isFetchingProductsRef.current) {
      fetchProducts(false);
    }
  }, [user, fetchProducts]);

  useEffect(() => {
    if (user && !hasFetchedTransactionsRef.current && !isFetchingTransactionsRef.current) {
      fetchTransactions(false);
    }
  }, [user, fetchTransactions]);

  useEffect(() => {
    if (user && userRole === "admin" && !initialStaffFetchDoneRef.current) {
      initialStaffFetchDoneRef.current = true;
      const timer = setTimeout(() => {
        fetchStaffUsers(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, userRole, fetchStaffUsers]);

  // ================= AUTH ACTIONS =================

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
      console.log('🔐 User logged in:', loggedInUser.email);
      
      const userRef = doc(db, "users", loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        if (userData.status === "Inactive") {
          await signOut(auth);
          throw new Error("This account has been deactivated. Please contact an administrator.");
        }
        if (userData.status === "Deleted") {
          await signOut(auth);
          throw new Error("This account has been deleted. Please contact an administrator.");
        }
        
        if (userData.emailVerified === false && loggedInUser.emailVerified === true) {
          await setDoc(userRef, { 
            emailVerified: true, 
            status: "Active",
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          setAppUser(prev => prev ? {
            ...prev,
            emailVerified: true,
            status: "Active"
          } : prev);
        }
        
        const isLegacy = userData.isLegacyAccount === true;
        const createdAt = userData.createdAt?.toDate?.() || new Date(0);
        const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        const requiresVerification = !isLegacy && 
                                      userData.emailVerified === false && 
                                      loggedInUser.emailVerified === false && 
                                      daysSinceCreation < 30;
        
        if (requiresVerification) {
          await signOut(auth);
          throw new Error("EMAIL_VERIFICATION_REQUIRED");
        }
        
      } else {
        await setDoc(userRef, {
          email: loggedInUser.email || email,
          name: loggedInUser.displayName || email.split('@')[0],
          role: "staff",
          status: "Active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLogin: "Never",
          lastLoginAt: null,
          emailVerified: loggedInUser.emailVerified || true,
          isLegacyAccount: true
        });
      }
      
      const now = new Date();
      const formattedLastLogin = formatLastLogin(now);
      
      await setDoc(userRef, {
        lastLogin: formattedLastLogin,
        lastLoginAt: Timestamp.fromDate(now),
        lastActive: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      }, { merge: true });
      
      hasFetchedProductsRef.current = false;
      hasFetchedTransactionsRef.current = false;
      hasFetchedUsersRef.current = false;
      lastProductsFetchRef.current = 0;
      lastTransactionsFetchRef.current = 0;
      lastUsersFetchRef.current = 0;
      listenersSetupRef.current = false;
      initialStaffFetchDoneRef.current = false;
      
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log("🔐 Starting logout process...");
      
      const currentUserId = userId;
      const currentUserName = userName;
      const currentUserEmail = userEmail;
      const currentAppUser = appUser;
      
      let sessionDuration: number | undefined;
      if (sessionStartTimeRef.current) {
        sessionDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        console.log(`📊 Session duration: ${sessionDuration} seconds (${Math.floor(sessionDuration / 60)} minutes)`);
      }
      
      let logoutRecorded = false;
      try {
        if (currentUserId && currentUserName) {
          const logoutId = await logLogout(currentUserName, currentUserId, currentUserEmail, sessionDuration);
          logoutRecorded = !!logoutId;
          console.log(`📝 Logout ${logoutRecorded ? 'recorded' : 'failed to record'} with ID: ${logoutId || 'N/A'}`);
        } else if (currentAppUser) {
          const logoutId = await logLogout(currentAppUser.name || "User", currentAppUser.uid, currentAppUser.email, sessionDuration);
          logoutRecorded = !!logoutId;
          console.log(`📝 Logout recorded via appUser: ${logoutRecorded}`);
        } else {
          console.log("⚠️ No user info available for logout logging");
          const logoutId = await logLogout("Unknown User", "unknown", null, sessionDuration);
          logoutRecorded = !!logoutId;
        }
      } catch (logError) {
        console.error("Failed to record logout:", logError);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await signOut(auth);
      console.log("🔐 Signed out from Firebase Auth");
      
      setProducts([]);
      setTransactions([]);
      setStaffUsers([]);
      setUserRole(null);
      setUserName("");
      setUserId("");
      setUserEmail("");
      setAppUser(null);
      setUser(null);
      
      hasFetchedProductsRef.current = false;
      hasFetchedTransactionsRef.current = false;
      hasFetchedUsersRef.current = false;
      isFetchingProductsRef.current = false;
      isFetchingTransactionsRef.current = false;
      isFetchingUsersRef.current = false;
      lastProductsFetchRef.current = 0;
      lastTransactionsFetchRef.current = 0;
      lastUsersFetchRef.current = 0;
      listenersSetupRef.current = false;
      initialStaffFetchDoneRef.current = false;
      sessionStartTimeRef.current = null;
      
      pendingUserPasswords.current.clear();
      
      console.log("✅ Logout successful, state cleared");
    } catch (error) {
      console.error("❌ Logout error:", error);
      throw error;
    }
  };

  // ================= PRODUCT ACTIONS =================

  const addProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const beginningInventory = data.stock || 0;
      
      const docRef = await addDoc(
        collection(db, `clinics/${CLINIC_ID}/products`),
        {
          ...data,
          beginningInventory: beginningInventory,
          totalSold: 0,
          damageExchanged: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      const newProduct: Product = { 
        ...data, 
        id: docRef.id,
        beginningInventory: beginningInventory,
        totalSold: 0,
        damageExchanged: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      setProducts((prev) => [newProduct, ...prev]);
      
      // Log product addition
      await logProductAddition(
        docRef.id,
        data.name,
        data.sku,
        data.category,
        data.markupPrice,
        userName || 'System',
        userId || 'system'
      );
      
      return docRef.id;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      // Get the current product state before update
      const currentProduct = products.find(p => p.id === id);
      
      const { beginningInventory, ...safeUpdates } = updates as any;
      
      await updateDoc(
        doc(db, `clinics/${CLINIC_ID}/products`, id),
        {
          ...safeUpdates,
          updatedAt: serverTimestamp()
        }
      );

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...safeUpdates } : p))
      );
      
      // Log product edits by comparing changes
      if (currentProduct) {
        const updatedProduct = { ...currentProduct, ...safeUpdates };
        const changes = getChangedFields(currentProduct, updatedProduct);
        
        if (changes.length > 0) {
          await logProductEdit(
            id,
            currentProduct.name,
            changes,
            userName || 'System',
            userId || 'system'
          );
        }
      }
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  };

  const archiveProduct = async (id: string, archived: boolean, reason?: string, markDeleted = false) => {
    try {
      const productDoc = await getDoc(doc(db, `clinics/${CLINIC_ID}/products`, id));
      const productName = productDoc.exists() ? productDoc.data().name : 'Unknown Product';
      
      const productRef = doc(db, `clinics/${CLINIC_ID}/products`, id);
      await updateDoc(productRef, {
        archived,
        deleted: archived ? markDeleted : false,
        updatedAt: serverTimestamp()
      });

      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, archived, deleted: archived ? markDeleted : false } : p)));

      await logProductArchive(id, productName, archived, userName || 'System', userId || 'system', reason);

      try {
        const archiveLogsRef = collection(db, `clinics/${CLINIC_ID}/archiveLogs`);
        await addDoc(archiveLogsRef, {
          productId: id,
          action: archived ? 'archive' : 'unarchive',
          staffId: userId || null,
          staffName: userName || null,
          reason: reason || null,
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        console.error('Failed to write archive log:', logErr);
      }
    } catch (error) {
      console.error('Error archiving/unarchiving product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const productDoc = await getDoc(doc(db, `clinics/${CLINIC_ID}/products`, id));
      const productName = productDoc.exists() ? productDoc.data().name : 'Unknown Product';
      
      await deleteDoc(doc(db, `clinics/${CLINIC_ID}/products`, id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      
      await logProductDeletion(id, productName, userName || 'System', userId || 'system');
      
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  };

  const adjustStock = async (id: string, newStock: number, reason: string, staffName?: string, staffId?: string) => {
    try {
      const productDoc = await getDoc(doc(db, `clinics/${CLINIC_ID}/products`, id));
      if (!productDoc.exists()) {
        throw new Error("Product not found");
      }

      const currentProduct = productDoc.data() as any;
      const oldStock = currentProduct.stock || 0;
      const stockDifference = newStock - oldStock;

      const actingStaffName = staffName || userName || "System";
      const actingStaffId = staffId || userId || "system";
      
      const reasonLower = reason?.toLowerCase() || '';
      const isScanIn = reasonLower.includes('received via qr scan') || 
                       reasonLower.includes('scanned in') ||
                       (reasonLower.includes('qr scan') && newStock > oldStock);
      const isScanOut = reasonLower.includes('dispatched via qr scan') || 
                        reasonLower.includes('scanned out') ||
                        (reasonLower.includes('qr scan') && newStock < oldStock);

      let appliedUpdateData: any = null;

      if (oldStock !== newStock) {
        const updateData: any = {
          stock: newStock,
          updatedAt: serverTimestamp()
        };

        const isDamageOrExchange = reasonLower.includes('damage') || 
                                    reasonLower.includes('damaged') ||
                                    reasonLower.includes('exchange') ||
                                    reasonLower.includes('return') ||
                                    isScanOut;

        const isRestock = !isDamageOrExchange && stockDifference > 0 && 
                         (reasonLower.includes('restock') ||
                          reasonLower.includes('received'));

        if (isDamageOrExchange && stockDifference < 0) {
          const itemsRemoved = Math.abs(stockDifference);
          const currentDamageExchanged = currentProduct.damageExchanged || 0;
          updateData.damageExchanged = currentDamageExchanged + itemsRemoved;
          console.log(`📝 Damage/Exchange recorded: +${itemsRemoved} units (total: ${currentDamageExchanged + itemsRemoved})`);
        }

        if (isRestock) {
          const unitsAdded = stockDifference;
          const currentRestockCount = currentProduct.restockCount || 0;
          updateData.restockCount = currentRestockCount + unitsAdded;
          console.log(`📦 Restock recorded: +${unitsAdded} units added (total: ${currentRestockCount + unitsAdded})`);
        }

        await updateDoc(doc(db, `clinics/${CLINIC_ID}/products`, id), updateData);
        appliedUpdateData = updateData;

        if (isScanIn || isScanOut) {
          const productName = currentProduct.name || 'Unknown Product';
          await logScanActivity(
            id,
            productName,
            oldStock,
            newStock,
            isScanIn ? 'in' : 'out',
            actingStaffName,
            actingStaffId
          );
          console.log(`📷 ${isScanIn ? 'Scan In' : 'Scan Out'} logged to activityLogs for ${productName}`);
        } else {
          try {
            const productName = currentProduct.name || null;
            await logStockAdjustment(id, oldStock, newStock, reason, actingStaffId, actingStaffName, productName || undefined);
            console.log(`📝 Manual adjustment logged to stockAdjustments: ${currentProduct.name || id}`);
          } catch (logErr) {
            console.error("Failed to log stock adjustment:", logErr);
          }
        }

        console.log(`📊 Stock adjusted by ${actingStaffName}: ${currentProduct.name || id} from ${oldStock} to ${newStock}. Reason: ${reason}`);
      } else {
        console.log(`📊 Stock adjustment skipped - no change for ${currentProduct.name || id} (${oldStock} → ${newStock})`);
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                stock: newStock,
                damageExchanged: (appliedUpdateData && appliedUpdateData.damageExchanged) ?? p.damageExchanged,
                restockCount: (appliedUpdateData && appliedUpdateData.restockCount) ?? p.restockCount,
              }
            : p
        )
      );
    } catch (error) {
      console.error("Error adjusting stock:", error);
      throw error;
    }
  };

  // ================= TRANSACTION ACTIONS =================

  const addTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(
        collection(db, `clinics/${CLINIC_ID}/transactions`),
        {
          ...data,
          createdAt: serverTimestamp()
        }
      );

      const newTransaction: Transaction = { 
        ...data, 
        id: docRef.id,
        createdAt: Timestamp.now()
      };
      setTransactions((prev) => [newTransaction, ...prev]);
      
      await logSaleCompleted(
        docRef.id,
        data.staffName || 'Staff',
        data.patientName || 'Walk-in Patient',
        data.total,
        data.items
      );
      
      return docRef.id;
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  };

  const processReplacement = async (id: string, reason: string, processedBy: string) => {
    try {
      const transactionRef = doc(db, `clinics/${CLINIC_ID}/transactions`, id);
      const transactionSnap = await getDoc(transactionRef);
      
      if (!transactionSnap.exists()) {
        throw new Error("Transaction not found");
      }
      
      const transactionData = transactionSnap.data();
      
      if (transactionData.status !== "completed" && transactionData.status !== "replaced") {
        throw new Error("Only completed or previously replaced transactions can be processed for replacement");
      }
      
      await updateDoc(transactionRef, {
        status: "processing_replacement",
        replacementReason: reason,
        processedAt: new Date(),
        processedBy: processedBy,
        updatedAt: serverTimestamp()
      });
      
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id 
            ? { 
                ...t, 
                status: "processing_replacement",
                replacementReason: reason,
                processedAt: new Date(),
                processedBy: processedBy
              } 
            : t
        )
      );
      
      await logReplacementInitiated(
        id,
        reason,
        processedBy,
        transactionData.patientName || 'Walk-in Patient',
        transactionData.total || 0,
        transactionData.items || []
      );
      
    } catch (error) {
      console.error("Error processing replacement:", error);
      throw error;
    }
  };

  const markReplacementAsCompleted = async (id: string, replacedBy: string) => {
    try {
      const transactionRef = doc(db, `clinics/${CLINIC_ID}/transactions`, id);
      const transactionSnap = await getDoc(transactionRef);
      
      if (!transactionSnap.exists()) {
        throw new Error("Transaction not found");
      }
      
      const transactionData = transactionSnap.data();
      
      if (transactionData.status !== "processing_replacement") {
        throw new Error("Only transactions in 'Processing Replacement' status can be marked as replaced");
      }
      
      await updateDoc(transactionRef, {
        status: "replaced",
        replacedAt: new Date(),
        replacedBy: replacedBy,
        updatedAt: serverTimestamp()
      });
      
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id 
            ? { 
                ...t, 
                status: "replaced",
                replacedAt: new Date(),
                replacedBy: replacedBy
              } 
            : t
        )
      );
      
      await logReplacementCompleted(
        id,
        replacedBy,
        transactionData.patientName || 'Walk-in Patient',
        transactionData.total || 0,
        transactionData.items || []
      );
      
    } catch (error) {
      console.error("Error completing replacement:", error);
      throw error;
    }
  };

  // ================= STAFF ACTIONS =================

  const createStaffUser = async (email: string, password: string, name: string, role: "admin" | "staff") => {
    try {
      const secondaryAuth = getSecondaryAuth();
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;
      
      pendingUserPasswords.current.set(email, password);
      
      await sendEmailVerification(newUser);
      console.log("✅ Verification email sent to:", email);
      
      await signOut(secondaryAuth);
      
      await setDoc(doc(db, "users", newUser.uid), {
        email,
        name,
        role,
        status: "PendingVerification",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: "Never",
        lastLoginAt: null,
        emailVerified: false,
        isLegacyAccount: false
      });
      
      await updateProfile(newUser, { displayName: name });
      
      return newUser.uid;
    } catch (error) {
      console.error("Error creating staff user:", error);
      throw error;
    }
  };

  const updateStaffUser = async (uid: string, data: Partial<StaffUser>) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      setStaffUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, ...data } : u))
      );
    } catch (error) {
      console.error("Error updating staff user:", error);
      throw error;
    }
  };

  const deleteStaffUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        status: "Deleted",
        updatedAt: serverTimestamp()
      });
      
      setStaffUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: "Deleted" } : u))
      );
    } catch (error) {
      console.error("Error deleting staff user:", error);
      throw error;
    }
  };

  const deactivateStaffUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        status: "Inactive",
        updatedAt: serverTimestamp()
      });
      
      setStaffUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: "Inactive" } : u))
      );
    } catch (error) {
      console.error("Error deactivating staff user:", error);
      throw error;
    }
  };

  const reactivateStaffUser = async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      const isLegacy = userData?.isLegacyAccount === true;
      const newStatus = (!isLegacy && userData?.emailVerified === false) ? "PendingVerification" : "Active";
      
      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      setStaffUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: newStatus } : u))
      );
    } catch (error) {
      console.error("Error reactivating staff user:", error);
      throw error;
    }
  };

  const resetStaffPassword = async (email: string) => {
    try {
      const secondaryAuth = getSecondaryAuth();
      await sendPasswordResetEmail(secondaryAuth, email);
    } catch (error) {
      console.error("Error resetting password:", error);
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string, providedPassword?: string) => {
    try {
      const secondaryAuth = getSecondaryAuth();
      const password = providedPassword || pendingUserPasswords.current.get(email);
      
      if (!password) {
        throw new Error("Cannot resend verification email. Please contact support or create a new account.");
      }
      
      const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, password);
      const user = userCredential.user;
      
      await sendEmailVerification(user);
      console.log("✅ Verification email resent to:", email);
      
      await signOut(secondaryAuth);
      
    } catch (error: any) {
      console.error("Error resending verification email:", error);
      
      if (error.code === 'auth/email-already-verified' || error.message?.includes('verified')) {
        const userToUpdate = staffUsers.find(u => u.email === email);
        if (userToUpdate) {
          await updateDoc(doc(db, "users", userToUpdate.uid), {
            emailVerified: true,
            status: "Active",
            updatedAt: serverTimestamp()
          });
        }
        throw new Error("Email already verified. Status has been updated to Active.");
      }
      
      throw error;
    }
  };

  // ================= ANALYTICS =================

  const getLowStockProducts = () =>
    products.filter((p) => p.stock <= p.reorderPoint && p.stock > 0);

  const getDeadstockProducts = () =>
    products.filter((p) => p.lastMovedDaysAgo >= 30 && p.stock > 0);

  // ================= VALUE =================

  const value: FirebaseContextType = {
    user,
    appUser,
    loading,
    login,
    logout,

    products,
    addProduct,
    updateProduct,
    deleteProduct,
    archiveProduct,
    adjustStock,

    transactions,
    addTransaction,
    processReplacement,
    markReplacementAsCompleted,

    staffUsers,
    fetchStaffUsers: async (forceRefresh = false) => {
      await fetchStaffUsers(forceRefresh);
    },

    createStaffUser,
    updateStaffUser,
    deleteStaffUser,
    deactivateStaffUser,
    reactivateStaffUser,
    resetStaffPassword,
    resendVerificationEmail,

    getLowStockProducts,
    getDeadstockProducts,

    userRole,
    userName,
    userId,
    userEmail,

    isOnline
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const ctx = useContext(FirebaseContext);
  if (!ctx) throw new Error("Must be used inside provider");
  return ctx;
};

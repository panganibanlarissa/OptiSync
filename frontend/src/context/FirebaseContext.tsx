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
  onSnapshot
} from "firebase/firestore";

import { app as firebaseApp, auth, db } from "@/lib/firebase";
import { initializeApp, getApps } from "firebase/app";

// 🔥 CONFIG
const CLINIC_ID =
  process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

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
  lastMovedDaysAgo: number;
  imageColor: string;
  image: string | null;
  leadTimeDays: number;
  reorderPoint: number;
  expiryDate?: string | null;
  batchNumber?: string;
  manufacturingDate?: Date;
  totalSold?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Transaction {
  id: string;
  total: number;
  date: Date;
  status: "completed" | "voided";
  items: any[];
  createdAt?: Timestamp;
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

  transactions: Transaction[];
  addTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<string>;
  voidTransaction: (id: string) => Promise<void>;

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

// Helper function to create or update user document - ONLY for existing accounts
const ensureUserDocument = async (uid: string, email: string | null, name?: string) => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    // This is an EXISTING account without a Firestore document (legacy)
    // Mark as Active and verified since it's an existing account
    await setDoc(userRef, {
      email: email || "",
      name: name || email?.split('@')[0] || "User",
      role: "staff",
      status: "Active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: "Never",
      lastLoginAt: null,
      emailVerified: true, // Existing accounts are considered verified
      isLegacyAccount: true // Flag to identify legacy accounts
    });
    console.log("Created user document for existing account:", uid);
  }
  
  return userRef;
};

// Helper function to log logout events
const logLogout = async (staffName: string, staffId: string, userEmail: string | null, sessionDuration?: number) => {
  try {
    const logoutRef = collection(db, `clinics/${CLINIC_ID}/logout_logs`);
    await addDoc(logoutRef, {
      staffName: staffName || 'User',
      staffId: staffId || 'unknown',
      timestamp: serverTimestamp(),
      sessionDuration: sessionDuration || null,
      email: userEmail || null
    });
    console.log("Logout event logged successfully");
  } catch (error) {
    console.error("Error logging logout:", error);
  }
};

// Helper function to log stock adjustments with proper staff info
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
    console.log(`Stock adjustment logged: ${staffName} changed stock from ${oldStock} to ${newStock}. Reason: ${reason}`);
  } catch (error) {
    console.error("Error logging stock adjustment:", error);
  }
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

  // Cache flags to prevent excessive reads
  const hasFetchedProductsRef = useRef(false);
  const hasFetchedTransactionsRef = useRef(false);
  const hasFetchedUsersRef = useRef(false);
  
  const isFetchingProductsRef = useRef(false);
  const isFetchingTransactionsRef = useRef(false);
  const isFetchingUsersRef = useRef(false);
  
  const lastProductsFetchRef = useRef<number>(0);
  const lastTransactionsFetchRef = useRef<number>(0);
  const lastUsersFetchRef = useRef<number>(0);
  
  // Cache TTL: 10 minutes
  const CACHE_TTL = 10 * 60 * 1000;

  // Store session start time for logout duration calculation
  const sessionStartTimeRef = useRef<number | null>(null);

  // Store temporary passwords for resend verification (in memory only)
  const pendingUserPasswords = useRef<Map<string, string>>(new Map());

  // Track if listeners are already set up
  const listenersSetupRef = useRef(false);
  
  // Track if initial staff users fetch has been done
  const initialStaffFetchDoneRef = useRef(false);

  // ================= AUTH =================

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        setUserId(u.uid);
        setUserEmail(u.email || "");
        
        // Record session start time when user logs in
        sessionStartTimeRef.current = Date.now();

        // Only ensure document exists, don't modify existing data
        await ensureUserDocument(u.uid, u.email);
        
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          const isLegacy = data.isLegacyAccount === true;
          
          // Determine if email verification is required
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
    // Don't fetch if not admin
    if (userRole !== "admin") {
      return;
    }
    
    const now = Date.now();
    
    // Check cache - don't fetch if we have data and it's fresh (unless forced)
    if (!forceRefresh && hasFetchedUsersRef.current && (now - lastUsersFetchRef.current) < CACHE_TTL) {
      return;
    }
    
    // Prevent concurrent fetches
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
          date: rawData.date?.toDate() || new Date()
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

  // ================= SINGLE REAL-TIME LISTENER FOR ALL DATA =================
  useEffect(() => {
    if (!user || listenersSetupRef.current) return;
    
    listenersSetupRef.current = true;
    
    // Products listener
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

    // Transactions listener
    const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
    const transactionsQuery = query(transactionsRef, orderBy("date", "desc"), limit(200));
    
    const unsubTransactions = onSnapshot(transactionsQuery, (snap) => {
      const fetchedTransactions = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate() || new Date()
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

  // Initial data fetch on login - only once
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

  // Fetch staff users only once on admin login
  useEffect(() => {
    if (user && userRole === "admin" && !initialStaffFetchDoneRef.current) {
      initialStaffFetchDoneRef.current = true;
      // Small delay to avoid race conditions
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
      console.log('🔐 Firebase Auth emailVerified:', loggedInUser.emailVerified);
      
      const userRef = doc(db, "users", loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        console.log('🔐 Firestore user data:', {
          status: userData.status,
          emailVerified: userData.emailVerified,
          isLegacyAccount: userData.isLegacyAccount
        });
        
        // Check if account is deactivated or deleted
        if (userData.status === "Inactive") {
          await signOut(auth);
          throw new Error("This account has been deactivated. Please contact an administrator.");
        }
        if (userData.status === "Deleted") {
          await signOut(auth);
          throw new Error("This account has been deleted. Please contact an administrator.");
        }
        
        // CRITICAL FIX: Update Firestore if email is verified in Firebase Auth but not in Firestore
        if (userData.emailVerified === false && loggedInUser.emailVerified === true) {
          console.log('🔐 Updating Firestore: email verified!');
          await setDoc(userRef, { 
            emailVerified: true, 
            status: "Active",
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          // Also update local appUser state
          setAppUser(prev => prev ? {
            ...prev,
            emailVerified: true,
            status: "Active"
          } : prev);
        }
        
        // Check if this is a NEW account that requires verification
        const isLegacy = userData.isLegacyAccount === true;
        const createdAt = userData.createdAt?.toDate?.() || new Date(0);
        const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        // Only block if it's a new account (not legacy) AND email is NOT verified in Firebase Auth
        const requiresVerification = !isLegacy && 
                                      userData.emailVerified === false && 
                                      loggedInUser.emailVerified === false && 
                                      daysSinceCreation < 30;
        
        if (requiresVerification) {
          console.log('🔐 Email verification required, logging out');
          await signOut(auth);
          throw new Error("EMAIL_VERIFICATION_REQUIRED");
        }
        
      } else {
        // User document doesn't exist - this is a legacy account, create it
        console.log('🔐 Creating user document for legacy account');
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
      
      // Update last login timestamp
      const now = new Date();
      const formattedLastLogin = formatLastLogin(now);
      
      await setDoc(userRef, {
        lastLogin: formattedLastLogin,
        lastLoginAt: Timestamp.fromDate(now),
        lastActive: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      }, { merge: true });
      
      // Reset flags for fresh data on next navigation
      hasFetchedProductsRef.current = false;
      hasFetchedTransactionsRef.current = false;
      hasFetchedUsersRef.current = false;
      lastProductsFetchRef.current = 0;
      lastTransactionsFetchRef.current = 0;
      lastUsersFetchRef.current = 0;
      listenersSetupRef.current = false;
      initialStaffFetchDoneRef.current = false;
      
      console.log('🔐 Login successful, user will be redirected');
      
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Log the logout event before signing out
      const currentUserId = userId;
      const currentUserName = userName;
      const currentUserEmail = userEmail;
      
      // Calculate session duration if we have a start time
      let sessionDuration: number | undefined;
      if (sessionStartTimeRef.current) {
        sessionDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
      }
      
      // Log logout asynchronously
      if (currentUserId && currentUserName) {
        logLogout(currentUserName, currentUserId, currentUserEmail, sessionDuration).catch(err => {
          console.error("Background logout logging failed:", err);
        });
      }
      
      // Sign out from Firebase Auth
      await signOut(auth);
      
      // Clear all state
      setProducts([]);
      setTransactions([]);
      setStaffUsers([]);
      setUserRole(null);
      setUserName("");
      setUserId("");
      setUserEmail("");
      setAppUser(null);
      setUser(null);
      
      // Reset refs
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
      
      // Clear temporary passwords
      pendingUserPasswords.current.clear();
      
      console.log("Logout successful");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  // ================= PRODUCT =================

  const addProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(
        collection(db, `clinics/${CLINIC_ID}/products`),
        {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      const newProduct: Product = { 
        ...data, 
        id: docRef.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      setProducts((prev) => [newProduct, ...prev]);
      
      return docRef.id;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      await updateDoc(
        doc(db, `clinics/${CLINIC_ID}/products`, id),
        {
          ...updates,
          updatedAt: serverTimestamp()
        }
      );

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, `clinics/${CLINIC_ID}/products`, id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  };

  const adjustStock = async (id: string, newStock: number, reason: string, staffName?: string, staffId?: string) => {
    try {
      // Get current product to know old stock value and product name
      const productRef = doc(db, `clinics/${CLINIC_ID}/products`, id);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        throw new Error("Product not found");
      }
      
      const productData = productSnap.data();
      const oldStock = productData.stock || 0;
      const productName = productData.name || "Unknown Product";
      
      // Use provided staff info or fallback to current user
      const actingStaffName = staffName || userName || "System";
      const actingStaffId = staffId || userId || "system";
      
      // ONLY update stock if it's actually changing (prevents duplicate entries)
      if (oldStock !== newStock) {
        await updateDoc(productRef, {
          stock: newStock,
          updatedAt: serverTimestamp()
        });

        // Log stock adjustment with proper staff info
        await logStockAdjustment(id, oldStock, newStock, reason, actingStaffId, actingStaffName, productName);
        
        console.log(`Stock adjusted by ${actingStaffName} (${actingStaffId}): ${productName} from ${oldStock} to ${newStock}. Reason: ${reason}`);
      } else {
        console.log(`Stock adjustment skipped - no change for ${productName} (${oldStock} → ${newStock})`);
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, stock: newStock } : p
        )
      );
    } catch (error) {
      console.error("Error adjusting stock:", error);
      throw error;
    }
  };

  // ================= TRANSACTION =================

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
      
      return docRef.id;
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  };

  const voidTransaction = async (id: string) => {
    try {
      await updateDoc(
        doc(db, `clinics/${CLINIC_ID}/transactions`, id),
        {
          status: "voided",
          updatedAt: serverTimestamp()
        }
      );

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "voided" } : t
        )
      );
    } catch (error) {
      console.error("Error voiding transaction:", error);
      throw error;
    }
  };

  // ================= STAFF =================

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
      const updateData: any = { ...data };
      
      await updateDoc(doc(db, "users", uid), {
        ...updateData,
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
    adjustStock,

    transactions,
    addTransaction,
    voidTransaction,

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

// ================= HOOK =================

export const useFirebase = () => {
  const ctx = useContext(FirebaseContext);
  if (!ctx) throw new Error("Must be used inside provider");
  return ctx;
};
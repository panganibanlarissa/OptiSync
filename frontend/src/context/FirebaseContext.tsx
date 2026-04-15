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
  fetchSignInMethodsForEmail,
  initializeAuth,
  browserLocalPersistence,
  getAuth,
  updateProfile
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
  where,
  limit,
  startAfter,
  DocumentSnapshot
} from "firebase/firestore";

import { app as firebaseApp, auth, db } from "@/lib/firebase";
import { initializeApp, getApps } from "firebase/app";

// 🔥 CONFIG
const CLINIC_ID =
  process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

// 🔐 SECONDARY AUTH
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
  status: "Active" | "Inactive" | "Deleted";
  lastLogin: string;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: "admin" | "staff";
  name?: string;
  status?: string;
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
  adjustStock: (id: string, newStock: number, reason: string) => Promise<void>;

  transactions: Transaction[];
  addTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<string>;
  voidTransaction: (id: string) => Promise<void>;

  staffUsers: StaffUser[];
  fetchStaffUsers: () => Promise<void>;

  createStaffUser: (email: string, password: string, name: string, role: "admin" | "staff") => Promise<string>;
  updateStaffUser: (uid: string, data: Partial<StaffUser>) => Promise<void>;
  deleteStaffUser: (uid: string) => Promise<void>;
  deactivateStaffUser: (uid: string) => Promise<void>;
  reactivateStaffUser: (uid: string) => Promise<void>;
  resetStaffPassword: (email: string) => Promise<void>;

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

  // 🔥 CACHE FLAGS WITH TIMESTAMPS FOR QUOTA MANAGEMENT
  const [hasFetchedProducts, setHasFetchedProducts] = useState(false);
  const [hasFetchedTransactions, setHasFetchedTransactions] = useState(false);
  const [hasFetchedUsers, setHasFetchedUsers] = useState(false);
  
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  
  // Track last fetch times to prevent excessive reads (quota management)
  const lastProductsFetchRef = useRef<number>(0);
  const lastTransactionsFetchRef = useRef<number>(0);
  const lastUsersFetchRef = useRef<number>(0);
  
  // Cache invalidation time (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;

  // ================= AUTH =================

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        setUserId(u.uid);
        setUserEmail(u.email || "");

        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          setUserRole(data.role || "staff");
          setUserName(data.name || "Staff");

          setAppUser({
            uid: u.uid,
            email: u.email,
            role: data.role,
            name: data.name,
            status: data.status || "Active"
          });
        } else {
          setUserRole("staff");
          setUserName("Staff");
          setAppUser({
            uid: u.uid,
            email: u.email,
            role: "staff",
            name: "Staff"
          });
        }
      } else {
        setAppUser(null);
        setUserRole(null);
        setUserName("");
        setUserId("");
        setUserEmail("");
        setStaffUsers([]);
        setHasFetchedProducts(false);
        setHasFetchedTransactions(false);
        setHasFetchedUsers(false);
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

  // ================= FETCH PRODUCTS (OPTIMIZED) =================

  const fetchProducts = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    
    // Check cache TTL - don't fetch if we fetched recently and not forcing refresh
    if (!forceRefresh && hasFetchedProducts && (now - lastProductsFetchRef.current) < CACHE_TTL) {
      console.log("Using cached products data, last fetch:", new Date(lastProductsFetchRef.current).toLocaleTimeString());
      return;
    }
    
    if (isFetchingProducts) return;
    
    try {
      setIsFetchingProducts(true);
      
      console.log("Fetching products from Firestore...");
      const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
      const q = query(productsRef, orderBy("createdAt", "desc"), limit(50)); // Reduced from 100 to 50 for quota
      
      const snap = await getDocs(q);

      const fetchedProducts = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as Product[];

      setProducts(fetchedProducts);
      setHasFetchedProducts(true);
      lastProductsFetchRef.current = now;
      
      console.log(`Fetched ${fetchedProducts.length} products`);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsFetchingProducts(false);
    }
  }, [hasFetchedProducts, isFetchingProducts]);

  // ================= FETCH TRANSACTIONS (OPTIMIZED) =================

  const fetchTransactions = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    const now = Date.now();
    
    // Check cache TTL
    if (!forceRefresh && hasFetchedTransactions && (now - lastTransactionsFetchRef.current) < CACHE_TTL) {
      console.log("Using cached transactions data");
      return;
    }
    
    if (isFetchingTransactions) return;

    try {
      setIsFetchingTransactions(true);
      
      console.log("Fetching transactions from Firestore...");
      const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
      const q = query(transactionsRef, orderBy("date", "desc"), limit(50)); // Reduced to 50
      
      const snap = await getDocs(q);

      const fetchedTransactions = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate() || new Date()
      })) as Transaction[];

      setTransactions(fetchedTransactions);
      setHasFetchedTransactions(true);
      lastTransactionsFetchRef.current = now;
      
      console.log(`Fetched ${fetchedTransactions.length} transactions`);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsFetchingTransactions(false);
    }
  }, [user, hasFetchedTransactions, isFetchingTransactions]);

  // ================= FETCH STAFF USERS (OPTIMIZED) =================

  const fetchStaffUsers = useCallback(async (forceRefresh = false) => {
    if (!user || userRole !== "admin") {
      console.log("Skipping staff users fetch - not admin or not logged in");
      return;
    }
    
    const now = Date.now();
    
    // Check cache TTL - admin users can refresh more frequently if needed
    if (!forceRefresh && hasFetchedUsers && (now - lastUsersFetchRef.current) < CACHE_TTL) {
      console.log("Using cached staff users data");
      return;
    }
    
    if (isFetchingUsers) return;

    try {
      setIsFetchingUsers(true);
      
      console.log("Fetching staff users from Firestore...");
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("createdAt", "desc"), limit(50));
      
      const snap = await getDocs(q);

      const fetchedUsers = snap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
        lastLogin: d.data().lastLogin || "Never"
      })) as StaffUser[];

      setStaffUsers(fetchedUsers);
      setHasFetchedUsers(true);
      lastUsersFetchRef.current = now;
      
      console.log(`Fetched ${fetchedUsers.length} staff users`);
    } catch (error) {
      console.error("Error fetching staff users:", error);
    } finally {
      setIsFetchingUsers(false);
    }
  }, [user, userRole, hasFetchedUsers, isFetchingUsers]);

  // Initial data fetch on login (only once, not on every render)
  useEffect(() => {
    if (user) {
      // Use a small delay to prevent race conditions
      const timer = setTimeout(() => {
        fetchProducts(false);
        fetchTransactions(false);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, fetchProducts, fetchTransactions]);

  // Fetch staff users only when admin role is detected and after initial load
  useEffect(() => {
    if (user && userRole === "admin" && !hasFetchedUsers && !isFetchingUsers) {
      const timer = setTimeout(() => {
        fetchStaffUsers(false);
      }, 500); // Longer delay for staff users fetch
      
      return () => clearTimeout(timer);
    }
  }, [user, userRole, hasFetchedUsers, isFetchingUsers, fetchStaffUsers]);

  // ================= AUTH ACTIONS =================

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
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
      }
      
      const now = new Date();
      const formattedLastLogin = formatLastLogin(now);
      
      // Update lastLogin - don't await to avoid blocking
      updateDoc(userRef, {
        lastLogin: formattedLastLogin,
        lastLoginAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((error) => {
        console.warn("Could not update lastLogin:", error);
      });
      
      // Reset cache flags on successful login
      setHasFetchedProducts(false);
      setHasFetchedTransactions(false);
      setHasFetchedUsers(false);
      lastProductsFetchRef.current = 0;
      lastTransactionsFetchRef.current = 0;
      lastUsersFetchRef.current = 0;
      
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setProducts([]);
      setTransactions([]);
      setStaffUsers([]);
      setUserRole(null);
      setUserName("");
      setUserId("");
      setUserEmail("");
      setAppUser(null);
      setHasFetchedProducts(false);
      setHasFetchedTransactions(false);
      setHasFetchedUsers(false);
      setIsFetchingProducts(false);
      setIsFetchingTransactions(false);
      setIsFetchingUsers(false);
      lastProductsFetchRef.current = 0;
      lastTransactionsFetchRef.current = 0;
      lastUsersFetchRef.current = 0;
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

      const newProduct = { ...data, id: docRef.id };
      setProducts((prev) => [newProduct as Product, ...prev]);
      
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

  const adjustStock = async (id: string, newStock: number, reason: string) => {
    try {
      await updateDoc(
        doc(db, `clinics/${CLINIC_ID}/products`, id),
        {
          stock: newStock,
          updatedAt: serverTimestamp()
        }
      );

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

      const newTransaction = { ...data, id: docRef.id };
      setTransactions((prev) => [newTransaction as Transaction, ...prev]);
      
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
      
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        name,
        role,
        status: "Active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: "Never"
      });
      
      await updateProfile(userCredential.user, { displayName: name });
      
      // Invalidate cache to force refresh
      setHasFetchedUsers(false);
      lastUsersFetchRef.current = 0;
      await fetchStaffUsers(true);
      
      return userCredential.user.uid;
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
      await updateDoc(doc(db, "users", uid), {
        status: "Active",
        updatedAt: serverTimestamp()
      });
      
      setStaffUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: "Active" } : u))
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
    fetchStaffUsers: () => fetchStaffUsers(true),

    createStaffUser,
    updateStaffUser,
    deleteStaffUser,
    deactivateStaffUser,
    reactivateStaffUser,
    resetStaffPassword,

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
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode
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
  limit
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
  addProduct: any;
  updateProduct: any;
  deleteProduct: any;
  adjustStock: any;

  transactions: Transaction[];
  addTransaction: any;
  voidTransaction: any;

  staffUsers: StaffUser[];
  fetchStaffUsers: () => Promise<void>;

  createStaffUser: any;
  updateStaffUser: any;
  deleteStaffUser: any;
  deactivateStaffUser: any;
  reactivateStaffUser: any;
  resetStaffPassword: any;

  getLowStockProducts: () => Product[];
  getDeadstockProducts: () => Product[];

  userRole: any;
  userName: string;
  userId: string;
  userEmail: string;

  isOnline: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined
);

// ================= PROVIDER =================

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  const [userRole, setUserRole] = useState<any>(null);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [isOnline, setIsOnline] = useState(true);

  // 🔥 CACHE FLAGS
  const [hasFetchedProducts, setHasFetchedProducts] = useState(false);
  const [hasFetchedTransactions, setHasFetchedTransactions] =
    useState(false);
  const [hasFetchedUsers, setHasFetchedUsers] = useState(false);

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
            name: data.name
          });
        }
      } else {
        setAppUser(null);
        setUserRole(null);
        setUserName("");
        setUserId("");
        setUserEmail("");
        setStaffUsers([]);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ================= NETWORK =================

  useEffect(() => {
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, []);

  // ================= FETCH =================

  const fetchProducts = useCallback(async () => {
    if (hasFetchedProducts) return;

    const q = query(
      collection(db, `clinics/${CLINIC_ID}/products`),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    setProducts(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as Product[]
    );

    setHasFetchedProducts(true);
  }, [hasFetchedProducts]);

  const fetchTransactions = useCallback(async () => {
    if (!user || hasFetchedTransactions) return;

    const q = query(
      collection(db, `clinics/${CLINIC_ID}/transactions`),
      orderBy("date", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    setTransactions(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate()
      })) as Transaction[]
    );

    setHasFetchedTransactions(true);
  }, [user, hasFetchedTransactions]);

  const fetchStaffUsers = useCallback(async () => {
    if (!user || hasFetchedUsers) return;

    const q = query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    setStaffUsers(
      snap.docs.map((d) => ({
        uid: d.id,
        ...d.data()
      })) as StaffUser[]
    );

    setHasFetchedUsers(true);
  }, [user, hasFetchedUsers]);

  useEffect(() => {
    fetchProducts();
    if (user) fetchTransactions();
  }, [user]);

  useEffect(() => {
    if (userRole === "admin") fetchStaffUsers();
  }, [userRole]);

  // ================= AUTH ACTIONS =================

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // ================= PRODUCT =================

  const addProduct = async (data: Product) => {
    const ref = await addDoc(
      collection(db, `clinics/${CLINIC_ID}/products`),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    setProducts((prev) => [{ ...data, id: ref.id }, ...prev]);
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
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
  };

  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, `clinics/${CLINIC_ID}/products`, id));

    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const adjustStock = async (
    id: string,
    newStock: number,
    reason: string
  ) => {
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
  };

  // ================= TRANSACTION =================

  const addTransaction = async (data: Transaction) => {
    const ref = await addDoc(
      collection(db, `clinics/${CLINIC_ID}/transactions`),
      {
        ...data,
        createdAt: serverTimestamp()
      }
    );

    setTransactions((prev) => [{ ...data, id: ref.id }, ...prev]);
  };

  const voidTransaction = async (id: string) => {
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
  };

  // ================= STAFF =================

  const createStaffUser = async () => {};
  const updateStaffUser = async () => {};
  const deleteStaffUser = async () => {};
  const deactivateStaffUser = async () => {};
  const reactivateStaffUser = async () => {};
  const resetStaffPassword = async () => {};

  // ================= ANALYTICS =================

  const getLowStockProducts = () =>
    products.filter((p) => p.stock <= p.reorderPoint);

  const getDeadstockProducts = () =>
    products.filter((p) => p.lastMovedDaysAgo >= 30);

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
    fetchStaffUsers,

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
// src/context/FirebaseContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  deleteUser
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
  setDoc
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// --- Use the clinic ID from environment or default ---
const CLINIC_ID = process.env.NEXT_PUBLIC_CLINIC_ID || "rlDgfGc4fZYrriUVdGnYI6Zhj3a2";

// Types
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  imageColor: string;
}

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
  patientName: string;
  items: CartItem[];
  total: number;
  date: Date;
  status: "completed" | "voided";
  synced: boolean;
  staffName?: string;
  staffId?: string;
  staffEmail?: string;
  scanType?: 'manual' | 'qr_scan';
  performedBy?: string;
  metadata?: {
    device?: string;
    location?: string;
    ip?: string;
  };
  createdAt?: Timestamp;
}

export interface StaffUser {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  status: "Active" | "Inactive";
  lastLogin: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: "admin" | "staff";
  name?: string;
  status?: "Active" | "Inactive";
}

interface FirebaseContextType {
  // Auth
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createStaffUser: (email: string, password: string, name: string, role: "admin" | "staff") => Promise<string>;
  updateStaffUser: (uid: string, updates: Partial<StaffUser>) => Promise<void>;
  deleteStaffUser: (uid: string) => Promise<void>;
  deactivateStaffUser: (uid: string) => Promise<void>;
  reactivateStaffUser: (uid: string) => Promise<void>;
  resetStaffPassword: (email: string) => Promise<void>;
  
  // User info
  userRole: 'admin' | 'staff' | null;
  userName: string;
  userId: string;
  userEmail: string;
  
  // Staff Management
  staffUsers: StaffUser[];
  fetchStaffUsers: () => Promise<void>;
  
  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'totalSold'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, newStock: number, reason: string) => Promise<void>;
  
  // Transactions
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<string>;
  voidTransaction: (id: string) => Promise<void>;
  
  // Sync status
  isOnline: boolean;
  
  // Analytics helpers
  getTopSellingProducts: (limit?: number) => Array<{ product: Product; quantity: number; revenue: number }>;
  getTodaySales: () => number;
  getThisMonthSales: () => number;
  getLowStockProducts: () => Product[];
  getDeadstockProducts: () => Product[];
  getExpiringProducts: (daysThreshold?: number) => Product[];
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  
  // User info state
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  // Fetch staff users from Firestore
  const fetchStaffUsers = useCallback(async () => {
    if (!user) return;
    
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email || '',
          name: data.name || data.email?.split('@')[0] || 'Unknown',
          role: data.role || 'staff',
          status: data.status || 'Active',
          lastLogin: data.lastLogin || 'Never',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy
        } as StaffUser;
      });
      
      setStaffUsers(users);
    } catch (error) {
      console.error("Error fetching staff users:", error);
    }
  }, [user]);

  // Update last login timestamp
  const updateLastLogin = useCallback(async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        lastLogin: new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating last login:", error);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setUserId(firebaseUser.uid);
        setUserEmail(firebaseUser.email || '');
        
        // Fetch user role and name from Firestore
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          let role: "admin" | "staff" = "staff";
          let name = firebaseUser.email?.split('@')[0] || 'Staff';
          let status: "Active" | "Inactive" = "Active";
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            role = userData.role || "staff";
            name = userData.name || name;
            status = userData.status || "Active";
            
            // Check if account is deactivated
            if (status === "Inactive") {
              // Sign out deactivated users
              await signOut(auth);
              setUser(null);
              setAppUser(null);
              setUserRole(null);
              setUserName('');
              setUserId('');
              setUserEmail('');
              setLoading(false);
              return;
            }
            
            // Update last login
            await updateLastLogin(firebaseUser.uid);
          } else {
            // If no document, create one with default role (staff)
            await setDoc(userDocRef, { 
              role: "staff", 
              email: firebaseUser.email,
              name: name,
              status: "Active",
              lastLogin: new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          setUserRole(role);
          setUserName(name);
          setAppUser({ uid: firebaseUser.uid, email: firebaseUser.email, role, name, status });
          
        } catch (error) {
          console.error("Error fetching user role:", error);
          const defaultName = firebaseUser.email?.split('@')[0] || 'Staff';
          setUserRole("staff");
          setUserName(defaultName);
          setAppUser({ 
            uid: firebaseUser.uid, 
            email: firebaseUser.email, 
            role: "staff",
            name: defaultName,
            status: "Active"
          });
        }
      } else {
        setAppUser(null);
        setUserRole(null);
        setUserName('');
        setUserId('');
        setUserEmail('');
        setStaffUsers([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [updateLastLogin]);

  // Network status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch staff users when user changes and is admin
  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchStaffUsers();
    }
  }, [user, userRole, fetchStaffUsers]);

  // Fetch products – using fixed CLINIC_ID
  const fetchProducts = useCallback(async () => {
    try {
      const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
      const q = query(productsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsList);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, []);

  // Fetch transactions – using fixed CLINIC_ID
  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
      const q = query(transactionsRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const transactionsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date()
        };
      }) as Transaction[];
      setTransactions(transactionsList);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  }, [user]);

  // Load data when user changes or initially for public view
  useEffect(() => {
    const loadPublicData = async () => {
      await fetchProducts();
    };
    
    const loadPrivateData = async () => {
      if (user) {
        await fetchTransactions();
      } else {
        setTransactions([]);
      }
    };

    loadPublicData();
    loadPrivateData();
  }, [user, fetchProducts, fetchTransactions]);

  // Auth functions
  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user is active
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.status === "Inactive") {
          await signOut(auth);
          throw new Error("This account has been deactivated. Please contact an administrator.");
        }
      }
      
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  // Staff Management functions
  const createStaffUser = async (email: string, password: string, name: string, role: "admin" | "staff"): Promise<string> => {
    if (!user || userRole !== 'admin') {
      throw new Error("Only administrators can create new users");
    }
    
    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        throw new Error("Email already in use. Please use a different email address.");
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUid = userCredential.user.uid;
      
      const userDocRef = doc(db, "users", newUid);
      await setDoc(userDocRef, {
        email,
        name,
        role,
        status: "Active",
        lastLogin: "Never",
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      await fetchStaffUsers();
      
      return newUid;
    } catch (error) {
      console.error("Error creating staff user:", error);
      
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        
        if (firebaseError.code === 'auth/email-already-in-use') {
          throw new Error("This email is already registered. Please use a different email address.");
        } else if (firebaseError.code === 'auth/invalid-email') {
          throw new Error("Invalid email format.");
        } else if (firebaseError.code === 'auth/weak-password') {
          throw new Error("Password is too weak. Please use at least 6 characters.");
        }
      }
      
      throw error;
    }
  };

  const updateStaffUser = async (uid: string, updates: Partial<StaffUser>) => {
    if (!user || userRole !== 'admin') {
      throw new Error("Only administrators can update users");
    }
    
    try {
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      await fetchStaffUsers();
    } catch (error) {
      console.error("Error updating staff user:", error);
      throw error;
    }
  };

  const deactivateStaffUser = async (uid: string) => {
    if (!user || userRole !== 'admin') {
      throw new Error("Only administrators can deactivate users");
    }
    
    if (uid === userId) {
      throw new Error("You cannot deactivate your own account");
    }
    
    try {
      // Update user status to Inactive in Firestore
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, {
        status: "Inactive",
        updatedAt: serverTimestamp()
      });
      
      // Check if the deactivated user is currently logged in
      const deactivatedUser = staffUsers.find(u => u.uid === uid);
      if (deactivatedUser && auth.currentUser?.uid === uid) {
        // Force sign out the deactivated user
        await signOut(auth);
      }
      
      await fetchStaffUsers();
    } catch (error) {
      console.error("Error deactivating staff user:", error);
      throw error;
    }
  };

  const reactivateStaffUser = async (uid: string) => {
    if (!user || userRole !== 'admin') {
      throw new Error("Only administrators can reactivate users");
    }
    
    try {
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, {
        status: "Active",
        updatedAt: serverTimestamp()
      });
      
      await fetchStaffUsers();
    } catch (error) {
      console.error("Error reactivating staff user:", error);
      throw error;
    }
  };

  const deleteStaffUser = async (uid: string) => {
    if (!user || userRole !== 'admin') {
      throw new Error("Only administrators can delete users");
    }
    
    if (uid === userId) {
      throw new Error("You cannot delete your own account");
    }
    
    try {
      // Get the user's Firebase Auth user and delete it
      const userToDelete = staffUsers.find(u => u.uid === uid);
      
      // Delete from Firestore first
      const userDocRef = doc(db, "users", uid);
      await deleteDoc(userDocRef);
      
      // Delete from Firebase Authentication
      // Note: This requires admin privileges and special handling
      // Since we can't delete other users from client-side, we'll use a Firebase Function
      // For now, we'll mark them as deleted and disable the account
      // In production, you should use a Cloud Function to delete the auth user
      
      // Alternative: Update status to a "Deleted" state and disable the account
      // Since we can't delete from client-side, we'll create a deleted flag
      await setDoc(userDocRef, {
        email: userToDelete?.email,
        name: userToDelete?.name,
        role: userToDelete?.role,
        status: "Deleted",
        deletedAt: serverTimestamp(),
        deletedBy: userId,
        lastLogin: userToDelete?.lastLogin
      });
      
      // Force sign out if the deleted user is currently logged in
      if (auth.currentUser?.uid === uid) {
        await signOut(auth);
      }
      
      await fetchStaffUsers();
    } catch (error) {
      console.error("Error deleting staff user:", error);
      throw error;
    }
  };

  const resetStaffPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      console.error("Error sending password reset:", error);
      
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        
        switch (firebaseError.code) {
          case 'auth/user-not-found':
            throw new Error("No account found with this email address.");
          case 'auth/invalid-email':
            throw new Error("Invalid email format. Please check your email address.");
          case 'auth/too-many-requests':
            throw new Error("Too many reset attempts. Please try again later.");
          case 'auth/network-request-failed':
            throw new Error("Network error. Please check your internet connection.");
          case 'auth/internal-error':
            throw new Error("Internal error. Please try again later.");
          default:
            throw new Error(`Failed to send reset email: ${firebaseError.message || 'Unknown error'}`);
        }
      }
      
      throw new Error("Failed to send reset email. Please try again.");
    }
  };

  // Products functions
  const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'totalSold'>): Promise<string> => {
    if (!user) throw new Error("User not authenticated");
    try {
      const productsRef = collection(db, `clinics/${CLINIC_ID}/products`);
      const docRef = await addDoc(productsRef, {
        ...product,
        totalSold: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const newProduct = { 
        id: docRef.id, 
        ...product,
        totalSold: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      } as Product;
      setProducts(prev => [newProduct, ...prev]);
      return docRef.id;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    if (!user) throw new Error("User not authenticated");
    try {
      const productRef = doc(db, `clinics/${CLINIC_ID}/products`, id);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      setProducts(prev => 
        prev.map(p => p.id === id ? { ...p, ...updates } : p)
      );
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user) throw new Error("User not authenticated");
    try {
      const productRef = doc(db, `clinics/${CLINIC_ID}/products`, id);
      await deleteDoc(productRef);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  };

  const adjustStock = async (id: string, newStock: number, reason: string) => {
    if (!user) throw new Error("User not authenticated");
    try {
      const productRef = doc(db, `clinics/${CLINIC_ID}/products`, id);
      await updateDoc(productRef, {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
      
      const adjustmentsRef = collection(db, `clinics/${CLINIC_ID}/stockAdjustments`);
      await addDoc(adjustmentsRef, {
        productId: id,
        newStock,
        reason,
        staffName: userName,
        staffId: userId,
        staffEmail: userEmail,
        performedBy: `${userName} (${userId.slice(-4)})`,
        timestamp: serverTimestamp(),
        scanType: reason.toLowerCase().includes('qr') ? 'qr_scan' : 'manual',
        isImmutable: true
      });
      
      setProducts(prev => 
        prev.map(p => p.id === id ? { ...p, stock: newStock } : p)
      );
    } catch (error) {
      console.error("Error adjusting stock:", error);
      throw error;
    }
  };

  // Transactions functions
  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (!user) throw new Error("User not authenticated");
    try {
      // Update product totalSold counts
      for (const item of transaction.items) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          const productRef = doc(db, `clinics/${CLINIC_ID}/products`, item.id);
          const newTotalSold = (product.totalSold || 0) + item.quantity;
          await updateDoc(productRef, {
            totalSold: newTotalSold,
            lastMovedDaysAgo: 0,
            updatedAt: serverTimestamp()
          });
          setProducts(prev => 
            prev.map(p => p.id === item.id 
              ? { ...p, totalSold: newTotalSold, lastMovedDaysAgo: 0 } 
              : p
            )
          );
        }
      }

      // Create transaction with staff info
      const transactionsRef = collection(db, `clinics/${CLINIC_ID}/transactions`);
      const docRef = await addDoc(transactionsRef, {
        ...transaction,
        staffName: userName,
        staffId: userId,
        staffEmail: userEmail,
        date: transaction.date,
        createdAt: serverTimestamp()
      });
      
      const newTransaction = { 
        id: docRef.id, 
        ...transaction,
        staffName: userName,
        staffId: userId,
        staffEmail: userEmail
      } as Transaction;
      
      setTransactions(prev => [newTransaction, ...prev]);
      
      return docRef.id;
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  };

  const voidTransaction = async (id: string) => {
    if (!user) throw new Error("User not authenticated");
    try {
      const transaction = transactions.find(t => t.id === id);
      if (transaction && transaction.status === 'completed') {
        // Restore product totalSold counts
        for (const item of transaction.items) {
          const product = products.find(p => p.id === item.id);
          if (product) {
            const productRef = doc(db, `clinics/${CLINIC_ID}/products`, item.id);
            const newTotalSold = Math.max(0, (product.totalSold || 0) - item.quantity);
            await updateDoc(productRef, {
              totalSold: newTotalSold,
              updatedAt: serverTimestamp()
            });
            setProducts(prev => 
              prev.map(p => p.id === item.id 
                ? { ...p, totalSold: newTotalSold } 
                : p
              )
            );
          }
        }
      }

      const transactionRef = doc(db, `clinics/${CLINIC_ID}/transactions`, id);
      await updateDoc(transactionRef, {
        status: "voided",
        updatedAt: serverTimestamp()
      });
      setTransactions(prev => 
        prev.map(t => t.id === id ? { ...t, status: "voided" } : t)
      );
    } catch (error) {
      console.error("Error voiding transaction:", error);
      throw error;
    }
  };

  // Analytics helpers
  const getTopSellingProducts = useCallback((limit: number = 5) => {
    const salesMap = new Map<string, { quantity: number; revenue: number }>();
    transactions
      .filter(t => t.status === 'completed')
      .forEach(transaction => {
        transaction.items.forEach(item => {
          const current = salesMap.get(item.id) || { quantity: 0, revenue: 0 };
          salesMap.set(item.id, {
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + (item.price * item.quantity)
          });
        });
      });
    return Array.from(salesMap.entries())
      .map(([productId, stats]) => ({
        product: products.find(p => p.id === productId)!,
        quantity: stats.quantity,
        revenue: stats.revenue
      }))
      .filter(item => item.product)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }, [transactions, products]);

  const getTodaySales = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions
      .filter(t => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return t.status === 'completed' && transDate.getTime() === today.getTime();
      })
      .reduce((sum, t) => sum + t.total, 0);
  }, [transactions]);

  const getThisMonthSales = useCallback(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions
      .filter(t => t.status === 'completed' && new Date(t.date) >= firstDay)
      .reduce((sum, t) => sum + t.total, 0);
  }, [transactions]);

  const getLowStockProducts = useCallback(() => {
    return products.filter(p => p.stock <= p.reorderPoint && p.stock > 0);
  }, [products]);

  const getDeadstockProducts = useCallback(() => {
    return products.filter(p => p.lastMovedDaysAgo >= 30 && p.stock > 0);
  }, [products]);

  const getExpiringProducts = useCallback((daysThreshold: number = 30) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return products.filter(p => {
      if (!p.expiryDate || p.stock <= 0) return false;
      const expiryDate = new Date(p.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
    });
  }, [products]);

  const value: FirebaseContextType = {
    user,
    appUser,
    loading,
    login,
    logout,
    createStaffUser,
    updateStaffUser,
    deleteStaffUser,
    deactivateStaffUser,
    reactivateStaffUser,
    resetStaffPassword,
    userRole,
    userName,
    userId,
    userEmail,
    staffUsers,
    fetchStaffUsers,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    transactions,
    addTransaction,
    voidTransaction,
    isOnline,
    getTopSellingProducts,
    getTodaySales,
    getThisMonthSales,
    getLowStockProducts,
    getDeadstockProducts,
    getExpiringProducts,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
}
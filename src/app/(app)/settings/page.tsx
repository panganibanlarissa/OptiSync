"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase } from "@/context/FirebaseContext";
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  X,
  Shield,
  Mail,
  Key,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

// --- THEME CONSTANTS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// Define types
interface StaffUser {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  status: "Active" | "Inactive";
  lastLogin: string;
}

export default function SettingsPage() {
  // Data State
  const { 
    staffUsers, 
    fetchStaffUsers, 
    userRole, 
    userId,
    createStaffUser, 
    updateStaffUser, 
    deleteStaffUser,
    resetStaffPassword,
    loading: firebaseLoading
  } = useFirebase();
  
  // Use staffUsers directly from context - no local state duplication
  const users = staffUsers;
  const loading = firebaseLoading;

  // Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  
  // Controlled form state
  const [userForm, setUserForm] = useState({
    uid: "",
    name: "",
    email: "",
    password: "",
    role: "Staff" as "Staff" | "Admin",
    status: "Active" as "Active" | "Inactive"
  });
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<StaffUser | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const { showNotification } = useNotification();

  // Load users when component mounts or when userRole changes
  useEffect(() => {
    const loadUsers = async () => {
      if (userRole === 'admin') {
        await fetchStaffUsers();
      }
    };
    loadUsers();
  }, [userRole, fetchStaffUsers]);

  // No need for useEffect to sync staffUsers - use it directly

  // Check if current user is admin
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen w-full font-sans p-4 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full font-sans p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // --- HANDLERS ---

  const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserForm({ ...userForm, [name]: value });
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    
    if (!userForm.name.trim()) {
      errors.name = "Name is required";
    }
    
    if (!userForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      errors.email = "Invalid email format";
    }
    
    if (modalMode === "add" && !userForm.password) {
      errors.password = "Password is required";
    } else if (modalMode === "add" && userForm.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddUserModal = () => {
    setModalMode("add");
    setUserForm({ uid: "", name: "", email: "", password: "", role: "Staff", status: "Active" });
    setFormErrors({});
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: StaffUser) => {
    setModalMode("edit");
    setUserForm({ 
      uid: user.uid,
      name: user.name, 
      email: user.email, 
      password: "",
      role: user.role === "admin" ? "Admin" : "Staff", 
      status: user.status
    });
    setFormErrors({});
    setIsUserModalOpen(true);
  };

  const openDeleteModal = (user: StaffUser) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      showNotification("Please fill in all required fields correctly.", "error");
      return;
    }

    try {
      if (modalMode === "add") {
        await createStaffUser(
          userForm.email,
          userForm.password,
          userForm.name,
          userForm.role.toLowerCase() as "admin" | "staff"
        );
        showNotification(
          `${userForm.name} has been added as ${userForm.role}.`, 
          "success",
          "User Created"
        );
      } else if (modalMode === "edit") {
        await updateStaffUser(userForm.uid, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role.toLowerCase() as "admin" | "staff",
          status: userForm.status
        });
        showNotification(
          `${userForm.name}&apos;s details updated.`, 
          "success",
          "User Updated"
        );
      }
      setIsUserModalOpen(false);
    } catch (error: unknown) {
      console.error("Error saving user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save user. Please try again.";
      showNotification(
        errorMessage, 
        "error",
        "Error"
      );
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await resetStaffPassword(email);
      showNotification(
        `Password reset email sent to ${email}`,
        "success",
        "Reset Email Sent"
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset email.";
      showNotification(
        errorMessage,
        "error",
        "Error"
      );
    }
  };

  const confirmDeleteUser = async () => {
    if (userToDelete) {
      try {
        await deleteStaffUser(userToDelete.uid);
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
        showNotification(
          `${userToDelete.name} has been deactivated.`, 
          "info",
          "User Deactivated"
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete user.";
        showNotification(
          errorMessage,
          "error",
          "Error"
        );
      }
    }
  };

  return (
    <div className="min-h-screen w-full font-sans p-2 sm:p-4 box-border pb-20">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mb-6 sm:mb-8">
          <motion.h1 variants={itemVariants} className="text-2xl sm:text-3xl font-black text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl shadow-sm">
              <Users className={THEME_TEXT} size={26} />
            </div>
            Staff Management
          </motion.h1>
          <motion.p variants={itemVariants} className="text-sm text-gray-500 mt-2 ml-1">
            Manage system access and roles for your employees.
          </motion.p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Staff Accounts</h2>
              <p className="text-xs text-gray-500 mt-1">
                {users.length} active user{users.length !== 1 ? 's' : ''} in the system
              </p>
            </div>
            <button 
              onClick={openAddUserModal} 
              className={`flex items-center justify-center gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all shrink-0`}
            >
              <Plus size={16}/> 
              <span className="hidden sm:inline">Add Staff Member</span>
              <span className="sm:hidden">Add Staff</span>
            </button>
          </div>

          <div className="p-0 sm:p-2 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap min-w-[700px]">
              <thead className="text-gray-400 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 sm:p-5">User Info</th>
                  <th className="p-4 sm:p-5">Role</th>
                  <th className="p-4 sm:p-5">Status</th>
                  <th className="p-4 sm:p-5">Last Login</th>
                  <th className="p-4 sm:p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      No staff members found. Click &quot;Add Staff Member&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {users.map((user) => (
                      <motion.tr 
                        key={user.uid} 
                        variants={itemVariants} 
                        layout 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className={`hover:bg-slate-50 transition-colors group ${
                          user.status === 'Inactive' ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="p-4 sm:p-5">
                          <div className="font-bold text-gray-800 flex items-center gap-2">
                            {user.uid === userId && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                YOU
                              </span>
                            )}
                            {user.name}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <Mail size={10} className="opacity-50" />
                            {user.email}
                          </div>
                        </td>
                        <td className="p-4 sm:p-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {user.role === 'admin' ? 'Admin' : 'Staff'}
                          </span>
                        </td>
                        <td className="p-4 sm:p-5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${
                              user.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}></div>
                            <span className="font-medium text-gray-600 text-xs">
                              {user.status}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-5">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock size={12} className="opacity-50" />
                            {user.lastLogin || 'Never'}
                          </div>
                        </td>
                        <td className="p-4 sm:p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.uid !== userId && (
                              <button 
                                onClick={() => handleResetPassword(user.email)}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Send Password Reset"
                              >
                                <Key size={16}/>
                              </button>
                            )}
                            <button 
                              onClick={() => openEditUserModal(user)}
                              className="p-1.5 sm:p-2 text-gray-400 hover:text-[#0B3C8A] hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit User"
                            >
                              <Edit3 size={16}/>
                            </button>
                            {user.uid !== userId && (
                              <button 
                                onClick={() => openDeleteModal(user)}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={user.status === 'Active' ? 'Deactivate User' : 'Remove User'}
                              >
                                <Trash2 size={16}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-4">
            <div className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" /> Active accounts can log in
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle size={12} className="text-red-500" /> Inactive accounts cannot log in
            </div>
          </div>
        </motion.div>
      </div>

      {/* --- ADD / EDIT USER MODAL --- */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-slate-50">
                <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <Users size={20} className={THEME_TEXT}/> 
                  {modalMode === "add" ? "Add Staff Member" : "Edit Staff Details"}
                </h2>
                <button 
                  onClick={() => setIsUserModalOpen(false)} 
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              
              <form id="user-form" onSubmit={handleSaveUser} className="p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    name="name" 
                    value={userForm.name} 
                    onChange={handleUserFormChange}
                    type="text" 
                    placeholder="e.g. John Doe" 
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.name ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-2'
                    } text-sm ${THEME_RING} focus:outline-none bg-slate-50`} 
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-[10px] mt-1">{formErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    name="email" 
                    value={userForm.email} 
                    onChange={handleUserFormChange}
                    type="email" 
                    placeholder="john@clinic.com" 
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.email ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-2'
                    } text-sm ${THEME_RING} focus:outline-none bg-slate-50`} 
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-[10px] mt-1">{formErrors.email}</p>
                  )}
                </div>
                 
                {modalMode === "add" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Temporary Password <span className="text-red-500">*</span>
                    </label>
                    <input 
                      required 
                      name="password" 
                      value={userForm.password} 
                      onChange={handleUserFormChange}
                      type="password" 
                      placeholder="•••••••• (min. 6 characters)" 
                      className={`w-full px-4 py-2.5 rounded-xl border ${
                        formErrors.password ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-2'
                      } text-sm ${THEME_RING} focus:outline-none bg-slate-50`} 
                    />
                    {formErrors.password && (
                      <p className="text-red-500 text-[10px] mt-1">{formErrors.password}</p>
                    )}
                  </div>
                )}

                {modalMode === "edit" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Account Status
                    </label>
                    <select 
                      name="status" 
                      value={userForm.status} 
                      onChange={handleUserFormChange}
                      className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none bg-slate-50 cursor-pointer`}
                    >
                      <option value="Active">Active - Can log in</option>
                      <option value="Inactive">Inactive - Cannot log in</option>
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Inactive users cannot access the system
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    System Role
                  </label>
                  <select 
                    required 
                    name="role" 
                    value={userForm.role} 
                    onChange={handleUserFormChange}
                    className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none bg-slate-50 cursor-pointer`}
                  >
                    <option value="Staff">Staff - Basic access</option>
                    <option value="Admin">Admin - Full access</option>
                  </select>
                </div>

                {modalMode === "add" && (
                  <p className="text-[10px] text-gray-400 bg-blue-50 p-2 rounded-lg">
                    <AlertCircle size={12} className="inline mr-1 text-blue-500" />
                    New users will receive an email to set up their account.
                  </p>
                )}
              </form>

              <div className="p-4 sm:p-5 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsUserModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  form="user-form" 
                  className={`flex-1 px-4 py-2.5 rounded-xl ${THEME_BG} text-white text-sm font-bold ${THEME_HOVER} transition-colors shadow-sm`}
                >
                  {modalMode === "add" ? "Create User" : "Update User"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {isDeleteModalOpen && userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">
                {userToDelete.status === 'Active' ? 'Deactivate Staff Member?' : 'Remove Staff Member?'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {userToDelete.status === 'Active' ? (
                  <>Are you sure you want to deactivate <span className="font-bold text-gray-800">{userToDelete.name}</span>? They will immediately lose access to the system.</>
                ) : (
                  <>Are you sure you want to permanently remove <span className="font-bold text-gray-800">{userToDelete.name}</span> from the system?</>
                )}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteUser} 
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-sm"
                >
                  {userToDelete.status === 'Active' ? 'Yes, Deactivate' : 'Yes, Remove'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
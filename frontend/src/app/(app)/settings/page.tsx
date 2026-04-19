// src/app/(app)/settings/page.tsx

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNotification } from "@/components/NotificationProvider";
import { useFirebase, StaffUser } from "@/context/FirebaseContext";
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
  Ban,
  UserCheck,
  Eye,
  EyeOff,
  RefreshCw,
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

// --- PASSWORD STRENGTH UTILITIES ---
interface PasswordStrength {
  score: number;
  label: "Too Short" | "Weak" | "Fair" | "Good" | "Strong";
  color: string;
  textColor: string;
  barWidth: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

function evaluatePassword(password: string): PasswordStrength {
  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[^A-Za-z0-9]/.test(password),
  };

  if (password.length === 0) {
    return {
      score: 0,
      label: "Too Short",
      color: "bg-gray-200",
      textColor: "text-gray-400",
      barWidth: "w-0",
      checks
    };
  }

  if (password.length < 8) {
    return {
      score: 0,
      label: "Too Short",
      color: "bg-red-400",
      textColor: "text-red-500",
      barWidth: "w-1/4",
      checks
    };
  }

  const passed = Object.values(checks).filter(Boolean).length;

  if (passed <= 2) return { score: 1, label: "Weak",   color: "bg-red-500",    textColor: "text-red-600",    barWidth: "w-1/4",   checks };
  if (passed === 3) return { score: 2, label: "Fair",   color: "bg-yellow-400", textColor: "text-yellow-600", barWidth: "w-2/4",   checks };
  if (passed === 4) return { score: 3, label: "Good",   color: "bg-blue-500",   textColor: "text-blue-600",   barWidth: "w-3/4",   checks };
  return               { score: 4, label: "Strong",  color: "bg-emerald-500", textColor: "text-emerald-600", barWidth: "w-full",  checks };
}

export default function SettingsPage() {
  const { 
    staffUsers, 
    fetchStaffUsers, 
    userRole, 
    userId,
    createStaffUser, 
    updateStaffUser, 
    deleteStaffUser,
    deactivateStaffUser,
    reactivateStaffUser,
    resetStaffPassword,
    resendVerificationEmail,
    loading: firebaseLoading
  } = useFirebase();
  
  const { showNotification, showToastOnly } = useNotification();
  
  const users = staffUsers;
  const loading = firebaseLoading;
  const [refreshing, setRefreshing] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  
  const [userForm, setUserForm] = useState({
    uid: "",
    name: "",
    email: "",
    password: "",
    role: "Staff" as "Staff" | "Admin",
    status: "Active" as "Active" | "Inactive"
  });

  const [showPassword, setShowPassword] = useState(false);
  
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToAction, setUserToAction] = useState<StaffUser | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  const passwordStrength = useMemo(
    () => evaluatePassword(userForm.password),
    [userForm.password]
  );

  useEffect(() => {
    const loadUsers = async () => {
      if (userRole === 'admin') {
        await fetchStaffUsers();
      }
    };
    loadUsers();
  }, [userRole, fetchStaffUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStaffUsers();
    setRefreshing(false);
    showToastOnly("Staff list refreshed", "success");
  };

  const getLastLoginDisplay = (user: StaffUser) => {
    if (user.lastLogin === "Never" || !user.lastLogin) {
      return {
        text: "Never logged in",
        icon: <Clock size={12} className="text-gray-400" />,
        color: "text-gray-400"
      };
    }
    
    if (user.lastLoginTimestamp) {
      const now = new Date();
      const diffMs = now.getTime() - user.lastLoginTimestamp.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 60) {
        return {
          text: user.lastLogin,
          icon: <Clock size={12} className="text-green-500" />,
          color: "text-green-600"
        };
      }
    }
    
    return {
      text: user.lastLogin,
      icon: <Clock size={12} className="text-blue-500" />,
      color: "text-blue-600"
    };
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.uid === userId) return -1;
      if (b.uid === userId) return 1;
      
      const aTime = a.lastLoginTimestamp?.getTime() || 0;
      const bTime = b.lastLoginTimestamp?.getTime() || 0;
      return bTime - aTime;
    });
  }, [users, userId]);

  const activeCount = users.filter(u => u.status === 'Active').length;
  const pendingCount = users.filter(u => u.status === 'PendingVerification').length;
  const inactiveCount = users.filter(u => u.status === 'Inactive').length;

  const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserForm({ ...userForm, [name]: value });
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
    
    if (modalMode === "add") {
      if (!userForm.password) {
        errors.password = "Password is required";
      } else if (userForm.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      } else if (passwordStrength.score < 2) {
        errors.password = "Password is too weak — add uppercase letters, numbers, or symbols";
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddUserModal = () => {
    setModalMode("add");
    setUserForm({ uid: "", name: "", email: "", password: "", role: "Staff", status: "Active" });
    setFormErrors({});
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: StaffUser) => {
    setModalMode("edit");
    const displayStatus = user.status === "PendingVerification" ? "Active" : user.status;
    setUserForm({ 
      uid: user.uid,
      name: user.name, 
      email: user.email, 
      password: "",
      role: user.role === "admin" ? "Admin" : "Staff", 
      status: displayStatus === "Active" ? "Active" : "Inactive"
    });
    setFormErrors({});
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const openDeactivateModal = (user: StaffUser) => {
    setUserToAction(user);
    setIsDeactivateModalOpen(true);
  };

  const openDeleteModal = (user: StaffUser) => {
    setUserToAction(user);
    setIsDeleteModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      showNotification("Please fill in all required fields correctly.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "add") {
        await createStaffUser(
          userForm.email,
          userForm.password,
          userForm.name,
          userForm.role.toLowerCase() as "admin" | "staff"
        );
        showNotification(
          `✅ ${userForm.name} has been added as ${userForm.role}. A verification email has been sent to ${userForm.email}.`, 
          "success",
          "User Created - Verification Required"
        );
        await fetchStaffUsers();
      } else if (modalMode === "edit") {
        await updateStaffUser(userForm.uid, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role.toLowerCase() as "admin" | "staff",
          status: userForm.status
        });
        showNotification(
          `${userForm.name}'s details updated.`, 
          "success",
          "User Updated"
        );
        await fetchStaffUsers();
      }
      setIsUserModalOpen(false);
    } catch (error: unknown) {
      console.error("Error saving user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save user. Please try again.";
      showNotification(errorMessage, "error", "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await resetStaffPassword(email);
      showNotification(`Password reset email sent to ${email}`, "success", "Reset Email Sent");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset email.";
      showNotification(errorMessage, "error", "Error");
    }
  };

  const handleResendVerification = async (email: string) => {
    setResendingEmail(email);
    try {
      await resendVerificationEmail(email);
      showNotification(`✅ Verification email sent to ${email}`, "success", "Email Verification Sent");
    } catch (error: unknown) {
      console.error("Error resending verification:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send verification email.";
      
      // If the error says email already verified, show success instead
      if (errorMessage.includes("already verified")) {
        showNotification(`✅ Email already verified! Status updated to Active.`, "success", "Email Verified");
        await fetchStaffUsers();
      } else {
        showNotification(errorMessage, "error", "Error");
      }
    } finally {
      setResendingEmail(null);
    }
  };

  const confirmDeactivateUser = async () => {
    if (userToAction) {
      try {
        await deactivateStaffUser(userToAction.uid);
        setIsDeactivateModalOpen(false);
        setUserToAction(null);
        showNotification(`${userToAction.name} has been deactivated.`, "warning", "User Deactivated");
        await fetchStaffUsers();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to deactivate user.";
        showNotification(errorMessage, "error", "Error");
      }
    }
  };

  const confirmDeleteUser = async () => {
    if (userToAction) {
      try {
        await deleteStaffUser(userToAction.uid);
        setIsDeleteModalOpen(false);
        setUserToAction(null);
        showNotification(`${userToAction.name} has been permanently deleted.`, "info", "User Deleted");
        await fetchStaffUsers();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete user.";
        showNotification(errorMessage, "error", "Error");
      }
    }
  };

  const handleReactivateUser = async (user: StaffUser) => {
    try {
      await reactivateStaffUser(user.uid);
      const newStatus = user.emailVerified === false ? "PendingVerification" : "Active";
      showNotification(
        `${user.name} has been reactivated.`, 
        "success", 
        "User Reactivated"
      );
      await fetchStaffUsers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reactivate user.";
      showNotification(errorMessage, "error", "Error");
    }
  };

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

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen w-full font-sans p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full font-sans p-2 sm:p-4 box-border pb-20">
      <div className="w-full">
        
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mb-6 sm:mb-8">
          <div className="flex justify-between items-start">
            <div>
              <motion.h1 variants={itemVariants} className="text-2xl sm:text-3xl font-black text-gray-800 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl shadow-sm">
                  <Users className={THEME_TEXT} size={26} />
                </div>
                Staff Management
              </motion.h1>
              <motion.p variants={itemVariants} className="text-sm text-gray-500 mt-2 ml-1">
                Manage system access and roles for your employees.
              </motion.p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#0B3C8A] hover:border-[#0B3C8A] transition-all ${refreshing ? 'animate-spin' : ''}`}
              title="Refresh staff list"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Staff Accounts</h2>
              <p className="text-xs text-gray-500 mt-1">
                {activeCount} active, {pendingCount} pending, {inactiveCount} inactive
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
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      No staff members found. Click "Add Staff Member" to create one.
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {sortedUsers.map((user) => {
                      const lastLoginDisplay = getLastLoginDisplay(user);
                      const isPendingVerification = user.status === "PendingVerification" || user.emailVerified === false;
                      const isInactive = user.status === "Inactive";
                      const isActive = user.status === "Active";
                      const isDeleted = user.status === "Deleted";
                      const isResending = resendingEmail === user.email;
                      
                      return (
                        <motion.tr 
                          key={user.uid} 
                          variants={itemVariants} 
                          layout 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }} 
                          className={`hover:bg-slate-50 transition-colors group ${
                            isInactive ? 'opacity-60 bg-red-50/30' : ''
                          } ${isPendingVerification ? 'bg-yellow-50/30' : ''}`}
                        >
                          <td className="p-4 sm:p-5">
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              {user.uid === userId && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  YOU
                                </span>
                              )}
                              {user.name}
                              {isPendingVerification && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
                                  <Clock size={10} /> Pending
                                </span>
                              )}
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
                                isDeleted ? 'bg-gray-500' :
                                isPendingVerification ? 'bg-yellow-500' :
                                isActive ? 'bg-emerald-500' : 'bg-red-500'
                              }`}></div>
                              <span className={`font-medium text-xs ${
                                isDeleted ? 'text-gray-500' :
                                isPendingVerification ? 'text-yellow-700' :
                                isActive ? 'text-emerald-700' : 'text-red-700'
                              }`}>
                                {user.status}
                              </span>
                            </div>
                           </td>
                          <td className="p-4 sm:p-5">
                            <div className="flex items-center gap-1.5">
                              {lastLoginDisplay.icon}
                              <span className={`text-xs ${lastLoginDisplay.color}`}>
                                {lastLoginDisplay.text}
                              </span>
                            </div>
                           </td>
                          <td className="p-4 sm:p-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.uid !== userId && !isDeleted && (
                                <>
                                  <button 
                                    onClick={() => handleResetPassword(user.email)}
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Send Password Reset"
                                  >
                                    <Key size={16}/>
                                  </button>
                                  {isPendingVerification && (
                                    <button 
                                      onClick={() => handleResendVerification(user.email)}
                                      disabled={isResending}
                                      className={`p-1.5 sm:p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors ${isResending ? 'animate-spin' : ''}`}
                                      title="Resend Verification Email"
                                    >
                                      <RefreshCw size={16}/>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => openEditUserModal(user)}
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-[#0B3C8A] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit User"
                                  >
                                    <Edit3 size={16}/>
                                  </button>
                                  {user.status === 'Active' || user.status === 'PendingVerification' ? (
                                    <button 
                                      onClick={() => openDeactivateModal(user)}
                                      className="p-1.5 sm:p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                      title="Deactivate User"
                                    >
                                      <Ban size={16}/>
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => handleReactivateUser(user)}
                                      className="p-1.5 sm:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                      title="Reactivate User"
                                    >
                                      <UserCheck size={16}/>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                           </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-gray-100 text-[10px] text-gray-400 flex flex-wrap gap-4">
            <div className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" /> Active accounts can log in
            </div>
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-yellow-500" /> Pending verification requires email confirmation
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle size={12} className="text-orange-500" /> Deactivated accounts are locked out
            </div>
            <div className="flex items-center gap-1">
              <Trash2 size={12} className="text-red-500" /> Permanently deleted accounts cannot be restored
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
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    name="name" 
                    value={userForm.name} 
                    onChange={handleUserFormChange}
                    type="text" 
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.name ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-2'
                    } text-sm text-gray-900 ${THEME_RING} focus:outline-none bg-white`} 
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-[10px] mt-1">{formErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    name="email" 
                    value={userForm.email} 
                    onChange={handleUserFormChange}
                    type="email" 
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      formErrors.email ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-2'
                    } text-sm text-gray-900 ${THEME_RING} focus:outline-none bg-white`} 
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-[10px] mt-1">{formErrors.email}</p>
                  )}
                </div>
                 
                {modalMode === "add" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Password <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">
                      <input 
                        required 
                        name="password" 
                        value={userForm.password} 
                        onChange={handleUserFormChange}
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 8 characters"
                        className={`w-full px-4 py-2.5 pr-10 rounded-xl border ${
                          formErrors.password ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-2'
                        } text-sm text-gray-900 ${THEME_RING} focus:outline-none bg-white`} 
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {userForm.password.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.barWidth}`}
                            />
                          </div>
                          <span className={`text-[10px] font-bold shrink-0 ${passwordStrength.textColor}`}>
                            {passwordStrength.label}
                          </span>
                        </div>

                        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {[
                            { key: "length",    label: "8+ characters" },
                            { key: "uppercase", label: "Uppercase letter" },
                            { key: "lowercase", label: "Lowercase letter" },
                            { key: "number",    label: "Number" },
                            { key: "special",   label: "Special character" },
                          ].map(({ key, label }) => {
                            const passed = passwordStrength.checks[key as keyof typeof passwordStrength.checks];
                            return (
                              <li key={key} className={`flex items-center gap-1 text-[10px] ${passed ? "text-emerald-600" : "text-gray-400"}`}>
                                <CheckCircle2 size={10} className={passed ? "text-emerald-500" : "text-gray-300"} />
                                {label}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {formErrors.password && (
                      <p className="text-red-500 text-[10px] mt-1">{formErrors.password}</p>
                    )}
                  </div>
                )}

                {modalMode === "edit" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Account Status
                    </label>
                    <select 
                      name="status" 
                      value={userForm.status} 
                      onChange={handleUserFormChange}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none bg-white cursor-pointer"
                    >
                      <option value="Active" className="text-gray-900">Active - Can log in</option>
                      <option value="Inactive" className="text-gray-900">Inactive - Cannot log in</option>
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Inactive users cannot access the system
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    System Role
                  </label>
                  <select 
                    required 
                    name="role" 
                    value={userForm.role} 
                    onChange={handleUserFormChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-[#0B3C8A] focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="Staff" className="text-gray-900">Staff - Basic access</option>
                    <option value="Admin" className="text-gray-900">Admin - Full access</option>
                  </select>
                </div>

                {modalMode === "add" && (
                  <div className="text-[10px] text-gray-500 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                    <AlertCircle size={12} className="inline mr-1 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">Email verification required.</span> The staff member will receive a verification email and must verify before logging in.
                  </div>
                )}
              </form>

              <div className="p-4 sm:p-5 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsUserModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  form="user-form" 
                  disabled={isSubmitting || (modalMode === "add" && userForm.password.length > 0 && passwordStrength.score < 2)}
                  className={`flex-1 px-4 py-2.5 rounded-xl ${THEME_BG} text-white text-sm font-bold ${THEME_HOVER} transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                      {modalMode === "add" ? "Creating..." : "Updating..."}
                    </>
                  ) : (
                    modalMode === "add" ? "Create User" : "Update User"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DEACTIVATE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {isDeactivateModalOpen && userToAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ban className="text-orange-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">
                Deactivate Staff Member?
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Are you sure you want to deactivate <span className="font-bold text-gray-800">{userToAction.name}</span>? 
                They will immediately lose access to the system.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeactivateModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeactivateUser} 
                  className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-colors shadow-sm"
                >
                  Yes, Deactivate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PERMANENT DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {isDeleteModalOpen && userToAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">
                Permanently Delete Account?
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                ⚠️ <span className="font-bold text-red-600">This action is irreversible!</span><br/><br/>
                Are you sure you want to permanently delete <span className="font-bold text-gray-800">{userToAction.name}</span>&apos;s account?
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
                  Yes, Permanently Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
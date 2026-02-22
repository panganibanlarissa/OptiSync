"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNotification } from "@/components/NotificationProvider";
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  Plus, 
  Save, 
  Edit3, 
  Trash2, 
  X, 
  UploadCloud, 
  Mail,
  Phone,
  MapPin
} from "lucide-react";

// --- THEME CONSTANTS ---
const THEME_BG = "bg-[#0B3C8A]";
const THEME_HOVER = "hover:bg-[#082F6E]";
const THEME_TEXT = "text-[#0B3C8A]";
const THEME_RING = "focus:ring-[#0B3C8A]";

// --- ANIMATION VARIANTS ---
const tabVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.2 } }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// --- TYPES & MOCK DATA ---
interface User {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Staff";
  status: "Active" | "Inactive";
  lastLogin: string;
}

const INITIAL_USERS: User[] = [
  { id: "USR-001", name: "Dr. Maria Olaso", email: "maria.olaso@clinic.com", role: "Admin", status: "Active", lastLogin: "Today, 08:30 AM" },
  { id: "USR-002", name: "Jane Doe", email: "jane.desk@clinic.com", role: "Staff", status: "Active", lastLogin: "Today, 09:15 AM" }
];

export default function SettingsPage() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"profile" | "users">("users");
  
  // Data State
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  
  // CONTROLLED FORM STATE 
  const [userForm, setUserForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    role: "Staff" as "Staff" | "Admin",
    status: "Active" as "Active" | "Inactive"
  });
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { showNotification } = useNotification();

  // --- HANDLERS ---

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setLogoPreview(imageUrl);
      showNotification("Clinic logo updated.", "success");
    }
  };

  const handleSaveProfile = () => {
    showNotification("Clinic profile updated successfully.", "success");
  };

  // User Management Form Handler
  const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const openAddUserModal = () => {
    setModalMode("add");
    // Reset form for a blank slate
    setUserForm({ id: "", name: "", email: "", password: "", role: "Staff", status: "Active" });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: User) => {
    setModalMode("edit");
    // Load existing user data into controlled state
    setUserForm({ 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      password: "", // Never display passwords back to the UI
      role: user.role, 
      status: user.status 
    });
    setIsUserModalOpen(true);
  };

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (modalMode === "add") {
      const newUser: User = {
        id: `USR-00${Math.floor(100 + Math.random() * 900)}`,
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        status: "Active", // Always default to active when creating
        lastLogin: "Never",
      };
      setUsers([...users, newUser]);
      showNotification(`${newUser.name} has been added as ${newUser.role}.`, "success");
    } else if (modalMode === "edit") {
      const updatedUsers = users.map(u => 
        u.id === userForm.id 
          ? { ...u, name: userForm.name, email: userForm.email, role: userForm.role } 
          : u
      );
      setUsers(updatedUsers);
      showNotification(`${userForm.name}'s details updated.`, "success");
    }
    
    setIsUserModalOpen(false);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      showNotification("Staff member removed from the system.", "error");
    }
  };

  return (
    <div className="min-h-screen w-full font-sans sm:mt-4 p-2 sm:p-4 box-border pb-20">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="mb-6 sm:mb-8">
           <h1 className="text-2xl sm:text-3xl font-black text-gray-800 flex items-center gap-3">
             <div className="p-2 bg-blue-50 rounded-xl shadow-sm">
                <ShieldCheck className={THEME_TEXT} size={26} />
             </div>
             System Settings
           </h1>
           <p className="text-sm text-gray-500 mt-2 ml-1">
             Manage clinic profile information and staff access roles.
           </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
            <NavButton icon={Building2} label="Clinic Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            <NavButton icon={Users} label="User Management" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
             <AnimatePresence mode="wait">
               
               {/* --- TAB 1: CLINIC PROFILE --- */}
               {activeTab === 'profile' && (
                 <motion.div key="profile" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="p-6 sm:p-8">
                    <div className="mb-6">
                       <h2 className="text-lg font-bold text-gray-800">Clinic Profile</h2>
                       <p className="text-xs text-gray-500 mt-1">This information appears on your receipts and PDF reports.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8">
                       {/* Profile Logo Upload */}
                       <div className="flex flex-col items-center gap-3">
                          <div 
                             onClick={() => fileInputRef.current?.click()} 
                             className={`w-32 h-32 bg-slate-50 border-2 border-dashed ${logoPreview ? 'border-transparent' : 'border-gray-300'} rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer overflow-hidden relative group`}
                          >
                             {logoPreview ? (
                                <>
                                   {/* eslint-disable-next-line @next/next/no-img-element */}
                                   <img src={logoPreview} alt="Clinic Logo" className="w-full h-full object-cover" />
                                   <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Edit3 size={24} className="text-white mb-1"/>
                                      <span className="text-[10px] text-white font-bold">Change Logo</span>
                                   </div>
                                </>
                             ) : (
                                <>
                                   <UploadCloud size={32} className="mb-2 group-hover:scale-110 transition-transform"/>
                                   <span className="text-[10px] font-semibold">Upload Logo</span>
                                </>
                             )}
                          </div>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                       </div>
                       
                       <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="sm:col-span-2">
                             <label className="block text-xs font-bold text-gray-600 mb-1.5">Clinic Name</label>
                             <div className="relative">
                               <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                               <input type="text" defaultValue="M.T. Olaso Optical Clinic" className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} />
                             </div>
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-gray-600 mb-1.5">Email Address</label>
                             <div className="relative">
                               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                               <input type="email" defaultValue="hello@mtolaso.com" className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} />
                             </div>
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-gray-600 mb-1.5">Phone Number</label>
                             <div className="relative">
                               <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                               <input type="text" defaultValue="+63 917 123 4567" className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none`} />
                             </div>
                          </div>
                          <div className="sm:col-span-2">
                             <label className="block text-xs font-bold text-gray-600 mb-1.5">Complete Address</label>
                             <div className="relative">
                               <MapPin className="absolute left-3 top-3 text-gray-400" size={16}/>
                               <textarea rows={3} defaultValue="123 Rizal Avenue, Olongapo City, Zambales, Philippines" className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none resize-none`} />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                       <button onClick={handleSaveProfile} className={`flex items-center gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all`}>
                          <Save size={16}/> Save Profile
                       </button>
                    </div>
                 </motion.div>
               )}

               {/* --- TAB 2: USER MANAGEMENT (STAFF) --- */}
               {activeTab === 'users' && (
                 <motion.div key="users" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col h-full">
                    <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center gap-4 bg-slate-50/50">
                       <div>
                          <h2 className="text-lg font-bold text-gray-800">Staff Accounts</h2>
                          <p className="text-xs text-gray-500 mt-1">Manage system access and roles for your employees.</p>
                       </div>
                       <button onClick={openAddUserModal} className={`flex items-center justify-center gap-2 ${THEME_BG} ${THEME_HOVER} text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all shrink-0`}>
                          <Plus size={16}/> <span className="hidden sm:inline">Add Staff</span><span className="sm:hidden">Add</span>
                       </button>
                    </div>

                    <div className="flex-1 p-0 sm:p-2 overflow-x-auto">
                       <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap min-w-[600px]">
                          <thead className="text-gray-400 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                             <tr>
                                <th className="p-4 sm:p-5">User Info</th>
                                <th className="p-4 sm:p-5">Role</th>
                                <th className="p-4 sm:p-5">Status</th>
                                <th className="p-4 sm:p-5 text-right">Actions</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                             {users.length === 0 ? (
                                <tr>
                                   <td colSpan={4} className="p-8 text-center text-gray-400">
                                      No staff members found. Add one above.
                                   </td>
                                </tr>
                             ) : (
                                users.map((user) => (
                                   <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                      <td className="p-4 sm:p-5">
                                         <div className="font-bold text-gray-800">{user.name}</div>
                                         <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{user.email}</div>
                                      </td>
                                      <td className="p-4 sm:p-5">
                                         <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                            {user.role}
                                         </span>
                                      </td>
                                      <td className="p-4 sm:p-5">
                                         <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <span className="font-medium text-gray-600">{user.status}</span>
                                         </div>
                                         <div className="text-[9px] text-gray-400 mt-1">Last Login: {user.lastLogin}</div>
                                      </td>
                                      <td className="p-4 sm:p-5 text-right">
                                         <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEditUserModal(user)} className="p-1.5 sm:p-2 text-gray-400 hover:text-[#0B3C8A] hover:bg-blue-50 rounded-lg transition-colors" title="Edit User">
                                               <Edit3 size={16}/>
                                            </button>
                                            <button onClick={() => openDeleteModal(user)} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete User">
                                               <Trash2 size={16}/>
                                            </button>
                                         </div>
                                      </td>
                                   </tr>
                                ))
                             )}
                          </tbody>
                       </table>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </main>
        </div>
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
                <button onClick={() => setIsUserModalOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"><X size={18} className="text-gray-500" /></button>
              </div>
              
              <form id="user-form" onSubmit={handleSaveUser} className="p-5 sm:p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Full Name</label>
                    <input 
                      required 
                      name="name" 
                      value={userForm.name} 
                      onChange={handleUserFormChange}
                      type="text" 
                      placeholder="e.g. John Doe" 
                      className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none bg-slate-50`} 
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Email / Username</label>
                    <input 
                      required 
                      name="email" 
                      value={userForm.email} 
                      onChange={handleUserFormChange}
                      type="email" 
                      placeholder="john@clinic.com" 
                      className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none bg-slate-50`} 
                    />
                 </div>
                 
                 {modalMode === "add" && (
                    <div>
                       <label className="block text-xs font-bold text-gray-600 mb-1.5">Temporary Password</label>
                       <input 
                         required 
                         name="password" 
                         value={userForm.password} 
                         onChange={handleUserFormChange}
                         type="password" 
                         placeholder="••••••••" 
                         className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none bg-slate-50`} 
                       />
                    </div>
                 )}

                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">System Role</label>
                    <select 
                      required 
                      name="role" 
                      value={userForm.role} 
                      onChange={handleUserFormChange}
                      className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 ${THEME_RING} focus:outline-none bg-slate-50 cursor-pointer`}
                    >
                       <option value="Staff">Staff</option>
                       <option value="Admin">Admin</option>
                    </select>
                 </div>
              </form>

              <div className="p-4 sm:p-5 border-t border-gray-100 bg-slate-50 flex gap-3">
                 <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors">Cancel</button>
                 <button type="submit" form="user-form" className={`flex-1 px-4 py-2.5 rounded-xl ${THEME_BG} text-white text-sm font-bold ${THEME_HOVER} transition-colors shadow-sm`}>
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
                  <Trash2 className="text-red-600 w-6 h-6" />
               </div>
               <h3 className="text-lg font-black text-gray-900 mb-2">Remove Staff Member?</h3>
               <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                 Are you sure you want to delete <span className="font-bold text-gray-800">{userToDelete.name}</span>? They will immediately lose access to the system.
               </p>
               <div className="flex gap-3">
                  <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={confirmDeleteUser} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-sm">Yes, Remove</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- HELPER COMPONENT FOR SIDEBAR BUTTONS ---
function NavButton({ icon: Icon, label, isActive, onClick }: { icon: any, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap
        ${isActive 
          ? `bg-[#0B3C8A] text-white shadow-md shadow-blue-900/20` 
          : `bg-transparent text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm border border-transparent hover:border-gray-200`
        }
      `}
    >
      <Icon size={18} className={isActive ? "text-blue-200" : "text-gray-400"} />
      {label}
    </button>
  );
}
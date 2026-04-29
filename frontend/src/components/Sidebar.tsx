// src/components/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  LogOut,
  LayoutDashboard,
  Boxes,
  Users,
  BarChart3,
  X,
  History,
} from "lucide-react";

import Notifications from "@/components/Notifications";
import BackupStatus from "@/components/BackupStatus";
import ExpiryAlert from "@/components/ExpiryAlert";
import { useFirebase } from "@/context/FirebaseContext";

// NO import of SettingsModal

interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();
  const { appUser, logout } = useFirebase();

  const [open, setOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // NO showSettingsModal state

  const linkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
      pathname === path
        ? "bg-[#0B3C8A]/10 text-[#0B3C8A] font-bold"
        : "text-gray-600 hover:bg-gray-100 hover:text-[#0B3C8A]"
    }`;

  const handleLogout = async () => {
    setShowLogoutModal(false);
    setIsLoggingOut(true);
    await logout();
  };

  const displayName = appUser?.name || appUser?.email?.split('@')[0] || "User";
  const displayRole = appUser?.role === "admin" ? "Administrator" : "Staff";
  const roleColorClass = appUser?.role === "admin" ? "text-purple-500" : "text-green-500";

  return (
    <>
      <div className="min-h-screen bg-gray-100">
        {/* HEADER */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm px-4 md:px-6 py-3 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button onClick={() => setOpen(!open)} className="text-gray-600 hover:text-[#0B3C8A] transition-colors">
              <Menu size={24} />
            </button>
            <Image src="/logo.png?v=1" alt="MT Olaso Logo" width={34} height={34} />
            <h1 className="text-lg font-bold text-[#0B3C8A] hidden sm:block">OlasoSync</h1>
          </div>

          {/* RIGHT - No Settings button */}
          <div className="flex items-center gap-3 relative">
            <BackupStatus />
            <Notifications />
            
            <div className="hidden sm:flex flex-col items-end bg-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-sm font-semibold text-gray-700 leading-none">{displayName}</span>
              <span className={`text-[10px] tracking-wide ${roleColorClass}`}>{displayRole}</span>
            </div>
            
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* SIDEBAR */}
        <aside className={`fixed top-16 left-0 z-40 h-[calc(100vh-64px)] w-64 bg-white shadow-md transition-transform duration-300 ease-in-out border-r border-gray-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <nav className="px-4 py-6 space-y-2">
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
            <Link href="/inventory" className={linkClass("/inventory")}>
              <Boxes size={18} /> Inventory
            </Link>
            <Link href="/sales" className={linkClass("/sales")}>
              <span className="text-[18px] font-bold leading-none flex items-center justify-center w-4.5">₱</span> Sales
            </Link>

            {appUser?.role === "admin" && (
              <Link href="/reports" className={linkClass("/reports")}>
                <BarChart3 size={18} /> Reports
              </Link>
            )}
            
            {appUser?.role === "admin" && (
              <Link href="/activity-logs" className={linkClass("/activity-logs")}>
                <History size={18} /> Activity Logs
              </Link>
            )}
            
            {appUser?.role === "admin" && (
              <Link href="/settings" className={linkClass("/settings")}>
                <Users size={18} /> Staff Management
              </Link>
            )}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className={`w-2 h-2 rounded-full ${appUser?.role === "admin" ? "bg-purple-500" : "bg-green-500"}`} />
              <span>Logged in as {displayRole}</span>
            </div>
          </div>
        </aside>

        <main className={`pt-16 p-6 transition-all duration-300 ${open ? "md:ml-64" : "md:ml-0"}`}>
          {children}
        </main>
      </div>

      <ExpiryAlert />

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm z-[101]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Confirm Logout</h3>
              <button onClick={() => setShowLogoutModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleLogout} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoggingOut && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-b-transparent"></div>
            <p className="text-white font-medium">Logging out...</p>
          </div>
        </div>
      )}
    </>
  );
}
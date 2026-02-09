"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  LogOut,
  LayoutDashboard,
  Boxes,
  X,
} from "lucide-react";

import Notifications from "@/components/Notifications"; 

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const linkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
      pathname === path
        ? "bg-[#0B3C8A]/10 text-[#0B3C8A] font-bold"
        : "text-gray-600 hover:bg-gray-100 hover:text-[#0B3C8A]" // Hover state
    }`;

  const handleLogout = () => {
    setShowLogoutModal(false);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm px-4 md:px-6 py-3 flex items-center justify-between h-16">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button onClick={() => setOpen(!open)} className="text-gray-600 hover:text-[#0B3C8A] transition-colors">
            <Menu size={24} />
          </button>

          <Image src="/logo.png" alt="Clinic Logo" width={34} height={34} />

          {/* CHANGED: Updated Title */}
          <h1 className="text-lg font-bold text-[#0B3C8A] hidden sm:block">
            M.T. Olaso Optical Clinic
          </h1>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4 relative">
          
          {/* NOTIFICATION DROPDOWN */}
          <Notifications />

          <div className="hidden sm:flex flex-col items-end mr-2">
             <span className="text-sm font-semibold text-gray-700 leading-none">Staff User</span>
             <span className="text-[10px] text-gray-500 tracking-wide">Staff</span>
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
      <aside
        className={`fixed top-[64px] left-0 z-40 h-[calc(100vh-64px)] w-64 bg-white shadow-md transition-transform duration-300 ease-in-out border-r border-gray-200
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <nav className="px-4 py-6 space-y-2">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            <LayoutDashboard size={18} />
            Dashboard
          </Link>

          <Link href="/inventory" className={linkClass("/inventory")}>
            <Boxes size={18} />
            Inventory
          </Link>

          <Link href="/sales" className={linkClass("/sales")}>
            <span className="text-[18px] font-bold leading-none flex items-center justify-center w-[18px]">₱</span>
            Sales
          </Link>
        </nav>
      </aside>

      {/* MAIN */}
      <main
        className={`pt-[64px] p-6 transition-all duration-300
        ${open ? "md:ml-64" : "md:ml-0"}`}
      >
        {children}
      </main>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Confirm Logout</h3>
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
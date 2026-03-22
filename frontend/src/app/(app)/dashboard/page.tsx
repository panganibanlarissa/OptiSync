// src/app/(app)/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/context/FirebaseContext";
import AdminDashboard from "./AdminDashboard";
import StaffDashboard from "./StaffDashboard";


export default function DashboardPage() {
  const router = useRouter();
  const { user, userRole, loading } = useFirebase();

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // Render role-based dashboard
  if (userRole === "admin") {
    return <AdminDashboard />;
  } else if (userRole === "staff") {
    return <StaffDashboard />;
  }

  // Fallback if role is not recognized
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading Dashboard...</h1>
        <p className="text-gray-500">Unable to determine user role.</p>
      </div>
    </div>
  );
}
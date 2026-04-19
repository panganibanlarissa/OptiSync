// src/components/AuthWrapper.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFirebase } from "@/context/FirebaseContext";

const publicPaths = ['/login', '/', '/landing'];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading, logout } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Debug logging (remove after fixing)
    console.log('🔐 AuthWrapper Debug:', {
      loading,
      hasUser: !!user,
      hasAppUser: !!appUser,
      userEmail: user?.email,
      userEmailVerified: user?.emailVerified,
      appUserStatus: appUser?.status,
      appUserEmailVerified: appUser?.emailVerified,
      pathname,
    });

    // Don't do anything while loading
    if (loading) return;

    // Allow Firebase Auth action handlers to pass through
    const isActionPath = pathname?.startsWith('/__/auth/action');
    const isPublicPath = publicPaths.includes(pathname || '') || isActionPath;
    
    // If no user and not on public path, redirect to login
    if (!user && !isPublicPath) {
      console.log('🔐 No user, redirecting to login');
      router.push('/login');
      return;
    }
    
    // If user exists but no appUser yet, wait (don't redirect)
    if (user && !appUser) {
      console.log('🔐 User exists but no appUser yet, waiting...');
      return;
    }
    
    // Handle deactivated/deleted users
    if (user && appUser && (appUser.status === 'Inactive' || appUser.status === 'Deleted')) {
      console.log('🔐 User deactivated/deleted, logging out');
      logout();
      router.push('/login');
      return;
    }
    
    // Handle email verification - ONLY block if explicitly marked as unverified in Firestore
    // AND Firebase Auth also shows unverified
    if (user && appUser && appUser.emailVerified === false && user.emailVerified === false) {
      console.log('🔐 Email not verified, redirecting to login with pending message');
      logout();
      router.push('/login?verification=pending');
      return;
    }
    
    // If user is logged in and on public path, redirect to dashboard
    if (user && isPublicPath && !isActionPath) {
      console.log('🔐 User logged in on public path, redirecting to dashboard');
      router.push('/dashboard');
      return;
    }
    
    console.log('🔐 Auth check passed, rendering children');
    
  }, [user, appUser, loading, pathname, router, logout]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // Show loading spinner for users who are being redirected
  const isActionPath = pathname?.startsWith('/__/auth/action');
  const isPublicPath = publicPaths.includes(pathname || '') || isActionPath;
  
  if (user && isPublicPath && !isActionPath) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // Show loading spinner for deactivated/deleted users or unverified accounts (they're being redirected)
  if (user && appUser && (appUser.status === 'Inactive' || appUser.status === 'Deleted' || appUser.emailVerified === false)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // If no user and on public path, render children (login page)
  if (!user && isPublicPath) {
    return <>{children}</>;
  }

  // If user exists and appUser exists and everything is verified, render children
  if (user && appUser && appUser.emailVerified !== false) {
    return <>{children}</>;
  }

  // Fallback: show loading spinner
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
    </div>
  );
}
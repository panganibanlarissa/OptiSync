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
    if (loading) return;

    const isActionPath = pathname?.startsWith('/__/auth/action');
    const isPublicPath = publicPaths.includes(pathname || '') || isActionPath;

    if (!user && !isPublicPath) {
      router.push('/login');
      return;
    }

    if (user && !appUser) {
      return;
    }

    if (
      user &&
      appUser &&
      (appUser.status === 'Inactive' || appUser.status === 'Deleted') &&
      !isPublicPath
    ) {
      logout();
      router.push('/login');
      return;
    }

    if (
      user &&
      appUser &&
      appUser.emailVerified === false &&
      user.emailVerified === false &&
      !isPublicPath
    ) {
      logout();
      router.push('/login?verification=pending');
      return;
    }

    if (user && isPublicPath && !isActionPath) {
      router.push('/dashboard');
      return;
    }
  }, [user, appUser, loading, pathname, router, logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  const isActionPath = pathname?.startsWith('/__/auth/action');
  const isPublicPath = publicPaths.includes(pathname || '') || isActionPath;

  if (user && isPublicPath && !isActionPath) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  if (
    user &&
    appUser &&
    (appUser.status === 'Inactive' || appUser.status === 'Deleted' || appUser.emailVerified === false) &&
    !isPublicPath
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  if (!user && isPublicPath) {
    return <>{children}</>;
  }

  if (
    user &&
    appUser &&
    (appUser.status === 'Inactive' || appUser.status === 'Deleted' || appUser.emailVerified === false) &&
    isPublicPath
  ) {
    return <>{children}</>;
  }

  if (user && appUser && appUser.emailVerified !== false) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
    </div>
  );
}
// src/components/AuthWrapper.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFirebase } from "@/context/FirebaseContext";

const publicPaths = ['/login', '/', '/landing'];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading, logout } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const [showDeactivatedMessage, setShowDeactivatedMessage] = useState(false);

  useEffect(() => {
    if (!loading) {
      const isPublicPath = publicPaths.includes(pathname);
      
      // Handle deactivated/deleted users
      if (user && appUser && (appUser.status === 'Inactive' || appUser.status === 'Deleted')) {
        // Force logout
        logout();
        setShowDeactivatedMessage(true);
        router.push('/login');
        return;
      }
      
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && isPublicPath) {
        router.push('/dashboard');
      }
    }
  }, [user, appUser, loading, pathname, router, logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // Don't render anything for deactivated/deleted users (they're being redirected)
  if (user && appUser && (appUser.status === 'Inactive' || appUser.status === 'Deleted')) {
    return null;
  }

  return <>{children}</>;
}
// src/components/AuthWrapper.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFirebase } from "@/context/FirebaseContext";

const publicPaths = ['/login', '/', '/landing'];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      const isPublicPath = publicPaths.includes(pathname);
      
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && isPublicPath) {
        router.push('/dashboard');
      } else if (user && appUser?.status === 'Inactive') {
        // Log out inactive users
        router.push('/login?error=inactive');
      }
    }
  }, [user, appUser, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3C8A]"></div>
      </div>
    );
  }

  // Don't render anything for inactive users
  if (user && appUser?.status === 'Inactive') {
    return null;
  }

  return <>{children}</>;
}
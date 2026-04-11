'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import OfflineBanner from '@/components/OfflineBanner';
import { useAuth } from '@/context/AuthContext';
import { FARMER_ALLOWED_PREFIXES } from '@/lib/navigation';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-app px-6">
      <div className="glass rounded-2xl border border-border-glass px-6 py-5 text-sm text-foreground-muted shadow-premium">
        Loading authentication...
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user && pathname !== '/login') {
      router.replace('/login');
      return;
    }

    if (user && pathname === '/login') {
      router.replace(user.role === 'farmer' ? '/farmer/requests' : '/');
      return;
    }

    if (user?.role === 'farmer' && !FARMER_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      router.replace('/farmer/requests');
    }
  }, [isLoading, pathname, router, user]);

  if (isLoading) return <LoadingScreen />;

  if (!user && pathname !== '/login') return <LoadingScreen />;

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background-app">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 lg:ml-[292px]">
        <Header />
        <main className="flex-1 px-4 pt-20 pb-8 md:px-6 lg:px-8 lg:pt-[104px]">
          <OfflineBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

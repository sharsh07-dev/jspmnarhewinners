'use client';

import React, { useEffect } from 'react';
import { LogOut, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { getRoleNavItems, isNavItemActive } from '@/lib/navigation';

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { isOpen, close } = useSidebar();
  const activeNavItems = getRoleNavItems(user?.role);

  useEffect(() => {
    const body = document.body;
    if (isOpen) {
      body.classList.add('overflow-hidden');
    } else {
      body.classList.remove('overflow-hidden');
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      body.classList.remove('overflow-hidden');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, isOpen]);

  const handleLogout = () => {
    logout();
    close();
    router.replace('/login');
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-full w-[280px] flex flex-col p-5 z-[100]
          bg-background-card/92 backdrop-blur-2xl border-r border-border-glass shadow-[0_24px_60px_rgba(31,52,38,0.12)]
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:left-4 lg:top-4 lg:h-[calc(100vh-32px)] lg:rounded-[28px] lg:border lg:border-border-glass lg:translate-x-0
        `}
      >
        {/* Logo + close btn (mobile only) */}
        <div className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary shadow-[0_10px_25px_rgba(47,133,90,0.12)]">
              <ShieldCheck className="text-primary" />
            </div>
            <span className="font-outfit text-2xl font-bold tracking-tighter text-foreground-main">
              CropShield{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary">
                AI
              </span>
            </span>
          </div>
          <button
            onClick={close}
            className="lg:hidden p-1.5 rounded-md text-foreground-dim hover:text-primary hover:bg-primary/5 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {activeNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-4 p-4 px-5 rounded-2xl font-semibold text-base transition-all duration-300 no-underline relative overflow-hidden group
                  ${isActive
                      ? 'text-white bg-primary shadow-[0_18px_30px_rgba(47,133,90,0.22)] border border-primary/10'
                      : 'text-foreground-muted hover:text-foreground-main hover:bg-primary/5 hover:translate-x-1'
                  }`}
              >
                  <Icon size={20} className={`${isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-foreground-dim'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="absolute left-0 top-0 h-full w-0 bg-white/10 group-active:w-full transition-all duration-300" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full bg-transparent border-none cursor-pointer text-red-600 font-inherit flex items-center gap-4 p-4 px-5 rounded-2xl font-semibold transition-all duration-300 hover:bg-red-500/10 hover:text-red-700 hover:scale-[0.99]"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

'use client';

import React, { useMemo, useState } from 'react';
import { Bell, Search, User, Grid, Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { getRoleNavItems } from '@/lib/navigation';

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const name = user?.name ?? 'User';
  const roleLabel = user?.role === 'farmer' ? 'Farmer' : 'Claims Auditor';
  const searchItems = getRoleNavItems(user?.role);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return searchItems.slice(0, 6);
    return searchItems
      .filter((item) => item.label.toLowerCase().includes(query) || item.href.toLowerCase().includes(query))
      .slice(0, 6);
  }, [searchItems, searchText]);

  const listboxId = 'header-nav-suggestions';

  const navigateTo = (href: string) => {
    setSearchOpen(false);
    setSearchText('');
    setHighlightedIndex(0);
    if (pathname !== href) {
      router.push(href);
    }
  };

  return (
    <header className="
      h-16 md:h-[72px]
      fixed top-0 left-0 right-0
      lg:top-4 lg:right-4 lg:left-[296px]
      flex items-center justify-between
      px-4 md:px-8
      z-[90]
      bg-background-card/90 backdrop-blur-2xl
      border-b border-border-glass
      shadow-[0_16px_40px_rgba(31,52,38,0.08)]
      lg:rounded-[28px] lg:border lg:border-border-glass
    ">
      {/* Left: hamburger (mobile) + search (desktop) */}
      <div className="flex items-center gap-3 flex-1">
        {/* Hamburger — only on mobile */}
        <button
          onClick={toggle}
          className="lg:hidden p-2 rounded-md text-foreground-muted hover:text-primary hover:bg-primary/5 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>

        {/* Logo text on mobile (sidebar is hidden) */}
        <span className="font-outfit text-lg font-bold tracking-tighter text-primary lg:hidden">
          CropShield <span className="bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary">AI</span>
        </span>

        {/* Search bar — hidden on small screens */}
        <div className="hidden md:block relative w-[320px] xl:w-[420px]">
          <div className="flex items-center gap-3 bg-white/90 border border-border-glass px-4 py-2.5 rounded-2xl transition-all duration-300 focus-within:border-primary/30 focus-within:shadow-[0_12px_30px_rgba(47,133,90,0.10)] shadow-[0_4px_16px_rgba(47,86,61,0.05)]">
            <Search className="text-foreground-dim shrink-0" size={18} />
            <input
              type="text"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setSearchOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => {
                setSearchOpen(true);
                setHighlightedIndex(0);
              }}
              onBlur={() => window.setTimeout(() => {
                setSearchOpen(false);
                setHighlightedIndex(0);
              }, 120)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  if (!searchOpen) {
                    setSearchOpen(true);
                    setHighlightedIndex(0);
                    return;
                  }
                  setHighlightedIndex((prev) => (prev + 1) % Math.max(filteredItems.length, 1));
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (!searchOpen) {
                    setSearchOpen(true);
                    setHighlightedIndex(0);
                    return;
                  }
                  setHighlightedIndex((prev) => (prev - 1 + Math.max(filteredItems.length, 1)) % Math.max(filteredItems.length, 1));
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setSearchOpen(false);
                  setHighlightedIndex(0);
                  return;
                }
                if (event.key === 'Enter' && filteredItems.length > 0) {
                  event.preventDefault();
                  const selected = filteredItems[Math.min(highlightedIndex, filteredItems.length - 1)];
                  navigateTo(selected.href);
                }
              }}
              placeholder="Quick navigate to pages..."
              className="bg-transparent border-none text-foreground-main w-full outline-none text-sm font-inter"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
            />
          </div>

          {searchOpen ? (
            <div id={listboxId} role="listbox" className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl border border-border-glass bg-white/96 shadow-[0_20px_40px_rgba(38,48,32,0.14)] p-2 z-[120]">
              {filteredItems.length === 0 ? (
                <p className="px-3 py-2 text-sm text-foreground-muted">No matching pages.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredItems.map((item, index) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => navigateTo(item.href)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      role="option"
                      aria-selected={index === highlightedIndex}
                      className={`text-left rounded-lg px-3 py-2 text-sm text-foreground-main ${index === highlightedIndex ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span className="ml-2 text-xs text-foreground-muted">{item.href}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3 md:gap-6">
        <button className="relative bg-transparent border-none text-foreground-muted cursor-pointer transition-all duration-200 p-1.5 rounded-md hover:text-primary hover:bg-primary/5">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
        </button>
        <button className="hidden sm:block relative bg-transparent border-none text-foreground-muted cursor-pointer transition-all duration-200 p-1.5 rounded-md hover:text-primary hover:bg-primary/5">
          <Grid size={20} />
        </button>
        <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-primary/10 cursor-pointer">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-semibold text-foreground-main leading-tight">{name}</span>
            <span className="text-[10px] text-foreground-dim uppercase tracking-wider font-bold">{roleLabel}</span>
          </div>
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_20px_rgba(47,133,90,0.12)] text-white">
            {user?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt={name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <User size={18} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

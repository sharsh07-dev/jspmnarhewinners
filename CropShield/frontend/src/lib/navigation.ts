import {
  BarChart3,
  Bot,
  CloudSun,
  FileText,
  MessageSquare,
  ScanSearch,
  Settings,
  Sparkles,
  Sprout,
  TrendingUp,
  UserCog,
  LayoutDashboard,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: BarChart3, label: 'Analysis', href: '/analysis' },
  { icon: UserCog, label: 'Admin', href: '/admin' },
];

const FARMER_NAV_ITEMS: NavItem[] = [
  { icon: FileText, label: 'Farmer Requests', href: '/farmer/requests' },
];

export const FARMER_ALLOWED_PREFIXES = [
  '/farmer',
  '/analysis',
  ...Array.from(new Set(FARMER_NAV_ITEMS.map((item) => item.href))),
];

export function getRoleNavItems(role: string | undefined): NavItem[] {
  return role === 'farmer' ? FARMER_NAV_ITEMS : ADMIN_NAV_ITEMS;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

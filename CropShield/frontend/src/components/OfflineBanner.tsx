'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="inline-flex items-start gap-2">
        <WifiOff size={16} className="mt-0.5" />
        <p>You appear to be offline - data may be stale.</p>
      </div>
    </div>
  );
}

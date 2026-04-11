'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="glass rounded-xl border border-red-300/60 bg-red-50/80 px-4 py-3 text-sm text-red-700">
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <p>{message}</p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Tractor } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loginAdmin, loginFarmerWithGoogleCredential, loginDemoFarmer } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFieldErrors, setAdminFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  const canUseGoogle = googleClientId.trim().length > 0;

  useEffect(() => {
    if (user) {
      router.replace(user.role === 'farmer' ? '/farmer/requests' : '/');
    }
  }, [router, user]);

  useEffect(() => {
    if (!canUseGoogle) return;

    const existingScript = document.getElementById('google-identity-script');
    const mountGoogle = () => {
      const buttonContainer = document.getElementById('google-signin-button');
      if (!buttonContainer || !window.google?.accounts?.id) return;
      buttonContainer.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void (async () => {
            const result = await loginFarmerWithGoogleCredential(response.credential);
            if (!result.success) {
              setMessage(result.message ?? 'Google login failed.');
            }
          })();
        },
      });
      window.google.accounts.id.renderButton(buttonContainer, {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: activeTab === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'pill',
      });
    };

    if (existingScript) {
      mountGoogle();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = mountGoogle;
    document.head.appendChild(script);
  }, [activeTab, canUseGoogle, googleClientId, loginFarmerWithGoogleCredential]);

  const farmerSubtitle = useMemo(() => {
    return activeTab === 'signup'
      ? 'New farmer? Create your account with Google in one click.'
      : 'Farmer login using Google account.';
  }, [activeTab]);

  const handleAdminSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const nextErrors: { username?: string; password?: string } = {};
    if (!adminUsername.trim()) {
      nextErrors.username = 'Username is required.';
    }
    if (!adminPassword.trim()) {
      nextErrors.password = 'Password is required.';
    }
    setAdminFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    const result = await loginAdmin(adminUsername, adminPassword);
    if (!result.success) {
      setMessage(result.message ?? 'Admin login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-background-app flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">
        <section className="feed-card p-8">
          <p className="section-heading mb-2">Secure Access</p>
          <h1 className="page-title gradient-text">CropShield AI Access</h1>
          <p className="page-description mt-3 mb-6">
            Sign in to continue. Admin and farmer access are verified by the backend.
          </p>

          <div className="inline-flex rounded-2xl border border-border-glass bg-white/80 p-1 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                activeTab === 'login' ? 'bg-primary text-white' : 'text-foreground-main hover:bg-primary/5'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                activeTab === 'signup' ? 'bg-primary text-white' : 'text-foreground-main hover:bg-primary/5'
              }`}
            >
              Sign Up
            </button>
          </div>

          {message ? (
            <div className="mb-4 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4">
            <article className="rounded-2xl border border-border-glass bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground-main">Admin Login</h2>
              </div>
              <p className="text-xs text-foreground-dim mb-3">Use: username admin, password admin</p>
              <form onSubmit={handleAdminSubmit} className="grid gap-2">
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => {
                    setAdminUsername(e.target.value);
                    setAdminFieldErrors((prev) => ({ ...prev, username: undefined }));
                  }}
                  placeholder="Username"
                  className="control-input w-full rounded-2xl px-3 py-2 text-sm outline-none"
                />
                {adminFieldErrors.username ? (
                  <p className="text-xs text-red-700">{adminFieldErrors.username}</p>
                ) : null}
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setAdminFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Password"
                  className="control-input w-full rounded-2xl px-3 py-2 text-sm outline-none"
                />
                {adminFieldErrors.password ? (
                  <p className="text-xs text-red-700">{adminFieldErrors.password}</p>
                ) : null}
                <button type="submit" className="btn-premium w-full">
                  Login as Admin
                </button>
              </form>
            </article>

            <article className="rounded-2xl border border-border-glass bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Tractor size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground-main">
                  {activeTab === 'signup' ? 'Farmer Sign Up' : 'Farmer Login'}
                </h2>
              </div>
              <p className="text-xs text-foreground-dim mb-3">{farmerSubtitle}</p>
              {canUseGoogle ? (
                <div id="google-signin-button" className="min-h-11" />
              ) : (
                <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Google login needs NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend environment.
                </div>
              )}
              <div className="mt-4 border-t border-border-glass pt-4">
                <button
                  onClick={async () => {
                    const result = await loginDemoFarmer('user@example.com');
                    if (!result.success) {
                      setMessage(result.message ?? 'Demo login failed.');
                    }
                  }}
                  className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold py-2 rounded-xl text-sm transition-all"
                >
                  Demo Farmer Login (user@example.com)
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="feed-card p-8 flex flex-col justify-between">
          <div>
            <p className="section-heading mb-2">Role-based Entry</p>
            <h2 className="page-title text-2xl">Account Overview</h2>
            <ul className="text-sm text-foreground-muted space-y-2">
              <li>Admin: full dashboard, analysis, and review workflow.</li>
              <li>Farmer: access to farmer requests and claim submission flow.</li>
              <li>Session persists in browser until logout.</li>
            </ul>
          </div>
          <p className="text-xs text-foreground-dim mt-8">
            Security note: authentication now runs through the backend and stores a JWT in the browser.
          </p>
        </section>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const turnstileSiteKey = (import.meta as any).env?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!turnstileSiteKey) return;

    let intervalId: any = null;

    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current && !widgetIdRef.current) {
        try {
          // Clear any stale child elements
          turnstileContainerRef.current.innerHTML = '';
          widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: turnstileSiteKey,
            theme: 'light',
            callback: (token: string) => {
              setTurnstileToken(token);
              setError(null);
            },
            'expired-callback': () => {
              setTurnstileToken(null);
            },
            'error-callback': () => {
              console.warn('[Cloudflare Turnstile] Challenge error or hostname unverified.');
            }
          });
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        } catch (e) {
          console.error('[Cloudflare Turnstile] Render error:', e);
        }
      }
    };

    // Dynamically load Cloudflare Turnstile script if not already loaded
    const scriptId = 'cloudflare-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderWidget();
      };
      document.body.appendChild(script);
    } else {
      renderWidget();
    }

    // Polling fallback to guarantee rendering when window.turnstile initializes
    intervalId = setInterval(() => {
      if (window.turnstile && !widgetIdRef.current) {
        renderWidget();
      }
    }, 200);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {}
      }
    };
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (turnstileSiteKey && !turnstileToken) {
      setError('Please complete the Cloudflare security verification.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password, turnstileToken || undefined);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
      // Reset Turnstile on failed login
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background ambient glow matching codrix.co.in */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#7C2CF5]/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full bg-white border border-[#E7E0FB] rounded-3xl shadow-2xl shadow-[#7C2CF5]/10 p-8 relative z-10">
        {/* Header with Official Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#F6F3FF] border border-[#E7E0FB] shadow-inner mb-3">
            <img
              src="/logo-icon.png"
              alt="CodRix Official Logo"
              className="w-14 h-14 object-contain drop-shadow-sm"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-[#120E24] tracking-tight flex items-center justify-center gap-1.5">
            <span>CodRix</span>
            <span className="w-2 h-2 rounded-full bg-[#7C2CF5]"></span>
          </h2>
          <p className="text-xs text-[#585172] mt-1 font-semibold">Multi-Tenant Enterprise Operating System</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5] focus:ring-1 focus:ring-[#7C2CF5] font-medium transition"
                placeholder="name@codrix.co.in"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5] focus:ring-1 focus:ring-[#7C2CF5] font-medium transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-2.5 text-[#585172] hover:text-[#7C2CF5] transition p-0.5 rounded-md focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile Smart Challenge (Rendered when site key is configured) */}
          {turnstileSiteKey && (
            <div className="flex flex-col items-center justify-center my-3">
              <div ref={turnstileContainerRef} className="min-h-[65px] flex items-center justify-center" />
              <div className="flex items-center gap-1.5 text-[10px] text-[#585172] mt-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Protected by Cloudflare Turnstile Authentication</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#7C2CF5]/30 hover:shadow-[#7C2CF5]/50 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>

        {/* Security Footer Badge */}
        <div className="mt-6 pt-4 border-t border-[#E7E0FB] flex items-center justify-between text-[10px] text-[#585172]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Cloudflare Edge SSL Active</span>
          </div>
          <span className="font-semibold text-[#7C2CF5]">
            connect.codrix.co.in
          </span>
        </div>
      </div>
    </div>
  );
};

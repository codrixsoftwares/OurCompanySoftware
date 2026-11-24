import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import {
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Save,
  ArrowLeft,
  User,
  KeyRound,
  Check
} from 'lucide-react';
import { workStateManager } from '../../core/workStateManager.js';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('LOGIN');

  // Login & Register Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reset Token State
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // UI status
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [timeoutNotice, setTimeoutNotice] = useState<any | null>(null);

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const turnstileSiteKey = (import.meta as any).env?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;

  // Check URL hash for direct reset-password links
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('reset-password')) {
      const urlParams = new URLSearchParams(hash.split('?')[1] || '');
      const token = urlParams.get('token');
      const emailParam = urlParams.get('email');
      if (token) {
        setResetToken(token);
        if (emailParam) setEmail(emailParam);
        setMode('RESET_PASSWORD');
      }
    }

    const notice = workStateManager.getTimeoutNotice();
    if (notice) {
      setTimeoutNotice(notice);
      if (notice.userEmail && !email) {
        setEmail(notice.userEmail);
      }
    }
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey) return;

    let intervalId: any = null;

    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current && !widgetIdRef.current) {
        try {
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
  }, [turnstileSiteKey, mode]);

  const resetFormState = () => {
    setError(null);
    setSuccessMsg(null);
  };

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (turnstileSiteKey && !turnstileToken) {
      setError('Please complete the Cloudflare security verification.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password, turnstileToken || undefined);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          turnstileToken
        })
      });

      if (res?.token) {
        localStorage.setItem('codrix_token', res.token);
        window.location.reload();
      } else {
        setSuccessMsg('Account created successfully! Please sign in with your credentials.');
        setMode('LOGIN');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setSuccessMsg(res.message || 'If an account exists with that email address, password reset instructions have been sent.');
    } catch (err: any) {
      setError(err.message || 'Failed sending password reset request');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          token: resetToken,
          newPassword
        })
      });
      setSuccessMsg(res.message || 'Password reset successfully! You can now log in.');
      setMode('LOGIN');
      setPassword('');
      window.location.hash = '';
    } catch (err: any) {
      setError(err.message || 'Failed resetting password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] flex items-center justify-center px-4 py-8 sm:px-6 lg:px-12"
      style={{
        background: 'linear-gradient(135deg, #130724 0%, #290B52 30%, #4A1286 65%, #7C2CF5 100%)'
      }}
    >
      {/* Dynamic ambient glow matching the logo's purple/violet gradient tones */}
      <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-[#9D5CFA]/25 blur-[160px] rounded-full pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-[600px] h-[600px] bg-[#7C2CF5]/30 blur-[160px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] bg-[#6366F1]/15 blur-[180px] rounded-full pointer-events-none"></div>

      {/* Main Grid Container: Form on the Left, Logo & "CodRix Connect" in Center on the Right */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center relative z-10">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: Clean Authentication Form Card               */}
        {/* ========================================================= */}
        <div className="order-2 lg:order-1 lg:col-span-6 flex items-center justify-center lg:justify-start w-full">
          <div className="max-w-md w-full bg-white border border-[#E7E0FB] rounded-3xl shadow-2xl shadow-black/25 p-7 sm:p-9 relative">
            
            {/* Form Card Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#7C2CF5] uppercase tracking-wider bg-[#F6F3FF] px-2.5 py-1 rounded-lg border border-[#E7E0FB]">
                  {mode === 'LOGIN' && 'Sign In'}
                  {mode === 'REGISTER' && 'Register'}
                  {mode === 'FORGOT_PASSWORD' && 'Recovery'}
                  {mode === 'RESET_PASSWORD' && 'Security'}
                </span>
                <span className="text-[11px] text-[#585172] font-semibold">Workspace Access</span>
              </div>
              <h2 className="text-2xl font-black text-[#120E24] tracking-tight">
                {mode === 'LOGIN' && 'Sign In to Workspace'}
                {mode === 'REGISTER' && 'Create Your Account'}
                {mode === 'FORGOT_PASSWORD' && 'Recover Password'}
                {mode === 'RESET_PASSWORD' && 'Set New Password'}
              </h2>
              <p className="text-xs text-[#585172] mt-1 font-medium">
                {mode === 'LOGIN' && 'Enter your authorized enterprise credentials to access your session.'}
                {mode === 'REGISTER' && 'Register your company email to request or activate access.'}
                {mode === 'FORGOT_PASSWORD' && 'Enter your registered email to receive a secure reset link.'}
                {mode === 'RESET_PASSWORD' && 'Choose a strong password with Argon2id protection.'}
              </p>
            </div>

            {/* 15-Minute Inactivity Session Notice Banner (Only shown on Login) */}
            {mode === 'LOGIN' && timeoutNotice && (
              <div className="mb-6 p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-amber-900 shadow-xs animate-in fade-in duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Session Logged Out (15m Inactivity)
                      </h4>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                        Auto-Protected
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Your session timed out after 15 minutes of inactivity to protect your workspace security.
                    </p>
                    <div className="p-2.5 rounded-xl bg-white/80 border border-amber-200/70 text-[11px] flex items-start gap-2">
                      <Save className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-emerald-800">Your last work was safely preserved:</span>
                        <div className="font-medium text-[#120E24] mt-0.5 italic">
                          "{timeoutNotice.summary || 'Active Workspace Session'}"
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1 pt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Log back in below to continue exactly where you left off.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Notification */}
            {successMsg && (
              <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* MODE: LOGIN */}
            {mode === 'LOGIN' && (
              <form onSubmit={handleLogin} className="space-y-4">
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#120E24] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setMode('FORGOT_PASSWORD');
                      }}
                      className="text-[11px] font-semibold text-[#7C2CF5] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
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
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

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

                <div className="text-center pt-2">
                  <span className="text-xs text-[#585172]">Need a new account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setMode('REGISTER');
                    }}
                    className="text-xs font-bold text-[#7C2CF5] hover:underline"
                  >
                    Register
                  </button>
                </div>
              </form>
            )}

            {/* MODE: REGISTER */}
            {mode === 'REGISTER' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="e.g. Alex Johnson"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

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
                      placeholder="name@codrix.co.in"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
                    Password (8+ chars, upper/lowercase, numbers & symbols)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#7C2CF5]/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>

                <div className="text-center pt-2">
                  <span className="text-xs text-[#585172]">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setMode('LOGIN');
                    }}
                    className="text-xs font-bold text-[#7C2CF5] hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {/* MODE: FORGOT PASSWORD */}
            {mode === 'FORGOT_PASSWORD' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-[#585172] leading-relaxed">
                  Enter your registered work email address below. We'll send you a secure, single-use reset link that expires in 15 minutes.
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
                    Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="name@codrix.co.in"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#7C2CF5]/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Sending Instructions...' : 'Send Password Reset Link'}</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setMode('LOGIN');
                    }}
                    className="text-xs font-bold text-[#585172] hover:text-[#120E24] inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}

            {/* MODE: RESET PASSWORD */}
            {mode === 'RESET_PASSWORD' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-[#585172] leading-relaxed">
                  Enter your new password below. It will be secured using production-grade Argon2id encryption.
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#7C2CF5] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#7C2CF5]/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Updating Password...' : 'Save New Password & Sign In'}</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setMode('LOGIN');
                      window.location.hash = '';
                    }}
                    className="text-xs font-bold text-[#585172] hover:text-[#120E24] inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            )}

            {/* Security Footer Badge */}
            <div className="mt-6 pt-4 border-t border-[#E7E0FB] flex items-center justify-between text-[10px] text-[#585172]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Argon2id Encrypted</span>
              </div>
              <span className="font-semibold text-[#7C2CF5]">
                connect.codrix.co.in
              </span>
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Logo, "CodRix", and "Connect" (In Center)   */}
        {/* ========================================================= */}
        <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col items-center justify-center text-center py-6 lg:py-12 space-y-6">
          
          {/* Logo container in center with ambient luminous backing */}
          <div className="relative group inline-block">
            <div className="absolute -inset-3 bg-gradient-to-r from-[#A855F7] via-[#C084FC] to-[#7C2CF5] rounded-3xl blur-2xl opacity-40 group-hover:opacity-70 transition duration-500"></div>
            <div className="relative p-5 sm:p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl flex items-center justify-center">
              <img
                src="/logo-icon.png"
                alt="CodRix Official Logo"
                className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Typography: "CodRix" and "Connect" in Center */}
          <div className="space-y-1.5 flex flex-col items-center justify-center text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none drop-shadow-lg">
              CodRix
            </h1>
            
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-[#E9D5FF] to-[#DDD0FE] bg-clip-text text-transparent drop-shadow-md">
                Connect
              </span>
              <span className="inline-block w-3 h-3 rounded-full bg-white/90 shadow-lg shadow-white/50 animate-pulse"></span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

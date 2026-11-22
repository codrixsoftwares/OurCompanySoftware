import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#7C2CF5]/30 hover:shadow-[#7C2CF5]/50 transition flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
};

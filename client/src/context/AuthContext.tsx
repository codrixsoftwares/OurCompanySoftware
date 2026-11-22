import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthSession, RoleCode } from '../types.js';
import { apiRequest } from '../api/client.js';

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  quickSwitchRole: (email: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: RoleCode[]) => boolean;
  isCoreTeam: boolean;
  isLakshay: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('codrix_token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest<AuthSession>('/auth/me')
      .then((data) => {
        setSession(data);
      })
      .catch(() => {
        localStorage.removeItem('codrix_token');
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string = 'Lakshay123') => {
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string } & AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('codrix_token', data.token);
      setSession(data);
    } finally {
      setLoading(false);
    }
  };

  const isLakshay = Boolean(
    session && (
      (session.user.email || '').toLowerCase().trim() === 'lakshay@codrix.co.in' ||
      (session.user.fullName || '').toLowerCase().trim() === 'lakshay'
    )
  );

  const quickSwitchRole = async (targetEmail: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to switch accounts or visit other user logins.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string } & AuthSession>('/auth/switch-account', {
        method: 'POST',
        body: JSON.stringify({ targetEmail })
      });
      localStorage.setItem('codrix_token', data.token);
      setSession(data);
    } catch (err: any) {
      alert(err.message || 'Failed switching account');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('codrix_token');
    setSession(null);
  };

  const hasRole = (...roles: RoleCode[]) => {
    if (!session) return false;
    if (session.roles.includes('COMPANY_ADMIN') || session.roles.includes('SUPER_ADMIN')) return true;
    return roles.some((r) => session.roles.includes(r));
  };

  const isCoreTeam = Boolean(
    session && (
      ['lakshay', 'anshuman', 'suryansh', 'parth', 'diya', 'ishita'].some((name) =>
        (session.user.fullName || '').toLowerCase().includes(name) ||
        (session.user.email || '').toLowerCase().includes(name)
      ) ||
      session.roles.includes('COMPANY_ADMIN') ||
      session.roles.includes('SUPER_ADMIN')
    )
  );

  return (
    <AuthContext.Provider value={{ session, loading, login, quickSwitchRole, logout, hasRole, isCoreTeam, isLakshay }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

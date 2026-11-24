import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AuthSession, RoleCode } from '../types.js';
import { apiRequest } from '../api/client.js';
import { workStateManager } from '../core/workStateManager.js';

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password?: string, turnstileToken?: string) => Promise<void>;
  quickSwitchRole: (email: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: RoleCode[]) => boolean;
  isCoreTeam: boolean;
  isLakshay: boolean;
  canAccessEmailTemplates: boolean;
  // Inactivity warning state
  showInactivityWarning: boolean;
  warningCountdownSeconds: number;
  extendSession: () => void;
  currentSessionId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 15 minutes of inactivity before automatic logout (900,000 ms)
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
// Show warning 60 seconds before timeout (14 minutes = 840,000 ms)
const WARNING_THRESHOLD_MS = 14 * 60 * 1000;
// Heartbeat interval every 2 minutes
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('codrix_session_id');
  });

  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [warningCountdownSeconds, setWarningCountdownSeconds] = useState<number>(60);

  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<any>(null);
  const inactivityCheckTimerRef = useRef<any>(null);

  // Extend / Reset activity timer
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showInactivityWarning) {
      setShowInactivityWarning(false);
      setWarningCountdownSeconds(60);
    }
  }, [showInactivityWarning]);

  const extendSession = () => {
    recordActivity();
    setShowInactivityWarning(false);
    setWarningCountdownSeconds(60);
    // Ping heartbeat immediately to inform server
    sendHeartbeat();
  };

  const handleInactivityTimeout = async () => {
    console.warn('[Session Security] 15 minutes of inactivity reached. Logging out and saving progress.');
    const userEmail = session?.user?.email || '';
    const lastSummary = workStateManager.getActiveSummary();

    // Record timeout notice with saved work context
    workStateManager.recordTimeoutNotice(userEmail);

    try {
      const sessId = currentSessionId || localStorage.getItem('codrix_session_id');
      await apiRequest('/auth/session-timeout', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessId,
          lastWorkSummary: lastSummary,
          savedState: workStateManager.getState()
        })
      });
    } catch (e) {
      console.warn('[Session Security] Failed notifying session-timeout endpoint:', e);
    } finally {
      localStorage.removeItem('codrix_token');
      localStorage.removeItem('codrix_session_id');
      setCurrentSessionId(null);
      setSession(null);
      setShowInactivityWarning(false);
    }
  };

  const sendHeartbeat = async () => {
    const token = localStorage.getItem('codrix_token');
    const sessId = currentSessionId || localStorage.getItem('codrix_session_id');
    if (!token || !sessId) return;

    try {
      const summary = workStateManager.getActiveSummary();
      const res = await apiRequest<{ valid: boolean; reason?: string }>('/auth/session-heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessId,
          lastWorkSummary: summary
        })
      });

      if (!res.valid) {
        if (res.reason === 'TIMEOUT_INACTIVE') {
          handleInactivityTimeout();
        } else if (res.reason === 'REVOKED') {
          alert('Security Notice: Your session was revoked by Superadmin Lakshay.');
          localStorage.removeItem('codrix_token');
          localStorage.removeItem('codrix_session_id');
          setSession(null);
        }
      }
    } catch {
      // transient network blip
    }
  };

  // Initial authentication check
  useEffect(() => {
    const token = localStorage.getItem('codrix_token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest<AuthSession & { sessionId?: string }>('/auth/me')
      .then((data) => {
        setSession(data);
        if (data.sessionId) {
          localStorage.setItem('codrix_session_id', data.sessionId);
          setCurrentSessionId(data.sessionId);
        }
      })
      .catch(() => {
        localStorage.removeItem('codrix_token');
        localStorage.removeItem('codrix_session_id');
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Inactivity tracking and heartbeat listeners
  useEffect(() => {
    if (!session) {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (inactivityCheckTimerRef.current) clearInterval(inactivityCheckTimerRef.current);
      return;
    }

    // Initialize activity timestamp
    lastActivityRef.current = Date.now();

    // DOM events to reset inactivity counter
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const onUserActivity = () => {
      recordActivity();
    };

    activityEvents.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    // Periodic heartbeat every 2 minutes
    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // High frequency inactivity evaluation check (every 1 second)
    inactivityCheckTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // Trigger timeout logout immediately
        handleInactivityTimeout();
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        // Between 14 and 15 mins -> Show 60s countdown warning
        setShowInactivityWarning(true);
        const remainingMs = INACTIVITY_TIMEOUT_MS - elapsed;
        const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
        setWarningCountdownSeconds(secondsLeft);
      } else {
        if (showInactivityWarning) {
          setShowInactivityWarning(false);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (inactivityCheckTimerRef.current) clearInterval(inactivityCheckTimerRef.current);
    };
  }, [session, recordActivity]);

  const login = async (email: string, password: string = 'Lakshay123', turnstileToken?: string) => {
    setLoading(true);
    try {
      const summary = workStateManager.getActiveSummary();
      const data = await apiRequest<{ token: string; sessionId?: string } & AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstileToken, lastWorkSummary: summary })
      });
      localStorage.setItem('codrix_token', data.token);
      if (data.sessionId) {
        localStorage.setItem('codrix_session_id', data.sessionId);
        setCurrentSessionId(data.sessionId);
      }
      setSession(data);
      lastActivityRef.current = Date.now();
      setShowInactivityWarning(false);
      workStateManager.clearTimeoutNotice();
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
      const summary = workStateManager.getActiveSummary();
      const data = await apiRequest<{ token: string; sessionId?: string } & AuthSession>('/auth/switch-account', {
        method: 'POST',
        body: JSON.stringify({ targetEmail, lastWorkSummary: summary })
      });
      localStorage.setItem('codrix_token', data.token);
      if (data.sessionId) {
        localStorage.setItem('codrix_session_id', data.sessionId);
        setCurrentSessionId(data.sessionId);
      }
      setSession(data);
      lastActivityRef.current = Date.now();
    } catch (err: any) {
      alert(err.message || 'Failed switching account');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const sessId = currentSessionId || localStorage.getItem('codrix_session_id');
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sessId })
      });
    } catch {
      // safe fallback
    } finally {
      localStorage.removeItem('codrix_token');
      localStorage.removeItem('codrix_session_id');
      setCurrentSessionId(null);
      setSession(null);
      setShowInactivityWarning(false);
    }
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

  const canAccessEmailTemplates = Boolean(
    session && (
      ['lakshay', 'diya', 'parth', 'anshuman', 'ishita'].some((name) =>
        (session.user.fullName || '').toLowerCase().includes(name) ||
        (session.user.email || '').toLowerCase().includes(name)
      ) ||
      isLakshay
    )
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        login,
        quickSwitchRole,
        logout,
        hasRole,
        isCoreTeam,
        isLakshay,
        canAccessEmailTemplates,
        showInactivityWarning,
        warningCountdownSeconds,
        extendSession,
        currentSessionId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

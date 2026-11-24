import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ScreenSizeGuard } from './components/common/ScreenSizeGuard.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { AppShell } from './components/shell/AppShell.js';
import { ViewLoadingFallback } from './components/common/ViewLoadingFallback.js';
import { workStateManager } from './core/workStateManager.js';
import { Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';

// ==========================================
// Lazy-Loaded Enterprise Views (Code-Splitting)
// ==========================================
const LoginView = lazy(() => import('./views/auth/LoginView.js').then((m) => ({ default: m.LoginView })));
const DashboardView = lazy(() => import('./views/dashboards/DashboardView.js').then((m) => ({ default: m.DashboardView })));
const RecruitmentView = lazy(() => import('./views/recruitment/RecruitmentView.js').then((m) => ({ default: m.RecruitmentView })));
const MailboxView = lazy(() => import('./views/mailbox/MailboxView.js').then((m) => ({ default: m.MailboxView })));
const CrmView = lazy(() => import('./views/crm/CrmView.js').then((m) => ({ default: m.CrmView })));
const ProjectsView = lazy(() => import('./views/projects/ProjectsView.js').then((m) => ({ default: m.ProjectsView })));
const EngineeringView = lazy(() => import('./views/engineering/EngineeringView.js').then((m) => ({ default: m.EngineeringView })));
const HrmsView = lazy(() => import('./views/hrms/HrmsView.js').then((m) => ({ default: m.HrmsView })));
const EmailTemplatesView = lazy(() => import('./views/templates/EmailTemplatesView.js').then((m) => ({ default: m.EmailTemplatesView })));
const AuditView = lazy(() => import('./views/audit/AuditView.js').then((m) => ({ default: m.AuditView })));
const AccessControlView = lazy(() => import('./views/access/AccessControlView.js').then((m) => ({ default: m.AccessControlView })));
const SettingsView = lazy(() => import('./views/settings/SettingsView.js').then((m) => ({ default: m.SettingsView })));

const MainApp: React.FC = () => {
  const {
    session,
    loading,
    isCoreTeam,
    isLakshay,
    canAccessEmailTemplates,
    showInactivityWarning,
    warningCountdownSeconds,
    extendSession
  } = useAuth();

  // Restore previous active tab if available in saved work state
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const saved = workStateManager.getState();
    return saved.currentTab || 'dashboard';
  });

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    workStateManager.setTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFE] flex items-center justify-center text-[#120E24]">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo-icon.png" alt="CodRix Logo" className="w-12 h-12 object-contain animate-pulse" />
          <div className="w-8 h-8 border-3 border-[#7C2CF5] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold tracking-wide text-[#585172]">Loading CodRix Enterprise OS...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Suspense fallback={<ViewLoadingFallback label="Loading Authentication..." />}>
        <LoginView />
      </Suspense>
    );
  }

  return (
    <>
      {/* 60-Second Inactivity Warning Countdown Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-amber-300 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Inactivity Session Alert</span>
              </div>
              <h3 className="text-lg font-extrabold text-[#120E24]">
                Are you still working?
              </h3>
              <p className="text-xs text-[#585172] mt-1.5 leading-relaxed">
                You have been inactive for nearly 15 minutes. To ensure workspace confidentiality, you will be automatically logged out in:
              </p>
            </div>

            <div className="py-3 px-6 bg-[#F6F3FF] rounded-2xl border border-[#E7E0FB] inline-block">
              <span className="text-3xl font-black text-[#7C2CF5] tracking-tight">
                {warningCountdownSeconds}s
              </span>
            </div>

            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium">
              Don't worry: your current drafts and active workspace state will be automatically preserved!
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={extendSession}
                className="w-full py-3 px-4 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#7C2CF5]/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>I'm Still Here (Keep Me Logged In)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AppShell currentTab={currentTab} onSelectTab={handleSelectTab}>
        <Suspense fallback={<ViewLoadingFallback label={`Loading ${currentTab.toUpperCase()} Workspace...`} />}>
          {currentTab === 'dashboard' && <DashboardView onNavigate={handleSelectTab} />}
          {currentTab === 'recruitment' && <RecruitmentView />}
          {currentTab === 'mailbox' && (
            isCoreTeam ? (
              <MailboxView />
            ) : (
              <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6">
                <h2 className="text-base font-extrabold text-[#120E24]">Access Restricted</h2>
                <p className="text-xs mt-1.5 max-w-md mx-auto">
                  Mailbox Workspace is restricted to core leadership (Lakshay, Anshuman, Suryansh, Parth, Diya, and Ishita).
                </p>
              </div>
            )
          )}
          {currentTab === 'crm' && <CrmView />}
          {currentTab === 'projects' && (
            isCoreTeam ? (
              <ProjectsView onNavigate={handleSelectTab} />
            ) : (
              <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6">
                <h2 className="text-base font-extrabold text-[#120E24]">Access Restricted</h2>
                <p className="text-xs mt-1.5 max-w-md mx-auto">
                  Projects Database is restricted to core leadership (Lakshay, Anshuman, Suryansh, Parth, Diya, and Ishita).
                </p>
              </div>
            )
          )}
          {currentTab === 'engineering' && <EngineeringView onNavigate={handleSelectTab} />}
          {currentTab === 'hrms' && <HrmsView />}
          {currentTab === 'email-templates' && (
            canAccessEmailTemplates ? (
              <ErrorBoundary fallbackTitle="Email Templates Studio encountered a temporary issue">
                <EmailTemplatesView />
              </ErrorBoundary>
            ) : (
              <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6">
                <h2 className="text-base font-extrabold text-[#120E24]">Access Restricted</h2>
                <p className="text-xs mt-1.5 max-w-md mx-auto">
                  Email Templates Studio is strictly restricted to SuperAdmin Leadership (Lakshay, Diya, Parth, Anshuman, and Ishita).
                </p>
              </div>
            )
          )}
          {currentTab === 'audit' && <AuditView />}
          {currentTab === 'access-control' && (
            isLakshay ? (
              <AccessControlView />
            ) : (
              <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6">
                <h2 className="text-base font-extrabold text-[#120E24]">Access Restricted</h2>
                <p className="text-xs mt-1.5 max-w-md mx-auto">
                  User Access Control is strictly restricted to Founder Superadmin Lakshay.
                </p>
              </div>
            )
          )}
          {currentTab === 'settings' && <SettingsView />}
        </Suspense>
      </AppShell>
    </>
  );
};

export const App: React.FC = () => {
  useEffect(() => {
    // Global Dropdown on Hover Support: Hovering over select elements focuses and triggers picker
    const handleMouseOver = (e: MouseEvent) => {
      const select = (e.target as HTMLElement)?.closest('select');
      if (select && document.activeElement !== select) {
        select.focus();
        try {
          if (typeof (select as any).showPicker === 'function') {
            (select as any).showPicker();
          }
        } catch {
          // Native fallback
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <AuthProvider>
      <ScreenSizeGuard>
        <MainApp />
      </ScreenSizeGuard>
    </AuthProvider>
  );
};

export default App;

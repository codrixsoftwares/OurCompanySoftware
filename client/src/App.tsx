import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginView } from './views/auth/LoginView.js';
import { ScreenSizeGuard } from './components/common/ScreenSizeGuard.js';
import { AppShell } from './components/shell/AppShell.js';
import { DashboardView } from './views/dashboards/DashboardView.js';
import { RecruitmentView } from './views/recruitment/RecruitmentView.js';
import { MailboxView } from './views/mailbox/MailboxView.js';
import { CrmView } from './views/crm/CrmView.js';
import { ProjectsView } from './views/projects/ProjectsView.js';
import { EngineeringView } from './views/engineering/EngineeringView.js';
import { HrmsView } from './views/hrms/HrmsView.js';
import { AuditView } from './views/audit/AuditView.js';
import { SettingsView } from './views/settings/SettingsView.js';

const MainApp: React.FC = () => {
  const { session, loading, isCoreTeam } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

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
    return <LoginView />;
  }

  return (
    <AppShell currentTab={currentTab} onSelectTab={setCurrentTab}>
      {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
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
          <ProjectsView onNavigate={setCurrentTab} />
        ) : (
          <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6">
            <h2 className="text-base font-extrabold text-[#120E24]">Access Restricted</h2>
            <p className="text-xs mt-1.5 max-w-md mx-auto">
              Projects Database is restricted to core leadership (Lakshay, Anshuman, Suryansh, Parth, Diya, and Ishita).
            </p>
          </div>
        )
      )}
      {currentTab === 'engineering' && <EngineeringView onNavigate={setCurrentTab} />}
      {currentTab === 'hrms' && <HrmsView />}
      {currentTab === 'audit' && <AuditView />}
      {currentTab === 'settings' && <SettingsView />}
    </AppShell>
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

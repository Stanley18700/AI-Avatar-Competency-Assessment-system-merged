import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getNavItems } from './layoutNav';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, experienceLevelLabels } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = getNavItems(user?.role || 'NURSE', t);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-mesh items-stretch">
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 sm:w-72 transform transition-all duration-300 ease-out
        lg:relative lg:flex-shrink-0 lg:self-stretch
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
      >
        <AppSidebar
          t={t}
          experienceLevelLabels={experienceLevelLabels}
          user={user}
          navItems={navItems}
          pathname={location.pathname}
          onNavigate={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="w-full p-3 sm:p-4 lg:p-6 content-pane">
          {/* Use fade-in only (no transform)—transform on an ancestor breaks position:fixed modals */}
          <div className="animate-fade-in max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

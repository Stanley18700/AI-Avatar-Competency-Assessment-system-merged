import { Link } from 'react-router-dom';
import { Brain, Sparkles, LogOut, ChevronRight } from 'lucide-react';
import type { Translation } from '../../lib/i18n';
import { getExperienceLevelLabels } from '../../lib/i18n';
import type { User } from '../../types';
import type { NavItem } from './layoutNav';
import LanguageSelector from '../LanguageSelector';

interface AppSidebarProps {
  t: Translation;
  experienceLevelLabels: ReturnType<typeof getExperienceLevelLabels>;
  user: User | null | undefined;
  navItems: NavItem[];
  pathname: string;
  onNavigate: () => void;
  onLogout: () => void;
}

export default function AppSidebar({
  t,
  experienceLevelLabels,
  user,
  navItems,
  pathname,
  onNavigate,
  onLogout,
}: AppSidebarProps) {
  return (
    <div className="flex flex-col h-full min-h-screen lg:min-h-full sidebar-surface">
      <div className="p-5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center shadow-glow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3">
              <Sparkles className="w-3 h-3 text-accent-400 animate-pulse" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base text-white tracking-tight leading-tight">{t.appName}</h1>
            <p className="text-xs text-primary-100 truncate font-medium mt-0.5 leading-snug">{t.appSubtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.path ||
            (item.path !== '/dashboard' && pathname.startsWith(item.path + '/'));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`
                nav-item group animate-fade-in
                ${isActive ? 'nav-item-active' : 'nav-item-inactive'}
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <item.icon
                className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200
                  ${isActive ? 'text-primary-200' : 'text-primary-200 group-hover:scale-110'}
                `}
              />
              <span className="flex-1 leading-snug">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-400 animate-fade-in" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 shrink-0 space-y-3">
        <LanguageSelector variant="sidebar" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm font-bold text-white shadow-sm">
            {(user?.nameTh || user?.name || '?')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{user?.nameTh || user?.name}</p>
            <p className="text-xs text-primary-100 mt-0.5 leading-snug">
              {user?.role === 'ADMIN' ? t.admin : user?.role === 'REVIEWER' ? t.reviewer : t.nurse}
              {user?.experienceLevel && ` · ${experienceLevelLabels[user.experienceLevel]}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 text-sm text-primary-100 hover:text-red-300 w-full px-1 py-1 rounded-lg transition-colors duration-200"
        >
          <LogOut className="w-4 h-4" />
          {t.logout}
        </button>
      </div>
    </div>
  );
}

import { Menu, X } from 'lucide-react';

interface AppHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/** Mobile-only: opens the sidebar drawer. Hidden on lg+ where the sidebar is always visible. */
export default function AppHeader({ sidebarOpen, onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 shrink-0 flex items-center gap-2 border-b border-surface-100 bg-white/80 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-3 lg:hidden">
      <button
        type="button"
        className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <div className="flex-1" />
    </header>
  );
}

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  ClipboardCheck,
  BarChart3,
  Stethoscope,
  Shield,
  Table2,
} from 'lucide-react';
import type { Translation } from '../../lib/i18n';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export function getNavItems(role: string, t: Translation): NavItem[] {
  const items: NavItem[] = [];

  if (role === 'ADMIN') {
    items.push(
      { path: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
      { path: '/users', label: t.users, icon: Users },
      { path: '/departments', label: t.departments, icon: Building2 },
      { path: '/cases', label: t.cases, icon: FileText },
      { path: '/rubrics', label: t.rubrics, icon: ClipboardCheck },
      { path: '/assessments', label: t.assessments, icon: Stethoscope },
      { path: '/reviews', label: t.reviews, icon: Shield },
      { path: '/summary-results', label: 'สรุปผล', icon: Table2 },
      { path: '/analytics', label: t.analytics, icon: BarChart3 },
    );
  } else if (role === 'NURSE') {
    items.push(
      { path: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
      { path: '/my-assessments', label: t.myAssessments, icon: Stethoscope },
      { path: '/cases', label: t.cases, icon: FileText },
    );
  } else if (role === 'REVIEWER') {
    items.push(
      { path: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
      { path: '/reviews', label: t.pendingReviews, icon: Shield },
      { path: '/assessments', label: t.assessments, icon: Stethoscope },
      { path: '/summary-results', label: 'สรุปผล', icon: Table2 },
    );
  }

  return items;
}

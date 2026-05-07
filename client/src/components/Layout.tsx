import AppShell from './layout/AppShell';

/** Authenticated app chrome: sidebar, header, main content area. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

import { ReactNode } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { LanguageToggle } from './language-toggle';
import { ManagerAISearch } from './manager-ai-search';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex h-screen bg-white dark:bg-slate-950">
      <AdminSidebar />
      <main className="flex-1 overflow-auto relative">
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur border-b">
          <LanguageToggle variant="outline" />
          <ManagerAISearch />
        </div>
        {children}
      </main>
    </div>
  );
}

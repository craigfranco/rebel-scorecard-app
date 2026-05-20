import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Building2, Settings, Menu, PieChart, FolderOpen, DollarSign, ChevronDown, ExternalLink } from 'lucide-react';
import TimePeriodSelector from './TimePeriodSelector';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/properties', icon: Building2, label: 'All Properties' },
  { path: '/kpi-breakdown', icon: PieChart, label: 'KPI Breakdown' },
  { path: '/payouts', icon: DollarSign, label: 'Payouts' },
  { path: '/kpi-reference', icon: BookOpen, label: 'KPI Reference' },
  { path: '/embedded-app', icon: ExternalLink, label: 'STR Scorecard' },
];

const ADMIN_ITEMS = [
  { path: '/documents', icon: FolderOpen, label: 'Documents' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const adminActive = ADMIN_ITEMS.some(i => location.pathname.startsWith(i.path));
  const [adminOpen, setAdminOpen] = useState(adminActive);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#2d4b5e' }}
      >
        {/* Logo */}
         <div className="px-6 py-5 border-b border-white/10 text-center">
            <img src="https://media.base44.com/images/public/69d3e20c8254476c324dc91c/2c3078463_2f08ffa4b_RBIfw1.png" alt="REBEL" className="w-48 h-auto mx-auto mb-2 brightness-0 invert" />
            <p className="text-white text-xs font-semibold">Balanced Scorecard</p>
          </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}

          {/* Admin section */}
          <div className="pt-3">
            <button
              onClick={() => setAdminOpen(o => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                adminActive ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span>Admin</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
            </button>
            {adminOpen && (
              <div className="mt-1 space-y-1">
                {ADMIN_ITEMS.map(({ path, icon: Icon, label }) => {
                  const active = location.pathname.startsWith(path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'text-white/65 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="px-6 py-4 border-t border-white/10 flex items-start gap-2">
          <img src="https://media.base44.com/images/public/69d3e20c8254476c324dc91c/821dc32af_d1eb1b4f2_RBLMark-RH_Blue.png" alt="Rebel Hotel Company" className="w-9 h-9 brightness-0 invert shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="text-white text-xs font-normal">Powered by</span>
            <span className="text-white text-xs font-semibold">Rebel Hotel Company</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm">Balanced Scorecard</span>
          <div className="w-9" />
        </header>

        {/* Time period selector */}
        <TimePeriodSelector />

        <main className="flex-1 overflow-auto flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
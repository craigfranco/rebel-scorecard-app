import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Building2, Menu, PieChart,
  FolderOpen, DollarSign, ChevronDown, ClipboardList, Shield, LogOut, User, HelpCircle,
} from 'lucide-react';
import TimePeriodSelector from '@/components/layout/TimePeriodSelector';
import { useUserProfile } from '@/lib/UserProfileContext';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const { userProfile, isAdmin } = useUserProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const mainNavItems = [
    ...(isAdmin ? [{ path: '/', icon: LayoutDashboard, label: 'Dashboard' }] : []),
    { path: '/hotel-scorecard', icon: ClipboardList, label: 'Hotel Performance Scorecard' },
    ...(isAdmin ? [{ path: '/properties', icon: Building2, label: 'All Properties' }] : []),
    { path: '/kpi-breakdown', icon: PieChart, label: 'KPI Breakdown' },
    { path: '/payouts', icon: DollarSign, label: 'Payouts' },
    { path: '/kpi-reference', icon: BookOpen, label: 'KPI Reference' },
    { path: '/help', icon: HelpCircle, label: 'Help & Guide' },
  ];

  const adminItems = [
    { path: '/documents', icon: FolderOpen, label: 'Documents' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin Panel' }] : []),
  ];

  const adminActive = adminItems.some(i => location.pathname.startsWith(i.path));

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
          <img
            src="https://media.base44.com/images/public/69d3e20c8254476c324dc91c/2c3078463_2f08ffa4b_RBIfw1.png"
            alt="REBEL"
            className="w-48 h-auto mx-auto mb-2 brightness-0 invert"
          />
          <p className="text-white text-xs font-semibold">Balanced Scorecard</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {mainNavItems.map(({ path, icon: Icon, label }) => {
            const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-white/20 text-white shadow-sm' : 'text-white/65 hover:text-white hover:bg-white/10'
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
                {adminItems.map(({ path, icon: Icon, label }) => {
                  const active = location.pathname.startsWith(path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active ? 'bg-white/20 text-white shadow-sm' : 'text-white/65 hover:text-white hover:bg-white/10'
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

        {/* User info in sidebar footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-xs font-semibold truncate">
                  {userProfile?.full_name || user?.full_name || 'User'}
                </span>
                {isAdmin && (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-white/50 text-[10px] truncate">{userProfile?.email || user?.email}</div>
            </div>
            <button
              onClick={() => base44.auth.logout()}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
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

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
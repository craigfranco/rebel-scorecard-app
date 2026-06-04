import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { TimePeriodProvider } from '@/lib/TimePeriodContext';
import { UserProfileProvider, useUserProfile } from '@/lib/UserProfileContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AccessDenied from '@/components/AccessDenied';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import AllProperties from '@/pages/AllProperties.jsx';
import KpiReference from '@/pages/KpiReference';
import Settings from '@/pages/Settings';
import SeedOnMount from '@/components/SeedOnMount';
import KpiBreakdown from '@/pages/KpiBreakdown';
import Documents from '@/pages/Documents.jsx';
import HotelDetail from '@/pages/HotelDetail';
import HotelScorecard from '@/pages/HotelScorecard';
import Payouts from '@/pages/Payouts.jsx';
import JobClassifications from '@/pages/JobClassifications';
import AdminPanel from '@/pages/AdminPanel.jsx';

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#f0f4f7' }}>
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#2d4b5e' }}>
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div className="text-sm font-medium text-muted-foreground">Loading Balanced Scorecard...</div>
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
    </div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const { isLoadingProfile, profileError, isAdmin } = useUserProfile();

  if (isLoadingPublicSettings || isLoadingAuth || isLoadingProfile) {
    return <LoadingScreen />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (profileError) {
    return <AccessDenied reason={profileError} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Admin-only pages */}
        <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to="/hotel-scorecard" replace />} />
        <Route path="/properties" element={isAdmin ? <AllProperties /> : <Navigate to="/hotel-scorecard" replace />} />
        <Route path="/admin" element={isAdmin ? <AdminPanel /> : <Navigate to="/hotel-scorecard" replace />} />

        {/* All users */}
        <Route path="/hotel-scorecard" element={<HotelScorecard />} />
        <Route path="/kpi-breakdown" element={<KpiBreakdown />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/kpi-reference" element={<KpiReference />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/job-classifications" element={<JobClassifications />} />
        <Route path="/hotel/:id" element={<HotelDetail />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <TimePeriodProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <UserProfileProvider>
              <AuthenticatedApp />
            </UserProfileProvider>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </TimePeriodProvider>
    </AuthProvider>
  )
}

export default App
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
// Global design system first, so page stylesheets (e.g. Landing.css) can override it.
import './AppBase.css';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import AuthPage from './pages/AuthPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Today from './pages/Dashboard';
import Goals from './pages/Goals';
import Friends from './pages/Friends';
import Inbox from './pages/Reminders';
import Profile from './pages/Profile';
import Vision from './pages/Vision';
import Compete from './pages/Compete';
import Community from './pages/Community';
import Expert from './pages/Expert';
import Landing from './pages/Landing';
import Changelog from './pages/Changelog';
import Privacy from './pages/Privacy';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading doerstab" />;
  return user ? children : <Navigate to="/auth" replace />;
};

/** `/` shows the marketing landing page to visitors and sends signed-in users straight to their board. */
const HomeRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading doerstab" />;
  return user ? <Navigate to="/board" replace /> : <Landing />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading doerstab" />;
  return user ? <Navigate to="/board" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<HomeRoute />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* Signed-in app. The vision board is home: it's the first thing people see. */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="board" element={<Vision />} />
              <Route path="today" element={<Today />} />
              <Route path="goals" element={<Goals />} />
              <Route path="friends" element={<Friends />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="challenge" element={<Compete />} />
              <Route path="compete" element={<Navigate to="/challenge" replace />} />
              <Route path="community" element={<Community />} />
              <Route path="expert" element={<Expert />} />
              <Route path="vision" element={<Navigate to="/board" replace />} />
              <Route path="profile" element={<Profile />} />
              {/* Legacy paths */}
              <Route path="dashboard" element={<Navigate to="/today" replace />} />
              <Route path="reminders" element={<Navigate to="/inbox" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

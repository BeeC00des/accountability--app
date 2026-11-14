import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import AuthPage from './pages/AuthPage';
import Today from './pages/Dashboard';
import Goals from './pages/Goals';
import Friends from './pages/Friends';
import Inbox from './pages/Reminders';
import Profile from './pages/Profile';
import Vision from './pages/Vision';
import Compete from './pages/Compete';
import Community from './pages/Community';
import './AppBase.css';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading Accountable" />;
  return user ? children : <Navigate to="/auth" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading Accountable" />;
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
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              {/* The vision board is home: it's the first thing people see. */}
              <Route index element={<Navigate to="/board" replace />} />
              <Route path="board" element={<Vision />} />
              <Route path="today" element={<Today />} />
              <Route path="goals" element={<Goals />} />
              <Route path="friends" element={<Friends />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="compete" element={<Compete />} />
              <Route path="community" element={<Community />} />
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

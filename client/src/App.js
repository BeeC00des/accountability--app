import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Friends from './pages/Friends';
import Reminders from './pages/Reminders';
import Profile from './pages/Profile';
import './App.css';

const ProtectedRoute = ({ children }) => {

  const { user, loading } = useAuth();
  
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
};

const PublicRoute = ({ children }) => {

  const { user, loading } = useAuth();

  if (loading) return null;

  return !user ? children : <Navigate to="/dashboard" replace />;    // i feel it's imperfect and it can be improved upon.

};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="goals" element={<Goals />} />
            <Route path="friends" element={<Friends />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

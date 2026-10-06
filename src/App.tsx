import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { UserLayout } from './components/layout/UserLayout';
import { VerifierLayout } from './components/layout/VerifierLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { WalletPage } from './pages/WalletPage';
import { AddDocumentPage } from './pages/AddDocumentPage';
import { CredentialDetailPage } from './pages/CredentialDetailPage';
import { RequestsListPage } from './pages/RequestsListPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { ConsentHistoryPage } from './pages/ConsentHistoryPage';
import { VerifierConsolePage } from './pages/VerifierConsolePage';
import { NewVerifierRequestPage } from './pages/NewVerifierRequestPage';
import { VerifierResultsPage } from './pages/VerifierResultsPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { VerifierProfilePage } from './pages/VerifierProfilePage';

function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing & Auth */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* User / Sovereign Wallet Routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute allowedRole="USER">
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/wallet" replace />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="add-document" element={<AddDocumentPage />} />
        <Route path="documents/:id" element={<CredentialDetailPage />} />
        <Route path="credentials" element={<Navigate to="/app/wallet" replace />} />
        <Route path="credentials/:id" element={<CredentialDetailPage />} />
        <Route path="requests" element={<RequestsListPage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="history" element={<ConsentHistoryPage />} />
        <Route path="profile" element={<UserProfilePage />} />
      </Route>

      {/* Verifier Console & Analytics Routes */}
      <Route
        path="/verifier"
        element={
          <ProtectedRoute allowedRole="VERIFIER">
            <VerifierLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<VerifierConsolePage />} />
        <Route path="new" element={<NewVerifierRequestPage />} />
        <Route path="results/:id" element={<VerifierResultsPage />} />
        <Route path="profile" element={<VerifierProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

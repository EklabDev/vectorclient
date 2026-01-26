import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Common/Layout';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { LoginPage } from './pages/auth/Login';
import { RegisterPage } from './pages/auth/Register';
import { DashboardPage } from './pages/dashboard';
import { EndpointsPage } from './pages/endpoints';
import { SchemasPage } from './pages/schemas';
import { TokensPage } from './pages/tokens';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/endpoints" element={<EndpointsPage />} />
          <Route path="/schemas" element={<SchemasPage />} />
          <Route path="/tokens" element={<TokensPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

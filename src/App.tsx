import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import TestCaseGenerator from './components/TestCaseGenerator';
import SavedTestCases from './components/SavedTestCases';
import KnowledgeBase from './components/KnowledgeBase';
import Login from './pages/Login';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gerador" element={<TestCaseGenerator />} />
            <Route path="/casos" element={<SavedTestCases />} />
            <Route path="/base" element={<KnowledgeBase />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'

// 页面组件
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PatientsPage from './pages/PatientsPage'
import PatientDetailPage from './pages/PatientDetailPage'
import CommandsPage from './pages/CommandsPage'
import CommandDetailPage from './pages/CommandDetailPage'
import ORConsolePage from './pages/ORConsolePage'
import AdminPage from './pages/AdminPage'

// 布局组件
import Layout from './components/layout/Layout'
import LoadingSpinner from './components/ui/LoadingSpinner'

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/commands" element={<CommandsPage />} />
        <Route path="/commands/:id" element={<CommandDetailPage />} />
        <Route path="/console" element={<ORConsolePage />} />
        {user.role === 'admin' && (
          <Route path="/admin" element={<AdminPage />} />
        )}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster />
    </Layout>
  )
}

export default App



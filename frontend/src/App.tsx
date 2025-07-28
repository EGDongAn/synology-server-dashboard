import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import { useAppDispatch, useAppSelector } from './store'
import { getProfile } from './store/slices/authSlice'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ServersPage from './pages/Servers'
import ServerDetailsPage from './pages/ServerDetails'
import ContainersPage from './pages/Containers'
import MonitoringPage from './pages/Monitoring'
import NotificationsPage from './pages/Notifications'
import DeploymentsPage from './pages/Deployments'
import SettingsPage from './pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import websocketService from './services/websocket'

const App: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isAuthenticated, isLoading, user } = useAppSelector(state => state.auth)

  // Temporarily disable WebSocket
  // useEffect(() => {
  //   // Initialize WebSocket service
  //   if (isAuthenticated) {
  //     websocketService.connect()
  //   }

  //   return () => {
  //     websocketService.disconnect()
  //   }
  // }, [isAuthenticated])

  // Temporarily disable getProfile to avoid 401 errors
  // useEffect(() => {
  //   // Get user profile if authenticated but no user data
  //   if (isAuthenticated && !user && !isLoading) {
  //     dispatch(getProfile())
  //   }
  // }, [dispatch, isAuthenticated, user, isLoading])

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
          },
        }}
      >
        <AntApp>
          <Routes>
            <Route 
              path="/login" 
              element={
                isAuthenticated ? <Navigate to="/" replace /> : <Login />
              } 
            />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="servers" element={<ServersPage />} />
              <Route path="servers/:serverId" element={<ServerDetailsPage />} />
              <Route path="containers" element={<ContainersPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="deployments" element={<DeploymentsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  )
}

export default App
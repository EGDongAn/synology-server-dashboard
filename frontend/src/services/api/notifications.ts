import api from '../api'

export const notificationsApi = {
  getNotifications: (params?: any) => 
    api.get('/notifications', { params }),
  
  getActiveAlerts: () => 
    api.get('/notifications/alerts/active'),
  
  getNotification: (id: string) => 
    api.get(`/notifications/${id}`),
  
  markAsRead: (id: string) => 
    api.put(`/notifications/${id}/read`),
  
  deleteNotification: (id: string) => 
    api.delete(`/notifications/${id}`),
  
  retryNotification: (id: string) => 
    api.post(`/notifications/${id}/retry`),
  
  getNotificationSettings: () => 
    api.get('/notifications/settings'),
  
  updateNotificationSettings: (settings: any) => 
    api.put('/notifications/settings', settings),
}
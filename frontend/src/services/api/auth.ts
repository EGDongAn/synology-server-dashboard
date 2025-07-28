import api from '../api'

export const authApi = {
  login: (email: string, password: string) => 
    api.post('/api/v1/auth/login', { email, password }),
  
  logout: () => 
    api.post('/api/v1/auth/logout'),
  
  refreshToken: (refreshToken: string) => 
    api.post('/api/v1/auth/refresh', { refreshToken }),
  
  getProfile: () => 
    api.get('/api/v1/auth/profile'),
  
  updateProfile: (data: any) => 
    api.put('/api/v1/auth/profile', data),
}
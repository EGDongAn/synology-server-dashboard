import api from '../api'

export const authApi = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  
  logout: () => 
    api.post('/auth/logout'),
  
  refreshToken: (refreshToken: string) => 
    api.post('/auth/refresh', { refreshToken }),
  
  getProfile: () => 
    api.get('/auth/profile'),
  
  updateProfile: (data: any) => 
    api.put('/auth/profile', data),
}
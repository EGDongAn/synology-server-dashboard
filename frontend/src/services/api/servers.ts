import api from '../api'

export const serversApi = {
  getServers: () => 
    api.get('/servers'),
  
  getServer: (id: string) => 
    api.get(`/servers/${id}`),
  
  createServer: (data: any) => 
    api.post('/servers', data),
  
  updateServer: (id: string, data: any) => 
    api.put(`/servers/${id}`, data),
  
  deleteServer: (id: string) => 
    api.delete(`/servers/${id}`),
  
  testConnection: (id: string) => 
    api.post(`/servers/${id}/test`),
  
  executeCommand: (data: { id: string; command: string }) => 
    api.post(`/servers/${data.id}/execute`, { command: data.command }),
}
import api from '../api'

export const deploymentsApi = {
  getDeployments: (params?: any) => 
    api.get('/deployments', { params }),
  
  getDeployment: (id: string) => 
    api.get(`/deployments/${id}`),
  
  createDeployment: (data: any) => 
    api.post('/deployments', data),
  
  updateDeploymentStatus: (id: string, status: string) => 
    api.put(`/deployments/${id}/status`, { status }),
  
  rollbackDeployment: (deploymentId: string, version?: string) => 
    api.post(`/deployments/${deploymentId}/rollback`, { version }),
  
  getDeploymentLogs: (id: string) => 
    api.get(`/deployments/${id}/logs`),
  
  getDeploymentHistory: (serverId: string, serviceId: string) => 
    api.get(`/deployments/history`, { params: { serverId, serviceId } }),
}
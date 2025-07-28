import api from '../api'

export const monitoringApi = {
  getMetrics: (serverId: string, range?: string) => 
    api.get(`/monitoring/${serverId}/metrics`, { params: { range } }),
  
  getSystemInfo: (serverId: string) => 
    api.get(`/monitoring/${serverId}/system`),
  
  getProcesses: (serverId: string) => 
    api.get(`/monitoring/${serverId}/processes`),
  
  getServiceStatus: (serverId: string, service: string) => 
    api.get(`/monitoring/${serverId}/services/${service}`),
  
  restartService: (serverId: string, service: string) => 
    api.post(`/monitoring/${serverId}/services/${service}/restart`),
}
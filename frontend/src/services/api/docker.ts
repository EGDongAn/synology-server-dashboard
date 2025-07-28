import api from '../api'

export const dockerApi = {
  getContainers: (serverId: string) => 
    api.get(`/docker/${serverId}/containers`),
  
  getContainer: (serverId: string, containerId: string) => 
    api.get(`/docker/${serverId}/containers/${containerId}`),
  
  startContainer: (serverId: string, containerId: string) => 
    api.post(`/docker/${serverId}/containers/${containerId}/start`),
  
  stopContainer: (serverId: string, containerId: string) => 
    api.post(`/docker/${serverId}/containers/${containerId}/stop`),
  
  restartContainer: (serverId: string, containerId: string) => 
    api.post(`/docker/${serverId}/containers/${containerId}/restart`),
  
  removeContainer: (serverId: string, containerId: string) => 
    api.delete(`/docker/${serverId}/containers/${containerId}`),
  
  getContainerLogs: (serverId: string, containerId: string, tail?: number) => 
    api.get(`/docker/${serverId}/containers/${containerId}/logs`, { params: { tail } }),
  
  getContainerStats: (serverId: string, containerId: string) => 
    api.get(`/docker/${serverId}/containers/${containerId}/stats`),
  
  getImages: (serverId: string) => 
    api.get(`/docker/${serverId}/images`),
  
  pullImage: (serverId: string, image: string) => 
    api.post(`/docker/${serverId}/images/pull`, { image }),
  
  removeImage: (serverId: string, imageId: string) => 
    api.delete(`/docker/${serverId}/images/${imageId}`),
}
import { io, Socket } from 'socket.io-client'
import { store } from '../store'
import { updateRealTimeMetrics, addRealTimeAlert, updateHealthCheckStatus, setRealTimeEnabled } from '../store/slices/monitoringSlice'
import { updateServerMetrics, updateServerStatus } from '../store/slices/serversSlice'
import { addNotification } from '../store/slices/notificationsSlice'

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false

  connect() {
    if (this.socket?.connected || this.isConnecting) {
      return
    }

    this.isConnecting = true
    
    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      auth: {
        token: store.getState().auth.accessToken
      }
    })

    this.setupEventListeners()
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnecting = false
    store.dispatch(setRealTimeEnabled(false))
  }

  private setupEventListeners() {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.isConnecting = false
      store.dispatch(setRealTimeEnabled(true))
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      store.dispatch(setRealTimeEnabled(false))
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.isConnecting = false
      this.handleReconnect()
    })

    // Data events
    this.socket.on('metrics', (data) => {
      const metrics = {
        serverId: data.serverId,
        timestamp: data.timestamp,
        cpu: data.metrics.cpuUsage,
        memory: data.metrics.memoryUsage,
        disk: data.metrics.diskUsage,
        containers: data.metrics.containers,
        services: data.metrics.services
      }
      
      store.dispatch(updateRealTimeMetrics(metrics))
      store.dispatch(updateServerMetrics({
        id: data.serverId,
        cpuUsage: data.metrics.cpuUsage,
        memoryUsage: data.metrics.memoryUsage,
        diskUsage: data.metrics.diskUsage
      }))
    })

    this.socket.on('alert', (alert) => {
      store.dispatch(addRealTimeAlert(alert))
      
      // Also add to notifications if it's a new alert
      if (alert.notifications && alert.notifications.length > 0) {
        alert.notifications.forEach((notification: any) => {
          store.dispatch(addNotification({
            id: notification.id || `alert_${alert.id}_${Date.now()}`,
            alertId: alert.id,
            channel: notification.channel,
            status: notification.status || 'PENDING',
            createdAt: alert.timestamp,
            alert: {
              id: alert.id,
              type: alert.type,
              severity: alert.severity,
              title: alert.title,
              message: alert.message,
              server: alert.server,
              service: alert.service
            }
          }))
        })
      }
    })

    this.socket.on('healthCheck', (data) => {
      store.dispatch(updateHealthCheckStatus({
        serviceId: data.serviceId,
        status: data.status,
        responseTime: data.responseTime,
        timestamp: data.timestamp
      }))
    })

    this.socket.on('serverStatus', (data) => {
      store.dispatch(updateServerStatus({
        id: data.serverId,
        status: data.status
      }))
    })

    this.socket.on('containerStatus', (data) => {
      // Handle container status updates
      // This would typically update the docker slice
    })

    this.socket.on('globalStats', (stats) => {
      // Handle global statistics updates
      console.log('Global stats received:', stats)
    })

    // Notification events
    this.socket.on('notification', (notification) => {
      store.dispatch(addNotification(notification))
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      if (!this.socket?.connected) {
        this.connect()
      }
    }, delay)
  }

  subscribeToServer(serverId: string) {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:server', serverId)
    }
  }

  unsubscribeFromServer(serverId: string) {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:server', serverId)
    }
  }

  subscribeToService(serviceId: string) {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:service', serviceId)
    }
  }

  unsubscribeFromService(serviceId: string) {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:service', serviceId)
    }
  }

  // Send custom events
  sendMessage(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id
  }
}

// Create singleton instance
const websocketService = new WebSocketService()

// Auto-connect when user is authenticated
store.subscribe(() => {
  const state = store.getState()
  const isAuthenticated = state.auth.isAuthenticated
  const isConnected = websocketService.isConnected()

  if (isAuthenticated && !isConnected) {
    websocketService.connect()
  } else if (!isAuthenticated && isConnected) {
    websocketService.disconnect()
  }
})

export default websocketService
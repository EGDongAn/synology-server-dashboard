import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { monitoringApi } from '../../services/api/monitoring'

export interface ServerMetrics {
  serverId: string
  timestamp: string
  cpu: number
  memory: number
  disk: number
  containers?: {
    total: number
    running: number
    stopped: number
  }
  services?: Array<{
    id: string
    name: string
    status: string
  }>
}

export interface Alert {
  id: string
  serverId?: string
  serviceId?: string
  type: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  message: string
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
  channels: string[]
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  server?: {
    id: string
    name: string
    ipAddress: string
  }
  service?: {
    id: string
    name: string
  }
}

export interface HealthCheck {
  id: string
  serviceId: string
  status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'
  responseTime?: number
  statusCode?: number
  error?: string
  checkedAt: string
}

interface MonitoringState {
  metrics: Record<string, ServerMetrics[]> // serverId -> metrics history
  latestMetrics: Record<string, ServerMetrics> // serverId -> latest metrics
  alerts: Alert[]
  healthChecks: Record<string, HealthCheck[]> // serviceId -> health checks
  isLoading: boolean
  isLoadingAlerts: boolean
  isLoadingHealthChecks: boolean
  error: string | null
  realTimeEnabled: boolean
  connectedServers: string[]
}

const initialState: MonitoringState = {
  metrics: {},
  latestMetrics: {},
  alerts: [],
  healthChecks: {},
  isLoading: false,
  isLoadingAlerts: false,
  isLoadingHealthChecks: false,
  error: null,
  realTimeEnabled: false,
  connectedServers: [],
}

// Async thunks
export const fetchServerMetrics = createAsyncThunk(
  'monitoring/fetchServerMetrics',
  async ({ serverId, hours }: { serverId: string; hours?: number }, { rejectWithValue }) => {
    try {
      const response = await monitoringApi.getServerMetrics(serverId, hours)
      return { serverId, metrics: response.data, isHistory: !!hours }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch server metrics')
    }
  }
)

export const startServerMonitoring = createAsyncThunk(
  'monitoring/startServerMonitoring',
  async ({ serverId, interval }: { serverId: string; interval?: number }, { rejectWithValue }) => {
    try {
      await monitoringApi.startServerMonitoring(serverId, interval)
      return serverId
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to start monitoring')
    }
  }
)

export const stopServerMonitoring = createAsyncThunk(
  'monitoring/stopServerMonitoring',
  async (serverId: string, { rejectWithValue }) => {
    try {
      await monitoringApi.stopServerMonitoring(serverId)
      return serverId
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to stop monitoring')
    }
  }
)

export const collectMetrics = createAsyncThunk(
  'monitoring/collectMetrics',
  async (serverId: string, { rejectWithValue }) => {
    try {
      const response = await monitoringApi.collectMetrics(serverId)
      return { serverId, metrics: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to collect metrics')
    }
  }
)

export const fetchAlerts = createAsyncThunk(
  'monitoring/fetchAlerts',
  async (filters?: { status?: string; severity?: string; serverId?: string }, { rejectWithValue }) => {
    try {
      const response = await monitoringApi.getAlerts(filters)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch alerts')
    }
  }
)

export const acknowledgeAlert = createAsyncThunk(
  'monitoring/acknowledgeAlert',
  async (alertId: string, { rejectWithValue }) => {
    try {
      const response = await monitoringApi.acknowledgeAlert(alertId)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to acknowledge alert')
    }
  }
)

export const resolveAlert = createAsyncThunk(
  'monitoring/resolveAlert',
  async (alertId: string, { rejectWithValue }) => {
    try {
      const response = await monitoringApi.resolveAlert(alertId)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to resolve alert')
    }
  }
)

export const fetchHealthChecks = createAsyncThunk(
  'monitoring/fetchHealthChecks',
  async (serviceId: string, { rejectWithValue }) => {
    try {
      const response = await monitoringApi.getHealthChecks(serviceId)
      return { serviceId, healthChecks: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch health checks')
    }
  }
)

export const startHealthCheck = createAsyncThunk(
  'monitoring/startHealthCheck',
  async ({ serviceId, config }: { 
    serviceId: string
    config: {
      url: string
      interval: number
      timeout: number
      method?: string
      expectedStatus?: number
    }
  }, { rejectWithValue }) => {
    try {
      await monitoringApi.startHealthCheck(serviceId, config)
      return serviceId
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to start health check')
    }
  }
)

export const stopHealthCheck = createAsyncThunk(
  'monitoring/stopHealthCheck',
  async (serviceId: string, { rejectWithValue }) => {
    try {
      await monitoringApi.stopHealthCheck(serviceId)
      return serviceId
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to stop health check')
    }
  }
)

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    updateRealTimeMetrics: (state, action: PayloadAction<ServerMetrics>) => {
      const metrics = action.payload
      state.latestMetrics[metrics.serverId] = metrics
      
      // Add to metrics history (keep last 100 entries)
      if (!state.metrics[metrics.serverId]) {
        state.metrics[metrics.serverId] = []
      }
      state.metrics[metrics.serverId].push(metrics)
      if (state.metrics[metrics.serverId].length > 100) {
        state.metrics[metrics.serverId].shift()
      }
    },
    addRealTimeAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.unshift(action.payload)
      // Keep only last 50 alerts in memory
      if (state.alerts.length > 50) {
        state.alerts.pop()
      }
    },
    updateHealthCheckStatus: (state, action: PayloadAction<{
      serviceId: string
      status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'
      responseTime?: number
      timestamp: string
    }>) => {
      const { serviceId, status, responseTime, timestamp } = action.payload
      
      if (!state.healthChecks[serviceId]) {
        state.healthChecks[serviceId] = []
      }
      
      const healthCheck: HealthCheck = {
        id: `hc_${Date.now()}`,
        serviceId,
        status,
        responseTime,
        checkedAt: timestamp
      }
      
      state.healthChecks[serviceId].unshift(healthCheck)
      // Keep only last 20 health checks per service
      if (state.healthChecks[serviceId].length > 20) {
        state.healthChecks[serviceId] = state.healthChecks[serviceId].slice(0, 20)
      }
    },
    setRealTimeEnabled: (state, action: PayloadAction<boolean>) => {
      state.realTimeEnabled = action.payload
    },
    addConnectedServer: (state, action: PayloadAction<string>) => {
      state.connectedServers.add(action.payload)
    },
    removeConnectedServer: (state, action: PayloadAction<string>) => {
      state.connectedServers.delete(action.payload)
    },
    clearConnectedServers: (state) => {
      state.connectedServers.clear()
    },
  },
  extraReducers: (builder) => {
    // Fetch Server Metrics
    builder.addCase(fetchServerMetrics.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchServerMetrics.fulfilled, (state, action) => {
      state.isLoading = false
      const { serverId, metrics, isHistory } = action.payload
      
      if (isHistory) {
        state.metrics[serverId] = Array.isArray(metrics) ? metrics : []
      } else {
        state.latestMetrics[serverId] = Array.isArray(metrics) ? metrics[0] : metrics
      }
    })
    builder.addCase(fetchServerMetrics.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Collect Metrics
    builder.addCase(collectMetrics.fulfilled, (state, action) => {
      const { serverId, metrics } = action.payload
      state.latestMetrics[serverId] = metrics
    })

    // Fetch Alerts
    builder.addCase(fetchAlerts.pending, (state) => {
      state.isLoadingAlerts = true
      state.error = null
    })
    builder.addCase(fetchAlerts.fulfilled, (state, action) => {
      state.isLoadingAlerts = false
      state.alerts = action.payload.alerts || action.payload
    })
    builder.addCase(fetchAlerts.rejected, (state, action) => {
      state.isLoadingAlerts = false
      state.error = action.payload as string
    })

    // Acknowledge Alert
    builder.addCase(acknowledgeAlert.fulfilled, (state, action) => {
      const updatedAlert = action.payload
      const index = state.alerts.findIndex(a => a.id === updatedAlert.id)
      if (index !== -1) {
        state.alerts[index] = updatedAlert
      }
    })

    // Resolve Alert
    builder.addCase(resolveAlert.fulfilled, (state, action) => {
      const updatedAlert = action.payload
      const index = state.alerts.findIndex(a => a.id === updatedAlert.id)
      if (index !== -1) {
        state.alerts[index] = updatedAlert
      }
    })

    // Fetch Health Checks
    builder.addCase(fetchHealthChecks.pending, (state) => {
      state.isLoadingHealthChecks = true
    })
    builder.addCase(fetchHealthChecks.fulfilled, (state, action) => {
      state.isLoadingHealthChecks = false
      const { serviceId, healthChecks } = action.payload
      state.healthChecks[serviceId] = healthChecks.healthChecks || healthChecks
    })
    builder.addCase(fetchHealthChecks.rejected, (state, action) => {
      state.isLoadingHealthChecks = false
      state.error = action.payload as string
    })
  },
})

export const {
  clearError,
  updateRealTimeMetrics,
  addRealTimeAlert,
  updateHealthCheckStatus,
  setRealTimeEnabled,
  addConnectedServer,
  removeConnectedServer,
  clearConnectedServers,
} = monitoringSlice.actions

export default monitoringSlice.reducer
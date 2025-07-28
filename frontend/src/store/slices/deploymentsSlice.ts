import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { deploymentsApi } from '../../services/api/deployments'

export interface Deployment {
  id: string
  serverId: string
  serviceId: string
  version: string
  status: 'PENDING' | 'DEPLOYING' | 'RUNNING' | 'FAILED' | 'STOPPING' | 'STOPPED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'ROLLBACK_FAILED'
  environment: 'development' | 'staging' | 'production'
  config: Record<string, any>
  description?: string
  healthCheckUrl?: string
  healthCheckInterval?: number
  createdAt: string
  updatedAt: string
  server: {
    id: string
    name: string
    ipAddress: string
  }
  service: {
    id: string
    name: string
    type: string
  }
  logs?: DeploymentLog[]
}

export interface DeploymentLog {
  id: string
  deploymentId: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
  message: string
  timestamp: string
}

export interface DeploymentStats {
  total: number
  running: number
  failed: number
  successful: number
  successRate: number
  recentDeployments: Deployment[]
}

interface DeploymentsState {
  deployments: Deployment[]
  currentDeployment: Deployment | null
  logs: Record<string, DeploymentLog[]>
  stats: DeploymentStats | null
  isLoading: boolean
  isLoadingLogs: boolean
  isLoadingStats: boolean
  isDeploying: boolean
  error: string | null
  total: number
  hasMore: boolean
}

const initialState: DeploymentsState = {
  deployments: [],
  currentDeployment: null,
  logs: {},
  stats: null,
  isLoading: false,
  isLoadingLogs: false,
  isLoadingStats: false,
  isDeploying: false,
  error: null,
  total: 0,
  hasMore: false,
}

// Async thunks
export const fetchDeployments = createAsyncThunk(
  'deployments/fetchDeployments',
  async (filters?: {
    serverId?: string
    status?: string
    limit?: number
    offset?: number
  }, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.getDeployments(filters)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployments')
    }
  }
)

export const fetchDeployment = createAsyncThunk(
  'deployments/fetchDeployment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.getDeployment(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployment')
    }
  }
)

export const createDeployment = createAsyncThunk(
  'deployments/createDeployment',
  async (deploymentData: {
    serverId: string
    serviceId: string
    version?: string
    environment?: 'development' | 'staging' | 'production'
    config?: Record<string, any>
    description?: string
    healthCheckUrl?: string
    healthCheckInterval?: number
  }, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.createDeployment(deploymentData)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create deployment')
    }
  }
)

export const updateDeployment = createAsyncThunk(
  'deployments/updateDeployment',
  async ({ id, data }: { id: string; data: Partial<Deployment> }, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.updateDeployment(id, data)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update deployment')
    }
  }
)

export const deleteDeployment = createAsyncThunk(
  'deployments/deleteDeployment',
  async (id: string, { rejectWithValue }) => {
    try {
      await deploymentsApi.deleteDeployment(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete deployment')
    }
  }
)

export const deployService = createAsyncThunk(
  'deployments/deployService',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.deployService(id)
      return { id, result: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to deploy service')
    }
  }
)

export const rollbackDeployment = createAsyncThunk(
  'deployments/rollbackDeployment',
  async ({ id, targetVersion }: { id: string; targetVersion?: string }, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.rollbackDeployment(id, { targetVersion })
      return { id, result: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to rollback deployment')
    }
  }
)

export const stopDeployment = createAsyncThunk(
  'deployments/stopDeployment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.stopDeployment(id)
      return { id, result: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to stop deployment')
    }
  }
)

export const restartService = createAsyncThunk(
  'deployments/restartService',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.restartService(id)
      return { id, result: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to restart service')
    }
  }
)

export const fetchDeploymentLogs = createAsyncThunk(
  'deployments/fetchDeploymentLogs',
  async ({ id, limit }: { id: string; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.getDeploymentLogs(id, limit)
      return { id, logs: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployment logs')
    }
  }
)

export const fetchDeploymentStats = createAsyncThunk(
  'deployments/fetchDeploymentStats',
  async (serverId?: string, { rejectWithValue }) => {
    try {
      const response = await deploymentsApi.getDeploymentStats(serverId)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployment stats')
    }
  }
)

const deploymentsSlice = createSlice({
  name: 'deployments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setCurrentDeployment: (state, action: PayloadAction<Deployment | null>) => {
      state.currentDeployment = action.payload
    },
    updateDeploymentStatus: (state, action: PayloadAction<{ id: string; status: string }>) => {
      const { id, status } = action.payload
      const deployment = state.deployments.find(d => d.id === id)
      if (deployment) {
        deployment.status = status as any
        deployment.updatedAt = new Date().toISOString()
      }
      if (state.currentDeployment?.id === id) {
        state.currentDeployment.status = status as any
        state.currentDeployment.updatedAt = new Date().toISOString()
      }
    },
    addDeploymentLog: (state, action: PayloadAction<{ deploymentId: string; log: DeploymentLog }>) => {
      const { deploymentId, log } = action.payload
      if (!state.logs[deploymentId]) {
        state.logs[deploymentId] = []
      }
      state.logs[deploymentId].unshift(log)
      // Keep only last 100 logs
      if (state.logs[deploymentId].length > 100) {
        state.logs[deploymentId] = state.logs[deploymentId].slice(0, 100)
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch Deployments
    builder.addCase(fetchDeployments.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchDeployments.fulfilled, (state, action) => {
      state.isLoading = false
      const { deployments, total, hasMore } = action.payload
      state.deployments = deployments || action.payload
      state.total = total || deployments?.length || 0
      state.hasMore = hasMore || false
    })
    builder.addCase(fetchDeployments.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Fetch Deployment
    builder.addCase(fetchDeployment.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchDeployment.fulfilled, (state, action) => {
      state.isLoading = false
      state.currentDeployment = action.payload
      if (action.payload.logs) {
        state.logs[action.payload.id] = action.payload.logs
      }
    })
    builder.addCase(fetchDeployment.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Create Deployment
    builder.addCase(createDeployment.fulfilled, (state, action) => {
      state.deployments.unshift(action.payload)
      state.total += 1
    })

    // Update Deployment
    builder.addCase(updateDeployment.fulfilled, (state, action) => {
      const index = state.deployments.findIndex(d => d.id === action.payload.id)
      if (index !== -1) {
        state.deployments[index] = action.payload
      }
      if (state.currentDeployment?.id === action.payload.id) {
        state.currentDeployment = action.payload
      }
    })

    // Delete Deployment
    builder.addCase(deleteDeployment.fulfilled, (state, action) => {
      state.deployments = state.deployments.filter(d => d.id !== action.payload)
      state.total -= 1
      if (state.currentDeployment?.id === action.payload) {
        state.currentDeployment = null
      }
      delete state.logs[action.payload]
    })

    // Deploy Service
    builder.addCase(deployService.pending, (state) => {
      state.isDeploying = true
      state.error = null
    })
    builder.addCase(deployService.fulfilled, (state, action) => {
      state.isDeploying = false
      const { id } = action.payload
      const deployment = state.deployments.find(d => d.id === id)
      if (deployment) {
        deployment.status = 'DEPLOYING'
      }
    })
    builder.addCase(deployService.rejected, (state, action) => {
      state.isDeploying = false
      state.error = action.payload as string
    })

    // Rollback Deployment
    builder.addCase(rollbackDeployment.pending, (state) => {
      state.isDeploying = true
      state.error = null
    })
    builder.addCase(rollbackDeployment.fulfilled, (state, action) => {
      state.isDeploying = false
      const { id } = action.payload
      const deployment = state.deployments.find(d => d.id === id)
      if (deployment) {
        deployment.status = 'ROLLING_BACK'
      }
    })
    builder.addCase(rollbackDeployment.rejected, (state, action) => {
      state.isDeploying = false
      state.error = action.payload as string
    })

    // Stop Deployment
    builder.addCase(stopDeployment.fulfilled, (state, action) => {
      const { id } = action.payload
      const deployment = state.deployments.find(d => d.id === id)
      if (deployment) {
        deployment.status = 'STOPPING'
      }
    })

    // Restart Service
    builder.addCase(restartService.fulfilled, (state, action) => {
      const { id } = action.payload
      const deployment = state.deployments.find(d => d.id === id)
      if (deployment) {
        deployment.status = 'DEPLOYING'
      }
    })

    // Fetch Deployment Logs
    builder.addCase(fetchDeploymentLogs.pending, (state) => {
      state.isLoadingLogs = true
    })
    builder.addCase(fetchDeploymentLogs.fulfilled, (state, action) => {
      state.isLoadingLogs = false
      const { id, logs } = action.payload
      state.logs[id] = logs
    })
    builder.addCase(fetchDeploymentLogs.rejected, (state) => {
      state.isLoadingLogs = false
    })

    // Fetch Deployment Stats
    builder.addCase(fetchDeploymentStats.pending, (state) => {
      state.isLoadingStats = true
    })
    builder.addCase(fetchDeploymentStats.fulfilled, (state, action) => {
      state.isLoadingStats = false
      state.stats = action.payload
    })
    builder.addCase(fetchDeploymentStats.rejected, (state) => {
      state.isLoadingStats = false
    })
  },
})

export const {
  clearError,
  setCurrentDeployment,
  updateDeploymentStatus,
  addDeploymentLog,
} = deploymentsSlice.actions

export default deploymentsSlice.reducer
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { serversApi } from '../../services/api/servers'

export interface Server {
  id: string
  name: string
  description?: string
  ipAddress: string
  sshPort: number
  dockerPort?: number
  username: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  tags: string[]
  createdAt: string
  updatedAt: string
  services?: Array<{
    id: string
    name: string
    status: string
  }>
  _count?: {
    services: number
    deployments: number
    alerts: number
  }
}

export interface ServerCreateData {
  name: string
  description?: string
  ipAddress: string
  sshPort?: number
  dockerPort?: number
  username: string
  password?: string
  privateKey?: string
  tags?: string[]
}

interface ServersState {
  servers: Server[]
  currentServer: Server | null
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  error: string | null
  filters: {
    status?: 'ONLINE' | 'OFFLINE' | 'ERROR'
    tags?: string[]
    search?: string
  }
}

const initialState: ServersState = {
  servers: [],
  currentServer: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  filters: {},
}

// Async thunks
export const fetchServers = createAsyncThunk(
  'servers/fetchServers',
  async (filters?: { status?: string; tags?: string[]; search?: string }, { rejectWithValue }) => {
    try {
      const response = await serversApi.getServers(filters)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch servers')
    }
  }
)

export const fetchServer = createAsyncThunk(
  'servers/fetchServer',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await serversApi.getServer(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch server')
    }
  }
)

export const createServer = createAsyncThunk(
  'servers/createServer',
  async (serverData: ServerCreateData, { rejectWithValue }) => {
    try {
      const response = await serversApi.createServer(serverData)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create server')
    }
  }
)

export const updateServer = createAsyncThunk(
  'servers/updateServer',
  async ({ id, data }: { id: string; data: Partial<ServerCreateData> }, { rejectWithValue }) => {
    try {
      const response = await serversApi.updateServer(id, data)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update server')
    }
  }
)

export const deleteServer = createAsyncThunk(
  'servers/deleteServer',
  async (id: string, { rejectWithValue }) => {
    try {
      await serversApi.deleteServer(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete server')
    }
  }
)

export const testConnection = createAsyncThunk(
  'servers/testConnection',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await serversApi.testConnection(id)
      return { id, connected: response.data.connected }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Connection test failed')
    }
  }
)

export const getSystemInfo = createAsyncThunk(
  'servers/getSystemInfo',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await serversApi.getSystemInfo(id)
      return { id, systemInfo: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get system info')
    }
  }
)

export const updateResources = createAsyncThunk(
  'servers/updateResources',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await serversApi.updateResources(id)
      return { id, resources: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update resources')
    }
  }
)

export const executeCommand = createAsyncThunk(
  'servers/executeCommand',
  async ({ id, command }: { id: string; command: string }, { rejectWithValue }) => {
    try {
      const response = await serversApi.executeCommand(id, command)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Command execution failed')
    }
  }
)

const serversSlice = createSlice({
  name: 'servers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setFilters: (state, action: PayloadAction<typeof initialState.filters>) => {
      state.filters = action.payload
    },
    updateServerStatus: (state, action: PayloadAction<{ id: string; status: Server['status'] }>) => {
      const server = state.servers.find(s => s.id === action.payload.id)
      if (server) {
        server.status = action.payload.status
      }
      if (state.currentServer?.id === action.payload.id) {
        state.currentServer.status = action.payload.status
      }
    },
    updateServerMetrics: (state, action: PayloadAction<{
      id: string
      cpuUsage: number
      memoryUsage: number
      diskUsage: number
    }>) => {
      const server = state.servers.find(s => s.id === action.payload.id)
      if (server) {
        server.cpuUsage = action.payload.cpuUsage
        server.memoryUsage = action.payload.memoryUsage
        server.diskUsage = action.payload.diskUsage
      }
      if (state.currentServer?.id === action.payload.id) {
        state.currentServer.cpuUsage = action.payload.cpuUsage
        state.currentServer.memoryUsage = action.payload.memoryUsage
        state.currentServer.diskUsage = action.payload.diskUsage
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch Servers
    builder.addCase(fetchServers.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchServers.fulfilled, (state, action) => {
      state.isLoading = false
      state.servers = action.payload
    })
    builder.addCase(fetchServers.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Fetch Server
    builder.addCase(fetchServer.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchServer.fulfilled, (state, action) => {
      state.isLoading = false
      state.currentServer = action.payload
    })
    builder.addCase(fetchServer.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Create Server
    builder.addCase(createServer.pending, (state) => {
      state.isCreating = true
      state.error = null
    })
    builder.addCase(createServer.fulfilled, (state, action) => {
      state.isCreating = false
      state.servers.push(action.payload)
    })
    builder.addCase(createServer.rejected, (state, action) => {
      state.isCreating = false
      state.error = action.payload as string
    })

    // Update Server
    builder.addCase(updateServer.pending, (state) => {
      state.isUpdating = true
      state.error = null
    })
    builder.addCase(updateServer.fulfilled, (state, action) => {
      state.isUpdating = false
      const index = state.servers.findIndex(s => s.id === action.payload.id)
      if (index !== -1) {
        state.servers[index] = action.payload
      }
      if (state.currentServer?.id === action.payload.id) {
        state.currentServer = action.payload
      }
    })
    builder.addCase(updateServer.rejected, (state, action) => {
      state.isUpdating = false
      state.error = action.payload as string
    })

    // Delete Server
    builder.addCase(deleteServer.pending, (state) => {
      state.isDeleting = true
      state.error = null
    })
    builder.addCase(deleteServer.fulfilled, (state, action) => {
      state.isDeleting = false
      state.servers = state.servers.filter(s => s.id !== action.payload)
      if (state.currentServer?.id === action.payload) {
        state.currentServer = null
      }
    })
    builder.addCase(deleteServer.rejected, (state, action) => {
      state.isDeleting = false
      state.error = action.payload as string
    })

    // Test Connection
    builder.addCase(testConnection.fulfilled, (state, action) => {
      const server = state.servers.find(s => s.id === action.payload.id)
      if (server) {
        server.status = action.payload.connected ? 'ONLINE' : 'OFFLINE'
      }
    })

    // Update Resources
    builder.addCase(updateResources.fulfilled, (state, action) => {
      const server = state.servers.find(s => s.id === action.payload.id)
      if (server) {
        server.cpuUsage = action.payload.resources.cpuUsage
        server.memoryUsage = action.payload.resources.memoryUsage
        server.diskUsage = action.payload.resources.diskUsage
      }
    })
  },
})

export const { 
  clearError, 
  setFilters, 
  updateServerStatus, 
  updateServerMetrics 
} = serversSlice.actions

export default serversSlice.reducer
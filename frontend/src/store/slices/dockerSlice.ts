import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { dockerApi } from '../../services/api/docker'

export interface Container {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: string
  ports: Array<{
    host?: number
    container: number
    type: string
  }>
  labels: Record<string, string>
  networks: string[]
}

export interface ContainerDetails extends Container {
  running: boolean
  started: string | null
  finished: string | null
  exitCode: number
  config: {
    environment: string[]
    command: string[]
    workingDir: string
    ports: string[]
    volumes: Array<{
      source: string
      destination: string
      mode: string
      rw: boolean
    }>
  }
  resources: {
    memory: number
    cpus: number
  }
}

export interface DockerImage {
  id: string
  tags: string[]
  size: number
  created: string
  labels: Record<string, string>
}

export interface ContainerCreateData {
  name: string
  image: string
  ports?: Array<{ host: number; container: number; protocol?: string }>
  environment?: Record<string, string>
  volumes?: Array<{ host: string; container: string; mode?: string }>
  restart?: string
  workdir?: string
  command?: string | string[]
  labels?: Record<string, string>
  memory?: number
  cpus?: number
}

interface DockerState {
  containers: Record<string, Container[]> // serverId -> containers
  containerDetails: Record<string, ContainerDetails> // containerId -> details
  images: Record<string, DockerImage[]> // serverId -> images
  dockerInfo: Record<string, any> // serverId -> docker info
  isLoading: boolean
  isCreating: boolean
  isExecuting: boolean
  error: string | null
}

const initialState: DockerState = {
  containers: {},
  containerDetails: {},
  images: {},
  dockerInfo: {},
  isLoading: false,
  isCreating: false,
  isExecuting: false,
  error: null,
}

// Async thunks
export const fetchContainers = createAsyncThunk(
  'docker/fetchContainers',
  async ({ serverId, all = false }: { serverId: string; all?: boolean }, { rejectWithValue }) => {
    try {
      const response = await dockerApi.getContainers(serverId, all)
      return { serverId, containers: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch containers')
    }
  }
)

export const fetchContainerDetails = createAsyncThunk(
  'docker/fetchContainerDetails',
  async ({ serverId, containerId }: { serverId: string; containerId: string }, { rejectWithValue }) => {
    try {
      const response = await dockerApi.getContainerDetails(serverId, containerId)
      return { containerId, details: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch container details')
    }
  }
)

export const createContainer = createAsyncThunk(
  'docker/createContainer',
  async ({ serverId, config }: { serverId: string; config: ContainerCreateData }, { rejectWithValue }) => {
    try {
      const response = await dockerApi.createContainer(serverId, config)
      return { serverId, container: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create container')
    }
  }
)

export const startContainer = createAsyncThunk(
  'docker/startContainer',
  async ({ serverId, containerId }: { serverId: string; containerId: string }, { rejectWithValue }) => {
    try {
      await dockerApi.startContainer(serverId, containerId)
      return { serverId, containerId }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to start container')
    }
  }
)

export const stopContainer = createAsyncThunk(
  'docker/stopContainer',
  async ({ serverId, containerId, timeout }: { serverId: string; containerId: string; timeout?: number }, { rejectWithValue }) => {
    try {
      await dockerApi.stopContainer(serverId, containerId, timeout)
      return { serverId, containerId }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to stop container')
    }
  }
)

export const restartContainer = createAsyncThunk(
  'docker/restartContainer',
  async ({ serverId, containerId }: { serverId: string; containerId: string }, { rejectWithValue }) => {
    try {
      await dockerApi.restartContainer(serverId, containerId)
      return { serverId, containerId }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to restart container')
    }
  }
)

export const removeContainer = createAsyncThunk(
  'docker/removeContainer',
  async ({ serverId, containerId, force }: { serverId: string; containerId: string; force?: boolean }, { rejectWithValue }) => {
    try {
      await dockerApi.removeContainer(serverId, containerId, force)
      return { serverId, containerId }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove container')
    }
  }
)

export const fetchContainerLogs = createAsyncThunk(
  'docker/fetchContainerLogs',
  async ({ serverId, containerId, options }: { 
    serverId: string
    containerId: string
    options?: { tail?: number; since?: string; timestamps?: boolean }
  }, { rejectWithValue }) => {
    try {
      const response = await dockerApi.getContainerLogs(serverId, containerId, options)
      return { containerId, logs: response.data.logs }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch container logs')
    }
  }
)

export const executeInContainer = createAsyncThunk(
  'docker/executeInContainer',
  async ({ serverId, containerId, command }: { 
    serverId: string
    containerId: string
    command: string[]
  }, { rejectWithValue }) => {
    try {
      const response = await dockerApi.executeInContainer(serverId, containerId, command)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to execute command')
    }
  }
)

export const fetchImages = createAsyncThunk(
  'docker/fetchImages',
  async (serverId: string, { rejectWithValue }) => {
    try {
      const response = await dockerApi.getImages(serverId)
      return { serverId, images: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch images')
    }
  }
)

export const pullImage = createAsyncThunk(
  'docker/pullImage',
  async ({ serverId, image }: { serverId: string; image: string }, { rejectWithValue }) => {
    try {
      await dockerApi.pullImage(serverId, image)
      return { serverId, image }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to pull image')
    }
  }
)

export const removeImage = createAsyncThunk(
  'docker/removeImage',
  async ({ serverId, imageId, force }: { serverId: string; imageId: string; force?: boolean }, { rejectWithValue }) => {
    try {
      await dockerApi.removeImage(serverId, imageId, force)
      return { serverId, imageId }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove image')
    }
  }
)

export const fetchDockerInfo = createAsyncThunk(
  'docker/fetchDockerInfo',
  async (serverId: string, { rejectWithValue }) => {
    try {
      const response = await dockerApi.getDockerInfo(serverId)
      return { serverId, info: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch Docker info')
    }
  }
)

const dockerSlice = createSlice({
  name: 'docker',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    updateContainerStatus: (state, action) => {
      const { serverId, containerId, status } = action.payload
      const containers = state.containers[serverId]
      if (containers) {
        const container = containers.find(c => c.id === containerId)
        if (container) {
          container.status = status
        }
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch Containers
    builder.addCase(fetchContainers.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchContainers.fulfilled, (state, action) => {
      state.isLoading = false
      state.containers[action.payload.serverId] = action.payload.containers
    })
    builder.addCase(fetchContainers.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Fetch Container Details
    builder.addCase(fetchContainerDetails.fulfilled, (state, action) => {
      state.containerDetails[action.payload.containerId] = action.payload.details
    })

    // Create Container
    builder.addCase(createContainer.pending, (state) => {
      state.isCreating = true
      state.error = null
    })
    builder.addCase(createContainer.fulfilled, (state, action) => {
      state.isCreating = false
      // Container will be fetched in the next containers refresh
    })
    builder.addCase(createContainer.rejected, (state, action) => {
      state.isCreating = false
      state.error = action.payload as string
    })

    // Container Actions (start, stop, restart, remove)
    builder.addCase(startContainer.fulfilled, (state, action) => {
      const { serverId, containerId } = action.payload
      const containers = state.containers[serverId]
      if (containers) {
        const container = containers.find(c => c.id === containerId)
        if (container) {
          container.status = 'running'
          container.state = 'running'
        }
      }
    })

    builder.addCase(stopContainer.fulfilled, (state, action) => {
      const { serverId, containerId } = action.payload
      const containers = state.containers[serverId]
      if (containers) {
        const container = containers.find(c => c.id === containerId)
        if (container) {
          container.status = 'exited'
          container.state = 'exited'
        }
      }
    })

    builder.addCase(removeContainer.fulfilled, (state, action) => {
      const { serverId, containerId } = action.payload
      const containers = state.containers[serverId]
      if (containers) {
        state.containers[serverId] = containers.filter(c => c.id !== containerId)
      }
      delete state.containerDetails[containerId]
    })

    // Execute in Container
    builder.addCase(executeInContainer.pending, (state) => {
      state.isExecuting = true
      state.error = null
    })
    builder.addCase(executeInContainer.fulfilled, (state) => {
      state.isExecuting = false
    })
    builder.addCase(executeInContainer.rejected, (state, action) => {
      state.isExecuting = false
      state.error = action.payload as string
    })

    // Fetch Images
    builder.addCase(fetchImages.fulfilled, (state, action) => {
      state.images[action.payload.serverId] = action.payload.images
    })

    // Remove Image
    builder.addCase(removeImage.fulfilled, (state, action) => {
      const { serverId, imageId } = action.payload
      const images = state.images[serverId]
      if (images) {
        state.images[serverId] = images.filter(img => img.id !== imageId)
      }
    })

    // Fetch Docker Info
    builder.addCase(fetchDockerInfo.fulfilled, (state, action) => {
      state.dockerInfo[action.payload.serverId] = action.payload.info
    })
  },
})

export const { clearError, updateContainerStatus } = dockerSlice.actions
export default dockerSlice.reducer
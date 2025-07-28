import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { notificationsApi } from '../../services/api/notifications'

export interface Notification {
  id: string
  alertId: string
  channel: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  sentAt?: string
  error?: string
  attempts: number
  createdAt: string
  alert: {
    id: string
    type: string
    severity: string
    title: string
    message: string
    server?: {
      name: string
    }
    service?: {
      name: string
    }
  }
}

export interface NotificationChannel {
  type: string
  name: string
  configured: boolean
  description: string
}

export interface NotificationStats {
  period: string
  total: number
  sent: number
  failed: number
  successRate: number
  byChannel: Array<{
    channel: string
    count: number
  }>
  byStatus: Array<{
    status: string
    count: number
  }>
}

interface NotificationsState {
  history: Notification[]
  channels: NotificationChannel[]
  stats: NotificationStats | null
  activeAlerts: Array<{
    id: string
    serverId?: string
    serviceId?: string
    type: string
    severity: string
    title: string
    message: string
    status: string
    createdAt: string
    server?: {
      id: string
      name: string
      ipAddress: string
    }
    service?: {
      id: string
      name: string
    }
    notifications: Array<{
      channel: string
      status: string
      sentAt?: string
      attempts: number
    }>
  }>
  isLoading: boolean
  isLoadingStats: boolean
  isSending: boolean
  error: string | null
  total: number
  hasMore: boolean
}

const initialState: NotificationsState = {
  history: [],
  channels: [],
  stats: null,
  activeAlerts: [],
  isLoading: false,
  isLoadingStats: false,
  isSending: false,
  error: null,
  total: 0,
  hasMore: false,
}

// Async thunks
export const fetchNotificationHistory = createAsyncThunk(
  'notifications/fetchHistory',
  async (filters?: {
    alertId?: string
    channel?: string
    status?: string
    limit?: number
    offset?: number
  }, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.getHistory(filters)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch notification history')
    }
  }
)

export const fetchNotificationStats = createAsyncThunk(
  'notifications/fetchStats',
  async (days?: number, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.getStats(days)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch notification stats')
    }
  }
)

export const fetchNotificationChannels = createAsyncThunk(
  'notifications/fetchChannels',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.getChannels()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch notification channels')
    }
  }
)

export const fetchActiveAlerts = createAsyncThunk(
  'notifications/fetchActiveAlerts',
  async (filters?: { severity?: string; serverId?: string }, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.getActiveAlerts(filters)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch active alerts')
    }
  }
)

export const sendTestNotification = createAsyncThunk(
  'notifications/sendTest',
  async ({ channels, message }: { channels: string[]; message?: string }, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.sendTest(channels, message)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to send test notification')
    }
  }
)

export const retryFailedNotifications = createAsyncThunk(
  'notifications/retryFailed',
  async (hours?: number, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.retryFailed(hours)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to retry notifications')
    }
  }
)

export const createManualAlert = createAsyncThunk(
  'notifications/createManualAlert',
  async (alertData: {
    serverId?: string
    serviceId?: string
    type: string
    severity: string
    title: string
    message: string
    channels?: string[]
  }, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.createAlert(alertData)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create alert')
    }
  }
)

export const updateNotificationSettings = createAsyncThunk(
  'notifications/updateSettings',
  async (settings: {
    defaultChannels?: string[]
    severityFilters?: Record<string, string[]>
    rateLimits?: {
      maxPerHour: number
      maxPerDay: number
    }
  }, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.updateSettings(settings)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update settings')
    }
  }
)

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    addNotification: (state, action) => {
      state.history.unshift(action.payload)
      // Keep only last 100 notifications in memory
      if (state.history.length > 100) {
        state.history.pop()
      }
    },
    updateNotificationStatus: (state, action) => {
      const { id, status, sentAt, error } = action.payload
      const notification = state.history.find(n => n.id === id)
      if (notification) {
        notification.status = status
        if (sentAt) notification.sentAt = sentAt
        if (error) notification.error = error
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch Notification History
    builder.addCase(fetchNotificationHistory.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(fetchNotificationHistory.fulfilled, (state, action) => {
      state.isLoading = false
      state.history = action.payload.notifications || action.payload
      state.total = action.payload.total || state.history.length
      state.hasMore = action.payload.hasMore || false
    })
    builder.addCase(fetchNotificationHistory.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Fetch Notification Stats
    builder.addCase(fetchNotificationStats.pending, (state) => {
      state.isLoadingStats = true
      state.error = null
    })
    builder.addCase(fetchNotificationStats.fulfilled, (state, action) => {
      state.isLoadingStats = false
      state.stats = action.payload
    })
    builder.addCase(fetchNotificationStats.rejected, (state, action) => {
      state.isLoadingStats = false
      state.error = action.payload as string
    })

    // Fetch Notification Channels
    builder.addCase(fetchNotificationChannels.fulfilled, (state, action) => {
      state.channels = action.payload
    })

    // Fetch Active Alerts
    builder.addCase(fetchActiveAlerts.fulfilled, (state, action) => {
      state.activeAlerts = action.payload
    })

    // Send Test Notification
    builder.addCase(sendTestNotification.pending, (state) => {
      state.isSending = true
      state.error = null
    })
    builder.addCase(sendTestNotification.fulfilled, (state) => {
      state.isSending = false
    })
    builder.addCase(sendTestNotification.rejected, (state, action) => {
      state.isSending = false
      state.error = action.payload as string
    })

    // Retry Failed Notifications
    builder.addCase(retryFailedNotifications.pending, (state) => {
      state.isSending = true
      state.error = null
    })
    builder.addCase(retryFailedNotifications.fulfilled, (state) => {
      state.isSending = false
    })
    builder.addCase(retryFailedNotifications.rejected, (state, action) => {
      state.isSending = false
      state.error = action.payload as string
    })

    // Create Manual Alert
    builder.addCase(createManualAlert.pending, (state) => {
      state.isSending = true
      state.error = null
    })
    builder.addCase(createManualAlert.fulfilled, (state) => {
      state.isSending = false
    })
    builder.addCase(createManualAlert.rejected, (state, action) => {
      state.isSending = false
      state.error = action.payload as string
    })
  },
})

export const {
  clearError,
  addNotification,
  updateNotificationStatus,
} = notificationsSlice.actions

export default notificationsSlice.reducer
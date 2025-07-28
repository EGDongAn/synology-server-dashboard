import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { authApi } from '../../services/api/auth'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,
}

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.login(email, password)
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', response.data.accessToken)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Login failed')
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout()
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      // Always clear local storage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  }
)

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState() as { auth: AuthState }
      if (!auth.refreshToken) {
        throw new Error('No refresh token available')
      }
      
      const response = await authApi.refreshToken(auth.refreshToken)
      
      // Update access token
      localStorage.setItem('accessToken', response.data.accessToken)
      
      return response.data
    } catch (error: any) {
      // Clear tokens on refresh failure
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      return rejectWithValue(error.response?.data?.error || 'Token refresh failed')
    }
  }
)

export const getProfile = createAsyncThunk(
  'auth/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfile()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get profile')
    }
  }
)

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (
    { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
    { rejectWithValue }
  ) => {
    try {
      await authApi.changePassword(currentPassword, newPassword)
      return { message: 'Password changed successfully' }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to change password')
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.isAuthenticated = true
      localStorage.setItem('accessToken', action.payload.accessToken)
      localStorage.setItem('refreshToken', action.payload.refreshToken)
    },
    clearAuth: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    },
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(login.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.isAuthenticated = true
      state.error = null
    })
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
      state.isAuthenticated = false
    })

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
    })

    // Refresh Token
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      state.accessToken = action.payload.accessToken
      state.isAuthenticated = true
    })
    builder.addCase(refreshToken.rejected, (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
    })

    // Get Profile
    builder.addCase(getProfile.pending, (state) => {
      state.isLoading = true
    })
    builder.addCase(getProfile.fulfilled, (state, action) => {
      state.isLoading = false
      state.user = action.payload
    })
    builder.addCase(getProfile.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })

    // Change Password
    builder.addCase(changePassword.pending, (state) => {
      state.isLoading = true
      state.error = null
    })
    builder.addCase(changePassword.fulfilled, (state) => {
      state.isLoading = false
    })
    builder.addCase(changePassword.rejected, (state, action) => {
      state.isLoading = false
      state.error = action.payload as string
    })
  },
})

export const { clearError, setTokens, clearAuth } = authSlice.actions
export default authSlice.reducer
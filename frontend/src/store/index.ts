import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import authSlice from './slices/authSlice'
import serversSlice from './slices/serversSlice'
import dockerSlice from './slices/dockerSlice'
import monitoringSlice from './slices/monitoringSlice'
import notificationsSlice from './slices/notificationsSlice'
import deploymentsSlice from './slices/deploymentsSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    servers: serversSlice,
    docker: dockerSlice,
    monitoring: monitoringSlice,
    notifications: notificationsSlice,
    deployments: deploymentsSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
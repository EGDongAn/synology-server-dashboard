import React from 'react'
import { Spin } from 'antd'

const LoadingSpinner: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column'
    }}>
      <Spin size="large" />
      <div style={{ marginTop: '16px', color: '#666' }}>
        Loading...
      </div>
    </div>
  )
}

export default LoadingSpinner
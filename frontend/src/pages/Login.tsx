import React from 'react'
import { Form, Input, Button, Card, Alert, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { login } from '../store/slices/authSlice'

const { Title } = Typography

interface LoginForm {
  email: string
  password: string
}

const Login: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isLoading, error } = useAppSelector(state => state.auth)

  const onFinish = async (values: LoginForm) => {
    console.log('🔐 Login attempt:', values)
    console.log('🌐 API URL:', import.meta.env.VITE_API_URL)
    try {
      const result = await dispatch(login(values))
      console.log('✅ Login result:', result)
      if (result.type === 'auth/login/fulfilled') {
        console.log('🎉 Login successful, redirecting...')
      } else {
        console.log('❌ Login failed:', result.payload)
      }
    } catch (error) {
      console.error('💥 Login error:', error)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ color: '#1677ff', marginBottom: '8px' }}>
            Server Dashboard
          </Title>
          <p style={{ color: '#666', margin: 0 }}>
            Sign in to manage your servers
          </p>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              style={{ width: '100%' }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
          Synology Server Management Dashboard
        </div>
      </Card>
    </div>
  )
}

export default Login
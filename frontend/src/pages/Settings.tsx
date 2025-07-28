import React, { useState } from 'react'
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Space, 
  Typography, 
  Tabs,
  Switch,
  Select,
  InputNumber,
  Divider,
  message,
  Alert
} from 'antd'
import { 
  UserOutlined, 
  BellOutlined, 
  SecurityScanOutlined,
  SettingOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { changePassword } from '../store/slices/authSlice'
import { updateNotificationSettings } from '../store/slices/notificationsSlice'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { Option } = Select

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector(state => state.auth)
  const { channels } = useAppSelector(state => state.notifications)
  
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [notificationForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (values: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('New passwords do not match')
      return
    }

    setLoading(true)
    try {
      await dispatch(changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })).unwrap()
      message.success('Password changed successfully')
      passwordForm.resetFields()
    } catch (error: any) {
      message.error(error || 'Failed to change password')
    }
    setLoading(false)
  }

  const handleUpdateNotificationSettings = async (values: any) => {
    setLoading(true)
    try {
      await dispatch(updateNotificationSettings(values)).unwrap()
      message.success('Notification settings updated successfully')
    } catch (error: any) {
      message.error(error || 'Failed to update settings')
    }
    setLoading(false)
  }

  return (
    <div>
      <Title level={2}>Settings</Title>

      <Tabs defaultActiveKey="profile">
        <TabPane tab={<span><UserOutlined />Profile</span>} key="profile">
          <Card title="User Profile">
            <Form
              form={profileForm}
              layout="vertical"
              initialValues={{
                name: user?.name,
                email: user?.email,
              }}
            >
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter your name' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input disabled />
              </Form.Item>

              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />}>
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="Change Password" style={{ marginTop: '24px' }}>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
            >
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: 'Please enter your current password' }]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: 'Please enter a new password' },
                  { min: 8, message: 'Password must be at least 8 characters' }
                ]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                rules={[{ required: true, message: 'Please confirm your new password' }]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={loading}
                  icon={<SaveOutlined />}
                >
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab={<span><BellOutlined />Notifications</span>} key="notifications">
          <Card title="Notification Settings">
            <Form
              form={notificationForm}
              layout="vertical"
              onFinish={handleUpdateNotificationSettings}
              initialValues={{
                defaultChannels: ['email'],
                enableRealTime: true,
                enableEmail: true,
                enableSlack: false,
                enableWebhook: false,
                maxPerHour: 10,
                maxPerDay: 50,
                criticalOnly: false
              }}
            >
              <Title level={4}>Default Channels</Title>
              <Form.Item
                name="defaultChannels"
                label="Default notification channels for new alerts"
              >
                <Select mode="multiple" placeholder="Select default channels">
                  {channels.map(channel => (
                    <Option key={channel.type} value={channel.type}>
                      {channel.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Divider />

              <Title level={4}>Channel Settings</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Real-time notifications</Text>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Show notifications in browser
                    </div>
                  </div>
                  <Form.Item name="enableRealTime" valuePropName="checked" style={{ margin: 0 }}>
                    <Switch />
                  </Form.Item>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Email notifications</Text>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Send alerts via email
                    </div>
                  </div>
                  <Form.Item name="enableEmail" valuePropName="checked" style={{ margin: 0 }}>
                    <Switch />
                  </Form.Item>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Slack notifications</Text>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Send alerts to Slack
                    </div>
                  </div>
                  <Form.Item name="enableSlack" valuePropName="checked" style={{ margin: 0 }}>
                    <Switch />
                  </Form.Item>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Webhook notifications</Text>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Send alerts to custom webhook
                    </div>
                  </div>
                  <Form.Item name="enableWebhook" valuePropName="checked" style={{ margin: 0 }}>
                    <Switch />
                  </Form.Item>
                </div>
              </Space>

              <Divider />

              <Title level={4}>Rate Limiting</Title>
              <Space>
                <Form.Item
                  name="maxPerHour"
                  label="Max notifications per hour"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={1} max={100} />
                </Form.Item>

                <Form.Item
                  name="maxPerDay"
                  label="Max notifications per day"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={1} max={1000} />
                </Form.Item>
              </Space>

              <Divider />

              <Title level={4}>Filtering</Title>
              <Form.Item name="criticalOnly" valuePropName="checked">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Critical alerts only</Text>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Only send notifications for critical severity alerts
                    </div>
                  </div>
                  <Switch />
                </div>
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={loading}
                  icon={<SaveOutlined />}
                >
                  Save Notification Settings
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab={<span><SecurityScanOutlined />Security</span>} key="security">
          <Card title="Security Settings">
            <Alert
              message="Security Features"
              description="Additional security features will be available in future updates."
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Two-Factor Authentication</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Add an extra layer of security to your account
                  </div>
                </div>
                <Button disabled>Configure</Button>
              </div>

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>API Keys</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Manage API keys for external integrations
                  </div>
                </div>
                <Button disabled>Manage</Button>
              </div>

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Session Management</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    View and manage active sessions
                  </div>
                </div>
                <Button disabled>View Sessions</Button>
              </div>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={<span><SettingOutlined />System</span>} key="system">
          <Card title="System Settings">
            <Alert
              message="System Configuration"
              description="System-wide settings and configurations will be available in future updates."
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Database Backup</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Configure automatic database backups
                  </div>
                </div>
                <Button disabled>Configure</Button>
              </div>

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Log Retention</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Set how long to keep system logs
                  </div>
                </div>
                <Button disabled>Configure</Button>
              </div>

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>System Updates</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Check for and install system updates
                  </div>
                </div>
                <Button disabled>Check Updates</Button>
              </div>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}

export default SettingsPage
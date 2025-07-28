import React, { useEffect, useState } from 'react'
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Select,
  DatePicker,
  Modal,
  Form,
  Input,
  Checkbox,
  message,
  Alert
} from 'antd'
import { 
  BellOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  SettingOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { 
  fetchNotificationHistory,
  fetchNotificationStats,
  fetchNotificationChannels,
  fetchActiveAlerts,
  sendTestNotification,
  retryFailedNotifications
} from '../store/slices/notificationsSlice'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const NotificationsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { 
    history, 
    channels, 
    stats, 
    activeAlerts,
    isLoading,
    isLoadingStats,
    isSending
  } = useAppSelector(state => state.notifications)

  const [filters, setFilters] = useState<{
    channel?: string
    status?: string
    limit: number
  }>({ limit: 50 })
  
  const [testModalVisible, setTestModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    dispatch(fetchNotificationHistory(filters))
    dispatch(fetchNotificationStats(7))
    dispatch(fetchNotificationChannels())
    dispatch(fetchActiveAlerts())
  }, [dispatch])

  useEffect(() => {
    dispatch(fetchNotificationHistory(filters))
  }, [dispatch, filters])

  const handleSendTestNotification = async (values: { 
    channels: string[]
    message: string 
  }) => {
    try {
      await dispatch(sendTestNotification(values)).unwrap()
      message.success('Test notification sent successfully')
      setTestModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      message.error(error || 'Failed to send test notification')
    }
  }

  const handleRetryFailed = async () => {
    try {
      const result = await dispatch(retryFailedNotifications(24)).unwrap()
      message.success(`Retried ${result.retriedCount} failed notifications`)
      dispatch(fetchNotificationHistory(filters))
    } catch (error: any) {
      message.error(error || 'Failed to retry notifications')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'green'
      case 'FAILED': return 'red'
      case 'PENDING': return 'orange'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'FAILED': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'PENDING': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />
      default: return null
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'red'
      case 'HIGH': return 'orange'
      case 'MEDIUM': return 'yellow'
      case 'LOW': return 'green'
      default: return 'default'
    }
  }

  const historyColumns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Space>
          {getStatusIcon(status)}
          <Tag color={getStatusColor(status)}>{status}</Tag>
        </Space>
      ),
    },
    {
      title: 'Alert',
      dataIndex: 'alert',
      key: 'alert',
      render: (alert: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{alert.title}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {alert.message}
          </Text>
          <div style={{ marginTop: '4px' }}>
            <Tag color={getSeverityColor(alert.severity)} size="small">
              {alert.severity}
            </Tag>
            {alert.server && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {alert.server.name}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      render: (channel: string) => (
        <Tag>{channel.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Attempts',
      dataIndex: 'attempts',
      key: 'attempts',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString(),
    },
    {
      title: 'Sent',
      dataIndex: 'sentAt',
      key: 'sentAt',
      render: (sentAt: string) => sentAt ? new Date(sentAt).toLocaleString() : '-',
    },
    {
      title: 'Error',
      dataIndex: 'error',
      key: 'error',
      render: (error: string) => error ? (
        <Text type="danger" style={{ fontSize: '12px' }}>
          {error.length > 50 ? `${error.substring(0, 50)}...` : error}
        </Text>
      ) : '-',
    },
  ]

  const alertColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>{severity}</Tag>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{title}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.message}
          </Text>
        </div>
      ),
    },
    {
      title: 'Server',
      dataIndex: 'server',
      key: 'server',
      render: (server: any) => server ? server.name : '-',
    },
    {
      title: 'Notifications',
      dataIndex: 'notifications',
      key: 'notifications',
      render: (notifications: any[]) => (
        <Space>
          {notifications?.map((notif, index) => (
            <Tag key={index} color={getStatusColor(notif.status)}>
              {notif.channel}: {notif.status}
            </Tag>
          )) || 'No notifications'}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString(),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Notifications</Title>
        <Space>
          <Button 
            icon={<SendOutlined />}
            onClick={() => setTestModalVisible(true)}
          >
            Send Test
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            onClick={handleRetryFailed}
            loading={isSending}
          >
            Retry Failed
          </Button>
          <Button icon={<SettingOutlined />}>
            Settings
          </Button>
        </Space>
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Sent"
                value={stats.total}
                prefix={<BellOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Success Rate"
                value={stats.successRate}
                suffix="%"
                valueStyle={{ 
                  color: stats.successRate > 95 ? '#3f8600' : '#cf1322' 
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Successful"
                value={stats.sent}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Failed"
                value={stats.failed}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Notification Channels">
            <Space direction="vertical" style={{ width: '100%' }}>
              {channels.map(channel => (
                <div key={channel.type} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0'
                }}>
                  <div>
                    <Text strong>{channel.name}</Text>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {channel.description}
                    </div>
                  </div>
                  <Tag color={channel.configured ? 'green' : 'red'}>
                    {channel.configured ? 'Configured' : 'Not Configured'}
                  </Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="Channel Statistics" loading={isLoadingStats}>
            {stats?.byChannel && (
              <Space direction="vertical" style={{ width: '100%' }}>
                {stats.byChannel.map(item => (
                  <div key={item.channel} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Text>{item.channel.toUpperCase()}</Text>
                    <Text strong>{item.count}</Text>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Card 
        title="Active Alerts"
        style={{ marginBottom: '24px' }}
      >
        <Table
          columns={alertColumns}
          dataSource={activeAlerts}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      <Card 
        title="Notification History"
        extra={
          <Space>
            <Select
              placeholder="Filter by channel"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, channel: value })}
            >
              {channels.map(channel => (
                <Option key={channel.type} value={channel.type}>
                  {channel.name}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Filter by status"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="SENT">Sent</Option>
              <Option value="FAILED">Failed</Option>
              <Option value="PENDING">Pending</Option>
            </Select>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => dispatch(fetchNotificationHistory(filters))}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} notifications`,
          }}
        />
      </Card>

      <Modal
        title="Send Test Notification"
        open={testModalVisible}
        onOk={form.submit}
        onCancel={() => setTestModalVisible(false)}
        confirmLoading={isSending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSendTestNotification}
          initialValues={{ 
            message: 'This is a test notification from Server Dashboard' 
          }}
        >
          <Form.Item
            name="channels"
            label="Channels"
            rules={[{ required: true, message: 'Please select at least one channel' }]}
          >
            <Checkbox.Group>
              <Space direction="vertical">
                {channels
                  .filter(channel => channel.configured)
                  .map(channel => (
                    <Checkbox key={channel.type} value={channel.type}>
                      {channel.name}
                    </Checkbox>
                  ))
                }
              </Space>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter a message' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotificationsPage
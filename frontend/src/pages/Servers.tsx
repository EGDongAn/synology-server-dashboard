import React, { useEffect, useState } from 'react'
import { 
  Card, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select,
  message,
  Tooltip,
  Progress,
  Typography,
  Row,
  Col,
  Statistic
} from 'antd'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  EyeOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { 
  fetchServers, 
  createServer, 
  updateServer, 
  deleteServer,
  testConnection,
  updateResources
} from '../store/slices/serversSlice'

const { Title, Text } = Typography
const { Option } = Select
const { confirm } = Modal

interface ServerFormData {
  name: string
  ipAddress: string
  sshPort: number
  username: string
  password?: string
  privateKey?: string
  authType: 'password' | 'key'
  tags: string[]
}

const ServersPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { servers, isLoading, error } = useAppSelector(state => state.servers)
  const { latestMetrics } = useAppSelector(state => state.monitoring)
  
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    dispatch(fetchServers())
  }, [dispatch])

  const handleAddServer = () => {
    setEditingServer(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEditServer = (server: any) => {
    setEditingServer(server)
    form.setFieldsValue({
      ...server,
      tags: server.tags || []
    })
    setIsModalVisible(true)
  }

  const handleDeleteServer = (server: any) => {
    confirm({
      title: 'Delete Server',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete server "${server.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        dispatch(deleteServer(server.id))
          .unwrap()
          .then(() => {
            message.success('Server deleted successfully')
          })
          .catch((error) => {
            message.error(error || 'Failed to delete server')
          })
      },
    })
  }

  const handleTestConnection = async (serverId: string) => {
    try {
      await dispatch(testConnection(serverId)).unwrap()
      message.success('Connection test successful')
    } catch (error: any) {
      message.error(error || 'Connection test failed')
    }
  }

  const handleUpdateResources = async (serverId: string) => {
    try {
      await dispatch(updateResources(serverId)).unwrap()
      message.success('Resources updated successfully')
    } catch (error: any) {
      message.error(error || 'Failed to update resources')
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const serverData: ServerFormData = {
        ...values,
        sshPort: Number(values.sshPort || 22),
        tags: values.tags || []
      }

      if (editingServer) {
        await dispatch(updateServer({ id: editingServer.id, data: serverData })).unwrap()
        message.success('Server updated successfully')
      } else {
        await dispatch(createServer(serverData)).unwrap()
        message.success('Server created successfully')
      }
      
      setIsModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      message.error(error || 'Operation failed')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'green'
      case 'OFFLINE': return 'red'
      case 'WARNING': return 'orange'
      default: return 'default'
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <Text type="secondary">{record.ipAddress}:{record.sshPort || 22}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Resources',
      key: 'resources',
      render: (record: any) => {
        const metrics = latestMetrics[record.id]
        if (!metrics) {
          return <Text type="secondary">No data</Text>
        }
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div>
              <Text style={{ fontSize: '12px' }}>CPU: {metrics.cpu.toFixed(1)}%</Text>
              <Progress 
                percent={metrics.cpu} 
                size="small" 
                status={metrics.cpu > 80 ? 'exception' : 'normal'}
                showInfo={false}
              />
            </div>
            <div>
              <Text style={{ fontSize: '12px' }}>Memory: {metrics.memory.toFixed(1)}%</Text>
              <Progress 
                percent={metrics.memory} 
                size="small"
                status={metrics.memory > 85 ? 'exception' : 'normal'}
                showInfo={false}
              />
            </div>
          </Space>
        )
      },
    },
    {
      title: 'Containers',
      key: 'containers',
      render: (record: any) => {
        const metrics = latestMetrics[record.id]
        if (!metrics?.containers) {
          return <Text type="secondary">-</Text>
        }
        return (
          <div>
            <div>{metrics.containers.running}/{metrics.containers.total}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {metrics.containers.stopped} stopped
            </Text>
          </div>
        )
      },
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags?.map((tag, index) => (
            <Tag key={index} size="small">{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              size="small" 
              icon={<EyeOutlined />}
              href={`/servers/${record.id}`}
            />
          </Tooltip>
          <Tooltip title="Test Connection">
            <Button 
              size="small" 
              icon={<PlayCircleOutlined />}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Tooltip title="Update Resources">
            <Button 
              size="small" 
              icon={<ReloadOutlined />}
              onClick={() => handleUpdateResources(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEditServer(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteServer(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const serverStats = {
    total: servers.length,
    online: servers.filter(s => s.status === 'ONLINE').length,
    offline: servers.filter(s => s.status === 'OFFLINE').length,
    warning: servers.filter(s => s.status === 'WARNING').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Servers</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddServer}>
          Add Server
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total" value={serverStats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Online" 
              value={serverStats.online} 
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Warning" 
              value={serverStats.warning} 
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Offline" 
              value={serverStats.offline} 
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={servers}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} servers`,
          }}
        />
      </Card>

      <Modal
        title={editingServer ? 'Edit Server' : 'Add Server'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            sshPort: 22,
            authType: 'password'
          }}
        >
          <Form.Item
            name="name"
            label="Server Name"
            rules={[{ required: true, message: 'Please enter server name' }]}
          >
            <Input placeholder="Enter server name" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="ipAddress"
                label="IP Address"
                rules={[
                  { required: true, message: 'Please enter IP address' },
                  { 
                    pattern: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9.-]+$/,
                    message: 'Please enter valid IP address or hostname'
                  }
                ]}
              >
                <Input placeholder="192.168.1.100 or hostname" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="sshPort"
                label="SSH Port"
              >
                <Input type="number" placeholder="22" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Please enter username' }]}
          >
            <Input placeholder="Enter SSH username" />
          </Form.Item>

          <Form.Item
            name="authType"
            label="Authentication Type"
          >
            <Select>
              <Option value="password">Password</Option>
              <Option value="key">Private Key</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.authType !== currentValues.authType
            }
          >
            {({ getFieldValue }) => {
              const authType = getFieldValue('authType')
              return authType === 'password' ? (
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[{ required: true, message: 'Please enter password' }]}
                >
                  <Input.Password placeholder="Enter SSH password" />
                </Form.Item>
              ) : (
                <Form.Item
                  name="privateKey"
                  label="Private Key"
                  rules={[{ required: true, message: 'Please enter private key' }]}
                >
                  <Input.TextArea 
                    rows={4} 
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  />
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item
            name="tags"
            label="Tags"
          >
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="Add tags..."
              tokenSeparators={[',']}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ServersPage
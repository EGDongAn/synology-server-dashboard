import React, { useEffect, useState } from 'react'
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  Progress,
  message
} from 'antd'
import { 
  PlusOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  StopOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchServers } from '../store/slices/serversSlice'
import { 
  fetchDeployments,
  fetchDeploymentStats,
  createDeployment,
  deployService,
  rollbackDeployment,
  stopDeployment,
  restartService,
  deleteDeployment
} from '../store/slices/deploymentsSlice'

const { Title, Text } = Typography
const { Option } = Select
const { confirm } = Modal

const DeploymentsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { servers } = useAppSelector(state => state.servers)
  const { 
    deployments, 
    stats, 
    isLoading, 
    isLoadingStats, 
    isDeploying 
  } = useAppSelector(state => state.deployments)

  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null)
  const [filters, setFilters] = useState<{
    serverId?: string
    status?: string
  }>({})
  const [form] = Form.useForm()
  const [rollbackForm] = Form.useForm()

  useEffect(() => {
    dispatch(fetchServers())
    dispatch(fetchDeployments(filters))
    dispatch(fetchDeploymentStats())
  }, [dispatch])

  useEffect(() => {
    dispatch(fetchDeployments(filters))
  }, [dispatch, filters])

  const handleCreateDeployment = async (values: any) => {
    try {
      await dispatch(createDeployment(values)).unwrap()
      message.success('Deployment created successfully')
      setCreateModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      message.error(error || 'Failed to create deployment')
    }
  }

  const handleDeploy = async (deploymentId: string) => {
    try {
      await dispatch(deployService(deploymentId)).unwrap()
      message.success('Deployment started successfully')
    } catch (error: any) {
      message.error(error || 'Failed to start deployment')
    }
  }

  const handleRollback = async (values: any) => {
    if (!selectedDeployment) return
    
    try {
      await dispatch(rollbackDeployment({
        id: selectedDeployment.id,
        targetVersion: values.targetVersion
      })).unwrap()
      message.success('Rollback started successfully')
      setRollbackModalVisible(false)
      rollbackForm.resetFields()
    } catch (error: any) {
      message.error(error || 'Failed to start rollback')
    }
  }

  const handleStop = async (deploymentId: string) => {
    try {
      await dispatch(stopDeployment(deploymentId)).unwrap()
      message.success('Deployment stopped successfully')
    } catch (error: any) {
      message.error(error || 'Failed to stop deployment')
    }
  }

  const handleRestart = async (deploymentId: string) => {
    try {
      await dispatch(restartService(deploymentId)).unwrap()
      message.success('Service restarted successfully')
    } catch (error: any) {
      message.error(error || 'Failed to restart service')
    }
  }

  const handleDelete = (deployment: any) => {
    confirm({
      title: 'Delete Deployment',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete deployment "${deployment.service.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        dispatch(deleteDeployment(deployment.id))
          .unwrap()
          .then(() => {
            message.success('Deployment deleted successfully')
          })
          .catch((error) => {
            message.error(error || 'Failed to delete deployment')
          })
      },
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'green'
      case 'FAILED': 
      case 'ROLLBACK_FAILED': return 'red'
      case 'DEPLOYING': 
      case 'ROLLING_BACK': 
      case 'STOPPING': return 'blue'
      case 'STOPPED': 
      case 'ROLLED_BACK': return 'orange'
      case 'PENDING': return 'yellow'
      default: return 'default'
    }
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'red'
      case 'staging': return 'orange'
      case 'development': return 'green'
      default: return 'default'
    }
  }

  const columns = [
    {
      title: 'Service',
      key: 'service',
      render: (record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.service?.name || record.name}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.server?.name} ({record.server?.ipAddress || 'N/A'})
          </Text>
        </div>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (version: string) => (
        <Tag>{version}</Tag>
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
      title: 'Environment',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: string) => (
        <Tag color={getEnvironmentColor(env)}>
          {env.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => (
        <Text style={{ fontSize: '12px' }}>
          {new Date(createdAt).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          {record.status === 'PENDING' || record.status === 'FAILED' ? (
            <Tooltip title="Deploy">
              <Button 
                size="small" 
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleDeploy(record.id)}
                loading={isDeploying}
              />
            </Tooltip>
          ) : null}
          
          {record.status === 'RUNNING' ? (
            <>
              <Tooltip title="Rollback">
                <Button 
                  size="small" 
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    setSelectedDeployment(record)
                    setRollbackModalVisible(true)
                  }}
                />
              </Tooltip>
              <Tooltip title="Restart">
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                  onClick={() => handleRestart(record.id)}
                />
              </Tooltip>
              <Tooltip title="Stop">
                <Button 
                  size="small" 
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleStop(record.id)}
                />
              </Tooltip>
            </>
          ) : null}
          
          <Tooltip title="View Details">
            <Button 
              size="small" 
              icon={<EyeOutlined />}
              href={`/deployments/${record.id}`}
            />
          </Tooltip>
          
          {record.status !== 'RUNNING' && record.status !== 'DEPLOYING' && (
            <Tooltip title="Delete">
              <Button 
                size="small" 
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Deployments</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setCreateModalVisible(true)}
        >
          Create Deployment
        </Button>
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Deployments"
                value={stats.total}
                loading={isLoadingStats}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Running"
                value={stats.running}
                valueStyle={{ color: '#3f8600' }}
                loading={isLoadingStats}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Failed"
                value={stats.failed}
                valueStyle={{ color: '#cf1322' }}
                loading={isLoadingStats}
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
                  color: stats.successRate > 90 ? '#3f8600' : '#cf1322' 
                }}
                loading={isLoadingStats}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card
        title="Deployments"
        extra={
          <Space>
            <Select
              placeholder="Filter by server"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, serverId: value })}
            >
              {servers.map(server => (
                <Option key={server.id} value={server.id}>
                  {server.name}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Filter by status"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="PENDING">Pending</Option>
              <Option value="DEPLOYING">Deploying</Option>
              <Option value="RUNNING">Running</Option>
              <Option value="FAILED">Failed</Option>
              <Option value="STOPPED">Stopped</Option>
            </Select>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => dispatch(fetchDeployments(filters))}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={deployments}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} deployments`,
          }}
        />
      </Card>

      {/* Create Deployment Modal */}
      <Modal
        title="Create Deployment"
        open={createModalVisible}
        onOk={form.submit}
        onCancel={() => setCreateModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateDeployment}
          initialValues={{
            environment: 'development'
          }}
        >
          <Form.Item
            name="serverId"
            label="Server"
            rules={[{ required: true, message: 'Please select a server' }]}
          >
            <Select placeholder="Select server">
              {servers
                .filter(server => server.status === 'ONLINE')
                .map(server => (
                  <Option key={server.id} value={server.id}>
                    {server.name} ({server.ipAddress})
                  </Option>
                ))
              }
            </Select>
          </Form.Item>

          <Form.Item
            name="serviceId"
            label="Service"
            rules={[{ required: true, message: 'Please enter service ID' }]}
          >
            <Input placeholder="Service ID (will be auto-populated from service list)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="version"
                label="Version"
                rules={[{ required: true, message: 'Please enter version' }]}
              >
                <Input placeholder="1.0.0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="environment"
                label="Environment"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="development">Development</Option>
                  <Option value="staging">Staging</Option>
                  <Option value="production">Production</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Deployment description..." />
          </Form.Item>

          <Form.Item
            name="healthCheckUrl"
            label="Health Check URL"
          >
            <Input placeholder="http://localhost:8080/health" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rollback Modal */}
      <Modal
        title="Rollback Deployment"
        open={rollbackModalVisible}
        onOk={rollbackForm.submit}
        onCancel={() => setRollbackModalVisible(false)}
      >
        <Form
          form={rollbackForm}
          layout="vertical"
          onFinish={handleRollback}
        >
          <div style={{ marginBottom: '16px' }}>
            <Text strong>Service: </Text>
            <Text>{selectedDeployment?.service?.name}</Text>
            <br />
            <Text strong>Current Version: </Text>
            <Text>{selectedDeployment?.version}</Text>
          </div>

          <Form.Item
            name="targetVersion"
            label="Target Version (optional)"
            help="Leave empty to rollback to the previous version"
          >
            <Input placeholder="1.0.0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DeploymentsPage
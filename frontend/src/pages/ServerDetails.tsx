import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Progress,
  Table,
  Tabs,
  Modal,
  Input,
  message,
  Alert
} from 'antd'
import { 
  ArrowLeftOutlined, 
  ReloadOutlined, 
  PlayCircleOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  ContainerOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchServer, testConnection, executeCommand } from '../store/slices/serversSlice'
import { fetchServerMetrics } from '../store/slices/monitoringSlice'
import { fetchContainers } from '../store/slices/dockerSlice'

const { Title, Text } = Typography
const { TabPane } = Tabs

const ServerDetailsPage: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  
  const { currentServer, isLoading } = useAppSelector(state => state.servers)
  const { metrics, latestMetrics } = useAppSelector(state => state.monitoring)
  const { containers } = useAppSelector(state => state.docker)
  
  const [commandModalVisible, setCommandModalVisible] = useState(false)
  const [command, setCommand] = useState('')
  const [commandResult, setCommandResult] = useState<any>(null)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (serverId) {
      dispatch(fetchServer(serverId))
      dispatch(fetchServerMetrics({ serverId, hours: 24 }))
      dispatch(fetchContainers({ serverId }))
    }
  }, [dispatch, serverId])

  const handleTestConnection = async () => {
    if (!serverId) return
    try {
      await dispatch(testConnection(serverId)).unwrap()
      message.success('Connection test successful')
    } catch (error: any) {
      message.error(error || 'Connection test failed')
    }
  }

  const handleExecuteCommand = async () => {
    if (!serverId || !command.trim()) return
    
    setExecuting(true)
    try {
      const result = await dispatch(executeCommand({ 
        serverId, 
        command: command.trim() 
      })).unwrap()
      setCommandResult(result)
    } catch (error: any) {
      message.error(error || 'Command execution failed')
    }
    setExecuting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'green'
      case 'OFFLINE': return 'red'
      case 'WARNING': return 'orange'
      default: return 'default'
    }
  }

  const containerColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => name.replace(/^\//, ''),
    },
    {
      title: 'Image',
      dataIndex: 'image',
      key: 'image',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'running' ? 'green' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      render: (created: string) => new Date(created * 1000).toLocaleDateString(),
    },
  ]

  if (!currentServer && !isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Alert
          message="Server not found"
          description="The requested server could not be found."
          type="error"
          showIcon
        />
        <Button 
          type="primary" 
          style={{ marginTop: '16px' }}
          onClick={() => navigate('/servers')}
        >
          Back to Servers
        </Button>
      </div>
    )
  }

  const serverMetrics = latestMetrics[serverId || '']
  const serverContainers = containers[serverId || ''] || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/servers')}
          style={{ marginRight: '16px' }}
        >
          Back
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ margin: 0 }}>
            {currentServer?.name}
          </Title>
          <Text type="secondary">
            {currentServer?.ipAddress}:{currentServer?.sshPort || 22}
          </Text>
        </div>
        <Space>
          <Button 
            icon={<PlayCircleOutlined />} 
            onClick={handleTestConnection}
          >
            Test Connection
          </Button>
          <Button 
            icon={<CodeOutlined />} 
            onClick={() => setCommandModalVisible(true)}
          >
            Execute Command
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => serverId && dispatch(fetchServerMetrics({ serverId }))}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Status"
              value={currentServer?.status || 'UNKNOWN'}
              valueStyle={{ 
                color: currentServer ? getStatusColor(currentServer.status) === 'green' ? '#3f8600' : 
                      getStatusColor(currentServer.status) === 'red' ? '#cf1322' : '#d46b08' : '#666'
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="CPU Usage"
              value={serverMetrics?.cpu?.toFixed(1) || 0}
              suffix="%"
              valueStyle={{ 
                color: (serverMetrics?.cpu || 0) > 80 ? '#cf1322' : '#3f8600' 
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Memory Usage"
              value={serverMetrics?.memory?.toFixed(1) || 0}
              suffix="%"
              valueStyle={{ 
                color: (serverMetrics?.memory || 0) > 85 ? '#cf1322' : '#3f8600' 
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Disk Usage"
              value={serverMetrics?.disk?.toFixed(1) || 0}
              suffix="%"
              valueStyle={{ 
                color: (serverMetrics?.disk || 0) > 90 ? '#cf1322' : '#3f8600' 
              }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="overview">
        <TabPane tab="Overview" key="overview">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="Server Information" extra={<InfoCircleOutlined />}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Name:</Text> {currentServer?.name}
                  </div>
                  <div>
                    <Text strong>IP Address:</Text> {currentServer?.ipAddress}
                  </div>
                  <div>
                    <Text strong>SSH Port:</Text> {currentServer?.sshPort || 22}
                  </div>
                  <div>
                    <Text strong>Username:</Text> {currentServer?.username}
                  </div>
                  <div>
                    <Text strong>Status:</Text>{' '}
                    <Tag color={getStatusColor(currentServer?.status || 'UNKNOWN')}>
                      {currentServer?.status}
                    </Tag>
                  </div>
                  {currentServer?.tags && currentServer.tags.length > 0 && (
                    <div>
                      <Text strong>Tags:</Text>
                      <div style={{ marginTop: '8px' }}>
                        {currentServer.tags.map((tag, index) => (
                          <Tag key={index}>{tag}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card title="Resource Usage">
                {serverMetrics ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>CPU Usage</Text>
                        <Text>{serverMetrics.cpu.toFixed(1)}%</Text>
                      </div>
                      <Progress 
                        percent={serverMetrics.cpu} 
                        status={serverMetrics.cpu > 80 ? 'exception' : 'normal'}
                      />
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Memory Usage</Text>
                        <Text>{serverMetrics.memory.toFixed(1)}%</Text>
                      </div>
                      <Progress 
                        percent={serverMetrics.memory}
                        status={serverMetrics.memory > 85 ? 'exception' : 'normal'}
                      />
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Disk Usage</Text>
                        <Text>{serverMetrics.disk.toFixed(1)}%</Text>
                      </div>
                      <Progress 
                        percent={serverMetrics.disk}
                        status={serverMetrics.disk > 90 ? 'exception' : 'normal'}
                      />
                    </div>
                  </Space>
                ) : (
                  <Text type="secondary">No metrics available</Text>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab={`Containers (${serverContainers.length})`} key="containers">
          <Card title="Docker Containers" extra={<ContainerOutlined />}>
            <Table
              columns={containerColumns}
              dataSource={serverContainers}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="Execute Command"
        open={commandModalVisible}
        onOk={handleExecuteCommand}
        onCancel={() => {
          setCommandModalVisible(false)
          setCommand('')
          setCommandResult(null)
        }}
        confirmLoading={executing}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="Enter command to execute..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onPressEnter={handleExecuteCommand}
          />
          
          {commandResult && (
            <div>
              <Text strong>Result:</Text>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '4px',
                marginTop: '8px',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {commandResult.output || commandResult.error || 'No output'}
              </pre>
              {commandResult.exitCode !== undefined && (
                <Text type={commandResult.exitCode === 0 ? 'success' : 'danger'}>
                  Exit code: {commandResult.exitCode}
                </Text>
              )}
            </div>
          )}
        </Space>
      </Modal>
    </div>
  )
}

export default ServerDetailsPage
import React, { useEffect, useState } from 'react'
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Modal, 
  Select, 
  Typography,
  message,
  Tooltip,
  Progress,
  Row,
  Col,
  Statistic
} from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchServers } from '../store/slices/serversSlice'
import { 
  fetchContainers,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer
} from '../store/slices/dockerSlice'

const { Title, Text } = Typography
const { Option } = Select
const { confirm } = Modal

const ContainersPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { servers } = useAppSelector(state => state.servers)
  const { containers, isLoading } = useAppSelector(state => state.docker)
  
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    dispatch(fetchServers())
  }, [dispatch])

  useEffect(() => {
    if (selectedServer) {
      dispatch(fetchContainers({ serverId: selectedServer, all: showAll }))
    }
  }, [dispatch, selectedServer, showAll])

  const handleServerChange = (serverId: string) => {
    setSelectedServer(serverId)
  }

  const handleStartContainer = async (serverId: string, containerId: string) => {
    try {
      await dispatch(startContainer({ serverId, containerId })).unwrap()
      message.success('Container started successfully')
      dispatch(fetchContainers({ serverId, all: showAll }))
    } catch (error: any) {
      message.error(error || 'Failed to start container')
    }
  }

  const handleStopContainer = async (serverId: string, containerId: string) => {
    try {
      await dispatch(stopContainer({ serverId, containerId })).unwrap()
      message.success('Container stopped successfully')
      dispatch(fetchContainers({ serverId, all: showAll }))
    } catch (error: any) {
      message.error(error || 'Failed to stop container')
    }
  }

  const handleRestartContainer = async (serverId: string, containerId: string) => {
    try {
      await dispatch(restartContainer({ serverId, containerId })).unwrap()
      message.success('Container restarted successfully')
      dispatch(fetchContainers({ serverId, all: showAll }))
    } catch (error: any) {
      message.error(error || 'Failed to restart container')
    }
  }

  const handleRemoveContainer = (serverId: string, containerId: string, name: string) => {
    confirm({
      title: 'Remove Container',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to remove container "${name}"?`,
      okText: 'Remove',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        dispatch(removeContainer({ serverId, containerId, force: true }))
          .unwrap()
          .then(() => {
            message.success('Container removed successfully')
            dispatch(fetchContainers({ serverId, all: showAll }))
          })
          .catch((error) => {
            message.error(error || 'Failed to remove container')
          })
      },
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return 'green'
      case 'exited': return 'red'
      case 'paused': return 'orange'
      case 'restarting': return 'blue'
      default: return 'default'
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text strong>{name.replace(/^\//, '')}</Text>
      ),
    },
    {
      title: 'Image',
      dataIndex: 'image',
      key: 'image',
      render: (image: string) => (
        <Text code style={{ fontSize: '12px' }}>{image}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Ports',
      dataIndex: 'ports',
      key: 'ports',
      render: (ports: any[]) => (
        <Space direction="vertical" size={0}>
          {ports?.map((port, index) => (
            <Text key={index} style={{ fontSize: '12px' }}>
              {port.PublicPort ? `${port.PublicPort}:${port.PrivatePort}` : port.PrivatePort}
              {port.Type && `/${port.Type}`}
            </Text>
          )) || <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      render: (created: number) => (
        <Text style={{ fontSize: '12px' }}>
          {new Date(created * 1000).toLocaleDateString()}
        </Text>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'sizeRw',
      key: 'size',
      render: (sizeRw: number, record: any) => (
        <Text style={{ fontSize: '12px' }}>
          {sizeRw ? formatBytes(sizeRw) : '-'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          {record.status === 'running' ? (
            <>
              <Tooltip title="Stop">
                <Button 
                  size="small" 
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleStopContainer(selectedServer, record.id)}
                />
              </Tooltip>
              <Tooltip title="Restart">
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                  onClick={() => handleRestartContainer(selectedServer, record.id)}
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Start">
              <Button 
                size="small" 
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartContainer(selectedServer, record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="View Details">
            <Button 
              size="small" 
              icon={<EyeOutlined />}
            />
          </Tooltip>
          <Tooltip title="Remove">
            <Button 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveContainer(selectedServer, record.id, record.name)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const serverContainers = selectedServer ? containers[selectedServer] || [] : []
  const containerStats = {
    total: serverContainers.length,
    running: serverContainers.filter(c => c.status === 'running').length,
    stopped: serverContainers.filter(c => c.status === 'exited').length,
    paused: serverContainers.filter(c => c.status === 'paused').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Containers</Title>
        <Space>
          <Select
            placeholder="Select a server"
            style={{ width: 200 }}
            value={selectedServer}
            onChange={handleServerChange}
          >
            {servers
              .filter(server => server.status === 'ONLINE')
              .map(server => (
                <Option key={server.id} value={server.id}>
                  {server.name}
                </Option>
              ))
            }
          </Select>
          <Button
            icon={<PlusOutlined />}
            disabled={!selectedServer}
          >
            Create Container
          </Button>
        </Space>
      </div>

      {selectedServer && (
        <>
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card>
                <Statistic title="Total" value={containerStats.total} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="Running" 
                  value={containerStats.running} 
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="Stopped" 
                  value={containerStats.stopped} 
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="Paused" 
                  value={containerStats.paused} 
                  valueStyle={{ color: '#d46b08' }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title={`Containers on ${servers.find(s => s.id === selectedServer)?.name}`}
            extra={
              <Space>
                <Button
                  size="small"
                  type={showAll ? 'primary' : 'default'}
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Running Only' : 'Show All'}
                </Button>
                <Button 
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => dispatch(fetchContainers({ serverId: selectedServer, all: showAll }))}
                >
                  Refresh
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={serverContainers}
              rowKey="id"
              loading={isLoading}
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} containers`,
              }}
            />
          </Card>
        </>
      )}

      {!selectedServer && (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
            <Text>Select a server to view containers</Text>
          </div>
        </Card>
      )}
    </div>
  )
}

export default ContainersPage
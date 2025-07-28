import React, { useEffect, useState } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Select, 
  Button, 
  Space, 
  Typography, 
  Table,
  Tag,
  Progress,
  Statistic,
  Alert,
  Modal,
  Form,
  InputNumber,
  Switch
} from 'antd'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { 
  MonitorOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchServers } from '../store/slices/serversSlice'
import { 
  fetchServerMetrics,
  startServerMonitoring,
  stopServerMonitoring,
  fetchAlerts,
  acknowledgeAlert,
  resolveAlert
} from '../store/slices/monitoringSlice'

const { Title, Text } = Typography
const { Option } = Select

const MonitoringPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { servers } = useAppSelector(state => state.servers)
  const { 
    metrics, 
    latestMetrics, 
    alerts, 
    isLoading, 
    realTimeEnabled,
    connectedServers 
  } = useAppSelector(state => state.monitoring)

  const [selectedServer, setSelectedServer] = useState<string>('')
  const [timeRange, setTimeRange] = useState<number>(24)
  const [monitoringModalVisible, setMonitoringModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    dispatch(fetchServers())
    dispatch(fetchAlerts())
  }, [dispatch])

  useEffect(() => {
    if (selectedServer) {
      dispatch(fetchServerMetrics({ serverId: selectedServer, hours: timeRange }))
    }
  }, [dispatch, selectedServer, timeRange])

  const handleStartMonitoring = async (values: { interval: number }) => {
    if (!selectedServer) return
    try {
      await dispatch(startServerMonitoring({ 
        serverId: selectedServer, 
        interval: values.interval * 1000 
      })).unwrap()
      setMonitoringModalVisible(false)
    } catch (error) {
      console.error('Failed to start monitoring:', error)
    }
  }

  const handleStopMonitoring = async () => {
    if (!selectedServer) return
    try {
      await dispatch(stopServerMonitoring(selectedServer)).unwrap()
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
    }
  }

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await dispatch(acknowledgeAlert(alertId)).unwrap()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      await dispatch(resolveAlert(alertId)).unwrap()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const formatChartData = (serverMetrics: any[]) => {
    return serverMetrics.map(metric => ({
      time: new Date(metric.timestamp).toLocaleTimeString(),
      cpu: metric.cpu,
      memory: metric.memory,
      disk: metric.disk
    }))
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'ACKNOWLEDGED': return <CheckCircleOutlined style={{ color: '#faad14' }} />
      case 'RESOLVED': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      default: return <CloseCircleOutlined />
    }
  }

  const alertColumns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusIcon(status),
      width: 60,
    },
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
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          {record.status === 'ACTIVE' && (
            <Button 
              size="small"
              onClick={() => handleAcknowledgeAlert(record.id)}
            >
              Acknowledge
            </Button>
          )}
          {record.status !== 'RESOLVED' && (
            <Button 
              size="small"
              type="primary"
              onClick={() => handleResolveAlert(record.id)}
            >
              Resolve
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const serverMetrics = selectedServer ? metrics[selectedServer] || [] : []
  const chartData = formatChartData(serverMetrics)
  const currentMetrics = selectedServer ? latestMetrics[selectedServer] : null
  const isMonitoring = selectedServer ? connectedServers.has(selectedServer) : false

  return (
    <div>
      <Title level={2}>Monitoring</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Select
            placeholder="Select a server"
            style={{ width: '100%' }}
            value={selectedServer}
            onChange={setSelectedServer}
          >
            {servers.map(server => (
              <Option key={server.id} value={server.id}>
                {server.name} ({server.status})
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={8}>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: '100%' }}
          >
            <Option value={1}>Last 1 hour</Option>
            <Option value={6}>Last 6 hours</Option>
            <Option value={24}>Last 24 hours</Option>
            <Option value={168}>Last 7 days</Option>
          </Select>
        </Col>
        <Col span={8}>
          <Space>
            {selectedServer && (
              <>
                {isMonitoring ? (
                  <Button 
                    icon={<PauseCircleOutlined />}
                    onClick={handleStopMonitoring}
                  >
                    Stop Monitoring
                  </Button>
                ) : (
                  <Button 
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => setMonitoringModalVisible(true)}
                  >
                    Start Monitoring
                  </Button>
                )}
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={() => dispatch(fetchServerMetrics({ serverId: selectedServer, hours: timeRange }))}
                >
                  Refresh
                </Button>
              </>
            )}
          </Space>
        </Col>
      </Row>

      {!realTimeEnabled && (
        <Alert
          message="Real-time monitoring is disconnected"
          description="Connect to enable live monitoring and alerts."
          type="warning"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      {selectedServer && currentMetrics && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="CPU Usage"
                value={currentMetrics.cpu.toFixed(1)}
                suffix="%"
                valueStyle={{ 
                  color: currentMetrics.cpu > 80 ? '#cf1322' : '#3f8600' 
                }}
              />
              <Progress 
                percent={currentMetrics.cpu} 
                status={currentMetrics.cpu > 80 ? 'exception' : 'normal'}
                size="small"
                style={{ marginTop: '8px' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Memory Usage"
                value={currentMetrics.memory.toFixed(1)}
                suffix="%"
                valueStyle={{ 
                  color: currentMetrics.memory > 85 ? '#cf1322' : '#3f8600' 
                }}
              />
              <Progress 
                percent={currentMetrics.memory}
                status={currentMetrics.memory > 85 ? 'exception' : 'normal'}
                size="small"
                style={{ marginTop: '8px' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Disk Usage"
                value={currentMetrics.disk.toFixed(1)}
                suffix="%"
                valueStyle={{ 
                  color: currentMetrics.disk > 90 ? '#cf1322' : '#3f8600' 
                }}
              />
              <Progress 
                percent={currentMetrics.disk}
                status={currentMetrics.disk > 90 ? 'exception' : 'normal'}
                size="small"
                style={{ marginTop: '8px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {selectedServer && (
        <Card 
          title="Resource Usage Over Time" 
          style={{ marginBottom: '24px' }}
          loading={isLoading}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#1677ff" 
                  name="CPU %" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#52c41a" 
                  name="Memory %" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="disk" 
                  stroke="#faad14" 
                  name="Disk %" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
              No metrics data available
            </div>
          )}
        </Card>
      )}

      <Card title="Active Alerts">
        <Table
          columns={alertColumns}
          dataSource={alerts.filter(alert => alert.status !== 'RESOLVED')}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Start Monitoring"
        open={monitoringModalVisible}
        onOk={form.submit}
        onCancel={() => setMonitoringModalVisible(false)}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleStartMonitoring}
          initialValues={{ interval: 30 }}
        >
          <Form.Item
            name="interval"
            label="Collection Interval (seconds)"
            rules={[{ required: true, min: 10, max: 3600 }]}
          >
            <InputNumber min={10} max={3600} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MonitoringPage
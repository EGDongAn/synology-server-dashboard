import React, { useEffect } from 'react'
import { Row, Col, Card, Statistic, Progress, Typography, Space, Tag, Alert } from 'antd'
import { 
  CloudServerOutlined, 
  ContainerOutlined, 
  BellOutlined, 
  MonitorOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchServers } from '../store/slices/serversSlice'
import { fetchActiveAlerts } from '../store/slices/notificationsSlice'

const { Title, Text } = Typography

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const { servers, isLoading } = useAppSelector(state => state.servers)
  const { activeAlerts } = useAppSelector(state => state.notifications)
  const { latestMetrics, realTimeEnabled } = useAppSelector(state => state.monitoring)

  useEffect(() => {
    dispatch(fetchServers())
    dispatch(fetchActiveAlerts())
  }, [dispatch])

  const serverStats = {
    total: servers.length,
    online: servers.filter(s => s.status === 'ONLINE').length,
    offline: servers.filter(s => s.status === 'OFFLINE').length,
    warning: servers.filter(s => s.status === 'WARNING').length,
  }

  const alertStats = {
    critical: activeAlerts.filter(a => a.severity === 'CRITICAL').length,
    high: activeAlerts.filter(a => a.severity === 'HIGH').length,
    medium: activeAlerts.filter(a => a.severity === 'MEDIUM').length,
    low: activeAlerts.filter(a => a.severity === 'LOW').length,
  }

  const totalContainers = Object.values(latestMetrics).reduce((total, metrics) => {
    return total + (metrics.containers?.total || 0)
  }, 0)

  const runningContainers = Object.values(latestMetrics).reduce((total, metrics) => {
    return total + (metrics.containers?.running || 0)
  }, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return '#52c41a'
      case 'OFFLINE': return '#ff4d4f'
      case 'WARNING': return '#faad14'
      default: return '#d9d9d9'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#ff4d4f'
      case 'HIGH': return '#ff7a45'
      case 'MEDIUM': return '#faad14'
      case 'LOW': return '#52c41a'
      default: return '#d9d9d9'
    }
  }

  return (
    <div>
      <Title level={2}>Dashboard</Title>
      
      {!realTimeEnabled && (
        <Alert
          message="Real-time monitoring is disconnected"
          description="Some metrics may not be up to date. Check your connection."
          type="warning"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Servers"
              value={serverStats.total}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
            <Space style={{ marginTop: '8px' }}>
              <Tag color="green">{serverStats.online} Online</Tag>
              <Tag color="red">{serverStats.offline} Offline</Tag>
              {serverStats.warning > 0 && (
                <Tag color="orange">{serverStats.warning} Warning</Tag>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Containers"
              value={runningContainers}
              suffix={`/ ${totalContainers}`}
              prefix={<ContainerOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress 
              percent={totalContainers > 0 ? Math.round((runningContainers / totalContainers) * 100) : 0}
              size="small"
              style={{ marginTop: '8px' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Alerts"
              value={activeAlerts.length}
              prefix={<BellOutlined />}
              valueStyle={{ 
                color: activeAlerts.length > 0 ? '#ff4d4f' : '#52c41a' 
              }}
            />
            <Space style={{ marginTop: '8px' }}>
              {alertStats.critical > 0 && <Tag color="red">{alertStats.critical} Critical</Tag>}
              {alertStats.high > 0 && <Tag color="orange">{alertStats.high} High</Tag>}
              {alertStats.medium > 0 && <Tag color="yellow">{alertStats.medium} Medium</Tag>}
              {alertStats.low > 0 && <Tag color="green">{alertStats.low} Low</Tag>}
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Monitoring"
              value={realTimeEnabled ? 'Connected' : 'Disconnected'}
              prefix={<MonitorOutlined />}
              valueStyle={{ 
                color: realTimeEnabled ? '#52c41a' : '#ff4d4f' 
              }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              Real-time data collection
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Server Status" loading={isLoading}>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {servers.map(server => {
                const metrics = latestMetrics[server.id]
                return (
                  <div 
                    key={server.id}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{server.name}</div>
                      <Text type="secondary">{server.ipAddress}</Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>
                        {server.status === 'ONLINE' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        {server.status === 'WARNING' && <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                        {server.status === 'OFFLINE' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                        <span style={{ marginLeft: '8px', color: getStatusColor(server.status) }}>
                          {server.status}
                        </span>
                      </div>
                      {metrics && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          CPU: {metrics.cpu.toFixed(1)}% | MEM: {metrics.memory.toFixed(1)}%
                        </Text>
                      )}
                    </div>
                  </div>
                )
              })}
              {servers.length === 0 && !isLoading && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No servers configured
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Recent Alerts">
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {activeAlerts.slice(0, 10).map(alert => (
                <div 
                  key={alert.id}
                  style={{ 
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {alert.title}
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {alert.message}
                      </Text>
                      {alert.server && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          Server: {alert.server.name}
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: '12px' }}>
                      <Tag color={getSeverityColor(alert.severity)} size="small">
                        {alert.severity}
                      </Tag>
                    </div>
                  </div>
                </div>
              ))}
              {activeAlerts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No active alerts
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
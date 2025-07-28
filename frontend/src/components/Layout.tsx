import React, { useState } from 'react'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Badge, Space, Button } from 'antd'
import { 
  DashboardOutlined, 
  DatabaseOutlined, 
  ContainerOutlined, 
  MonitorOutlined, 
  BellOutlined,
  DeploymentUnitOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { logout } from '../store/slices/authSlice'

const { Header, Sider, Content } = AntLayout

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector(state => state.auth)
  const { activeAlerts } = useAppSelector(state => state.notifications)
  const { realTimeEnabled } = useAppSelector(state => state.monitoring)

  const handleLogout = () => {
    dispatch(logout())
  }

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        <Link to="/settings">Profile</Link>
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        <Link to="/settings">Settings</Link>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  )

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: '/servers',
      icon: <DatabaseOutlined />,
      label: <Link to="/servers">Servers</Link>,
    },
    {
      key: '/containers',
      icon: <ContainerOutlined />,
      label: <Link to="/containers">Containers</Link>,
    },
    {
      key: '/monitoring',
      icon: <MonitorOutlined />,
      label: <Link to="/monitoring">Monitoring</Link>,
    },
    {
      key: '/notifications',
      icon: <BellOutlined />,
      label: (
        <Link to="/notifications">
          <Space>
            Notifications
            {activeAlerts.length > 0 && (
              <Badge count={activeAlerts.length} size="small" />
            )}
          </Space>
        </Link>
      ),
    },
    {
      key: '/deployments',
      icon: <DeploymentUnitOutlined />,
      label: <Link to="/deployments">Deployments</Link>,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">Settings</Link>,
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ 
          height: '32px', 
          margin: '16px', 
          color: 'white',
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          {collapsed ? 'SD' : 'Server Dashboard'}
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ border: 'none' }}
        />
      </Sider>
      
      <AntLayout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s' }}>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          
          <Space size="large">
            <Space>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: realTimeEnabled ? '#52c41a' : '#ff4d4f' 
              }} />
              <span style={{ fontSize: '12px', color: '#666' }}>
                {realTimeEnabled ? 'Real-time Connected' : 'Offline'}
              </span>
            </Space>
            
            <Dropdown overlay={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user?.name || user?.email}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        
        <Content style={{ 
          margin: '24px',
          padding: '24px',
          background: '#fff',
          minHeight: 'calc(100vh - 112px)',
          borderRadius: '8px'
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
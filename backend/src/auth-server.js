const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// 임시 사용자 데이터
const users = [
  {
    id: '1',
    email: 'admin@example.com',
    password: '$2b$10$6nU117AJJaOfBux9qRf4gekp5dwnKgjwDAaN3S33zgGaHgIVhcCJS', // admin123
    name: 'Admin User',
    role: 'ADMIN'
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      'your-super-secret-jwt-key-here',
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      'your-super-secret-refresh-key-here',
      { expiresIn: '7d' }
    );

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Refresh token endpoint
app.post('/api/v1/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, 'your-super-secret-refresh-key-here');
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      'your-super-secret-jwt-key-here',
      { expiresIn: '15m' }
    );

    res.json({
      data: {
        accessToken
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Get profile endpoint
app.get('/api/v1/auth/profile', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'your-super-secret-jwt-key-here');
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Test endpoint
app.get('/api/v1/test', (req, res) => {
  res.json({ message: 'Backend is running!', timestamp: new Date().toISOString() });
});

// Logout endpoint
app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Servers endpoint
app.get('/servers', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'Demo Server 1',
      ipAddress: '192.168.1.100',
      status: 'ONLINE',
      lastSeen: new Date().toISOString()
    },
    {
      id: '2', 
      name: 'Demo Server 2',
      ipAddress: '192.168.1.101',
      status: 'WARNING',
      lastSeen: new Date().toISOString()
    }
  ]);
});

// Active alerts endpoint
app.get('/notifications/alerts/active', (req, res) => {
  res.json([
    {
      id: '1',
      title: 'High CPU Usage',
      message: 'CPU usage is above 80%',
      severity: 'HIGH',
      server: { name: 'Demo Server 1' },
      createdAt: new Date().toISOString()
    }
  ]);
});

// Deployments endpoint
app.get('/deployments', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'Web App v1.2.0',
      status: 'DEPLOYED',
      environment: 'production',
      server: { name: 'Demo Server 1' },
      deployedAt: new Date().toISOString()
    },
    {
      id: '2', 
      name: 'API v2.1.0',
      status: 'PENDING',
      environment: 'staging',
      server: { name: 'Demo Server 2' },
      deployedAt: new Date().toISOString()
    }
  ]);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login: POST http://localhost:${PORT}/api/v1/auth/login`);
  console.log(`👤 Profile: GET http://localhost:${PORT}/api/v1/auth/profile`);
});
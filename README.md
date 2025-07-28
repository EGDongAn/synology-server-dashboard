# Synology Server Management Dashboard

A comprehensive web-based dashboard for managing multiple Synology servers with Docker container deployment, real-time monitoring, and alert management capabilities.

## 🚀 Features

### Core Functionality
- **Multi-Server Management**: Connect and manage multiple Synology servers from a single dashboard
- **Docker Container Management**: Deploy, monitor, and manage Docker containers across servers
- **Real-time Monitoring**: Live metrics collection with WebSocket-based updates
- **Alert & Notification System**: Multi-channel notifications (Email, Slack, Webhook)
- **Deployment Workflow**: Automated deployment with rollback capabilities
- **User Authentication**: JWT-based authentication with role-based access control

### Security Features
- Rate limiting and request throttling
- Input sanitization and SQL injection prevention
- Encrypted credential storage
- Security headers and CORS protection
- Audit logging for all operations

### Performance Optimizations
- Response caching with Redis
- Database connection pooling
- Request compression
- Memory usage monitoring
- Performance metrics tracking

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│  (PostgreSQL)   │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • REST API      │    │ • User Data     │
│ • Server Mgmt   │    │ • WebSocket     │    │ • Server Config │
│ • Monitoring    │    │ • SSH Clients   │    │ • Metrics       │
│ • Deployments   │    │ • Docker API    │    │ • Audit Logs    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Caching)     │
                       │                 │
                       │ • Sessions      │
                       │ • Rate Limits   │
                       │ • Real-time     │
                       └─────────────────┘
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Real-time**: Socket.io
- **Authentication**: JWT with refresh tokens
- **SSH**: ssh2 library for server connections
- **Docker**: Dockerode for container management
- **Queues**: Bull for background jobs
- **Security**: Helmet, rate limiting, input validation

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **UI Library**: Ant Design
- **Charts**: Recharts
- **HTTP Client**: Axios with interceptors
- **Build Tool**: Vite
- **Routing**: React Router v6

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### With Docker Compose
```bash
git clone <repository-url>
cd server-dashboard
cp .env.example .env
docker-compose up -d
```

Access at:
- Frontend: http://localhost
- Backend API: http://localhost:3003

**Default Login:**
- Email: admin@example.com
- Password: admin123

### Manual Setup
```bash
# Backend
cd backend
npm install
npm run prisma:migrate
npm run dev

# Frontend  
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

Key environment variables:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dashboard"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_hex_key

# Notifications
SMTP_HOST=smtp.example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## 📊 API Overview

- **Auth**: `/api/v1/auth/*` - Login, logout, token refresh
- **Servers**: `/api/v1/servers/*` - Server CRUD, SSH connections
- **Docker**: `/api/v1/docker/*` - Container management
- **Monitoring**: `/api/v1/monitoring/*` - Metrics, alerts
- **Deployments**: `/api/v1/deployments/*` - Deployment workflow

## 🧪 Testing

```bash
# Backend
cd backend
npm test
npm run test:coverage

# Frontend
cd frontend  
npm test
```

## 🚀 Production Deployment

```bash
# Build frontend and backend
cd frontend && npm run build
cd ../backend && npm run build

# Deploy with Docker (Production)
docker compose -f docker-compose.prod.yml up -d

# View production logs
docker compose -f docker-compose.prod.yml logs -f

# Stop production services
docker compose -f docker-compose.prod.yml down
```

## 📈 Features Implemented

✅ **Project Setup & Environment**
- Docker Compose configuration
- TypeScript setup for both frontend and backend
- Database schema with Prisma ORM
- Environment configuration

✅ **Authentication System**
- JWT-based authentication with refresh tokens
- Password hashing and validation
- Role-based access control
- Session management

✅ **Server Management**
- SSH connection pooling
- Server CRUD operations
- Connection testing
- Encrypted credential storage

✅ **Docker Integration**
- Container lifecycle management
- Docker API integration
- Image management
- Container statistics

✅ **Real-time Monitoring**
- WebSocket-based live updates
- System metrics collection
- Alert management
- Health checking

✅ **Notification System**
- Multi-channel notifications (Email, Slack, Webhook)
- Template-based messaging
- Retry logic for failed notifications
- Notification history

✅ **Frontend Dashboard**
- React 18 with TypeScript
- Redux state management
- Ant Design UI components
- Real-time data visualization
- Responsive design

✅ **Deployment System**
- Deployment workflow management
- Rollback capabilities
- Service management (Docker, Systemd, Generic)
- Deployment logging and monitoring

✅ **Security & Performance**
- Rate limiting with Redis
- Input validation and sanitization
- Response caching
- Security headers
- Request compression
- Performance monitoring

✅ **Testing & Documentation**
- Comprehensive test suites
- API documentation
- Setup instructions
- Architecture overview

## 🔒 Security Features

- JWT authentication with automatic token refresh
- Encrypted SSH credential storage
- Rate limiting and request throttling
- Input sanitization and SQL injection prevention
- Security headers and CORS protection
- Comprehensive audit logging
- Threat detection and monitoring

## 📝 License

MIT License - see LICENSE file for details.

---

**Production-ready Synology Server Management Dashboard** 🚀
#!/bin/bash

# Synology Server Dashboard Installation Script for Ubuntu VM
# This script sets up the dashboard on Synology NAS Ubuntu VM

set -e

echo "🚀 Synology Server Dashboard Installation (Ubuntu VM)"
echo "====================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo -e "${BLUE}Installing Docker...${NC}"
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    
    echo -e "${GREEN}✓ Docker installed${NC}"
    echo -e "${YELLOW}⚠️  Please log out and log back in to use Docker without sudo${NC}"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${BLUE}Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

# Configuration
PROJECT_NAME="synology-dashboard"
BASE_DIR="$HOME/${PROJECT_NAME}"
COMPOSE_FILE="docker-compose.synology.yml"

echo -e "${BLUE}📁 Creating directory structure...${NC}"

# Create directories
mkdir -p "${BASE_DIR}"
mkdir -p "${BASE_DIR}/data/postgres"
mkdir -p "${BASE_DIR}/data/redis"
mkdir -p "${BASE_DIR}/data/logs"
mkdir -p "${BASE_DIR}/data/uploads"
mkdir -p "${BASE_DIR}/data/nginx-logs"
mkdir -p "${BASE_DIR}/config"

# Set permissions
chmod -R 755 "${BASE_DIR}"

echo -e "${GREEN}✓ Directories created at ${BASE_DIR}${NC}"

# Get VM IP
echo -e "${BLUE}🌐 Network Configuration${NC}"
DEFAULT_IP=$(hostname -I | awk '{print $1}')
read -p "Enter your Ubuntu VM IP address [$DEFAULT_IP]: " VM_IP
VM_IP=${VM_IP:-$DEFAULT_IP}

# Generate secure passwords and keys
echo -e "${BLUE}🔐 Generating secure credentials...${NC}"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo -e "${GREEN}✓ Credentials generated${NC}"

# Create environment file
echo -e "${BLUE}📝 Creating environment configuration...${NC}"
cat > "${BASE_DIR}/.env" << EOF
# Ubuntu VM Configuration
SYNOLOGY_IP=${VM_IP}

# Database Configuration
DB_PASSWORD=${DB_PASSWORD}

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Encryption Key
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Email Notifications (Optional - configure as needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Slack Notifications (Optional)
SLACK_WEBHOOK_URL=

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# API Keys (Optional)
VALID_API_KEYS=

# Logging
LOG_LEVEL=info
EOF

echo -e "${GREEN}✓ Environment file created at ${BASE_DIR}/.env${NC}"

# Copy Docker Compose file
echo -e "${BLUE}📋 Setting up Docker Compose...${NC}"
if [ -f "./${COMPOSE_FILE}" ]; then
    cp "./${COMPOSE_FILE}" "${BASE_DIR}/docker-compose.yml"
    echo -e "${GREEN}✓ Docker Compose file copied${NC}"
else
    echo -e "${RED}❌ Docker Compose file not found: ${COMPOSE_FILE}${NC}"
    echo -e "${YELLOW}Please download the project files first${NC}"
    exit 1
fi

# Copy Nginx configuration
if [ -d "./nginx" ]; then
    cp -r ./nginx "${BASE_DIR}/"
    echo -e "${GREEN}✓ Nginx configuration copied${NC}"
fi

# Create startup script
cat > "${BASE_DIR}/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down
docker-compose pull
docker-compose up -d
echo "Dashboard started! Access it at: http://$(grep SYNOLOGY_IP .env | cut -d'=' -f2):8080"
EOF

chmod +x "${BASE_DIR}/start.sh"

# Create stop script
cat > "${BASE_DIR}/stop.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down
echo "Dashboard stopped."
EOF

chmod +x "${BASE_DIR}/stop.sh"

# Create update script
cat > "${BASE_DIR}/update.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Updating Synology Server Dashboard..."
docker-compose pull
docker-compose up -d
echo "Update completed!"
EOF

chmod +x "${BASE_DIR}/update.sh"

echo -e "${GREEN}✓ Management scripts created${NC}"

# Instructions
echo -e "\n${GREEN}🎉 Installation completed!${NC}"
echo -e "\n${BLUE}📋 Next Steps:${NC}"
echo -e "1. Configure your email/Slack settings in: ${BASE_DIR}/.env"
echo -e "2. Start the dashboard: ${BASE_DIR}/start.sh"
echo -e "3. Access the dashboard at: http://${VM_IP}:8080"
echo -e "\n${BLUE}📂 Management Commands:${NC}"
echo -e "• Start:  ${BASE_DIR}/start.sh"
echo -e "• Stop:   ${BASE_DIR}/stop.sh"
echo -e "• Update: ${BASE_DIR}/update.sh"
echo -e "\n${BLUE}📊 Default Access:${NC}"
echo -e "• Web UI: http://${VM_IP}:8080"
echo -e "• API:    http://${VM_IP}:3001"
echo -e "\n${YELLOW}⚠️  Security Notes:${NC}"
echo -e "• Change default passwords after first login"
echo -e "• Configure firewall rules as needed"
echo -e "• Consider setting up SSL certificates for HTTPS"
echo -e "\n${GREEN}✨ Enjoy your Synology Server Dashboard!${NC}"

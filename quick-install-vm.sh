#!/bin/bash

# Synology Server Dashboard - Ubuntu VM Quick Install
echo "🚀 Installing Synology Server Dashboard on Ubuntu VM..."

# Create project directory
mkdir -p ~/synology-dashboard
cd ~/synology-dashboard

# Download the latest release files
echo "📥 Downloading project files..."
curl -L -o docker-compose.yml https://raw.githubusercontent.com/EGDongAn/synology-server-dashboard/master/docker-compose.vm.yml
curl -L -o .env.example https://raw.githubusercontent.com/EGDongAn/synology-server-dashboard/master/.env.synology
curl -L -o nginx.conf https://raw.githubusercontent.com/EGDongAn/synology-server-dashboard/master/nginx/synology.conf

# Create nginx directory and move config
mkdir -p nginx
mv nginx.conf nginx/

# Create data directories
mkdir -p data/{postgres,redis,logs,uploads,nginx-logs}

# Copy and customize environment file
cp .env.example .env

# Get VM IP
VM_IP=$(hostname -I | awk '{print $1}')

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update .env file
sed -i "s/SYNOLOGY_IP=.*/VM_IP=$VM_IP/" .env
sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env

# Create management scripts
cat > start.sh << 'EOF'
#!/bin/bash
docker-compose down
docker-compose pull
docker-compose up -d
echo "✅ Dashboard started!"
echo "🌐 Access at: http://$(hostname -I | awk '{print $1}'):8080"
EOF

cat > stop.sh << 'EOF'
#!/bin/bash
docker-compose down
echo "⏹️  Dashboard stopped"
EOF

cat > update.sh << 'EOF'
#!/bin/bash
echo "🔄 Updating dashboard..."
docker-compose pull
docker-compose up -d
echo "✅ Update complete!"
EOF

chmod +x *.sh

echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file if needed: nano .env"
echo "2. Start dashboard: ./start.sh"
echo "3. Access at: http://$VM_IP:8080"
echo ""
echo "🛠️  Management commands:"
echo "• Start:  ./start.sh"
echo "• Stop:   ./stop.sh"
echo "• Update: ./update.sh"

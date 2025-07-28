import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@synology-dashboard.local' },
    update: {},
    create: {
      email: 'admin@synology-dashboard.local',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user with id: ${adminUser.id}`)

  // Create operator user
  const operatorPassword = await bcrypt.hash('operator123', 10)
  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@synology-dashboard.local' },
    update: {},
    create: {
      email: 'operator@synology-dashboard.local',
      password: operatorPassword,
      name: 'Operator User',
      role: 'OPERATOR',
    },
  })
  console.log(`Created operator user with id: ${operatorUser.id}`)

  // Create server groups
  const prodGroup = await prisma.serverGroup.upsert({
    where: { name: 'Production' },
    update: {},
    create: {
      name: 'Production',
      description: 'Production environment servers',
      type: 'ENVIRONMENT',
    },
  })

  const devGroup = await prisma.serverGroup.upsert({
    where: { name: 'Development' },
    update: {},
    create: {
      name: 'Development',
      description: 'Development environment servers',
      type: 'ENVIRONMENT',
    },
  })

  // Create deployment templates
  const nginxTemplate = await prisma.deploymentTemplate.create({
    data: {
      name: 'nginx-web-server',
      description: 'Nginx web server with basic configuration',
      type: 'DOCKER',
      config: {
        image: 'nginx:alpine',
        ports: [
          { host: 80, container: 80 },
          { host: 443, container: 443 },
        ],
        volumes: [
          { host: '/config/nginx', container: '/etc/nginx/conf.d' },
          { host: '/data/www', container: '/usr/share/nginx/html' },
        ],
        environment: {
          TZ: 'UTC',
        },
        restart: 'unless-stopped',
      },
      tags: ['web', 'nginx', 'proxy'],
    },
  })

  const postgresTemplate = await prisma.deploymentTemplate.create({
    data: {
      name: 'postgresql-database',
      description: 'PostgreSQL database server',
      type: 'DOCKER',
      config: {
        image: 'postgres:15-alpine',
        ports: [{ host: 5432, container: 5432 }],
        volumes: [{ host: '/data/postgres', container: '/var/lib/postgresql/data' }],
        environment: {
          POSTGRES_USER: 'dbuser',
          POSTGRES_PASSWORD: '${DB_PASSWORD}',
          POSTGRES_DB: 'myapp',
        },
        restart: 'unless-stopped',
      },
      tags: ['database', 'postgresql', 'sql'],
    },
  })

  const nodeAppTemplate = await prisma.deploymentTemplate.create({
    data: {
      name: 'node-application',
      description: 'Node.js application container',
      type: 'DOCKER',
      config: {
        image: 'node:18-alpine',
        ports: [{ host: 3000, container: 3000 }],
        volumes: [{ host: '/apps/myapp', container: '/app' }],
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
        workdir: '/app',
        command: 'npm start',
        restart: 'unless-stopped',
      },
      tags: ['application', 'nodejs', 'backend'],
    },
  })

  console.log('Created deployment templates')

  // Note: In a real scenario, you would NOT seed servers with real credentials
  // This is just for demonstration purposes
  console.log('\nSeeding complete!')
  console.log('\nDefault users:')
  console.log('- Admin: admin@synology-dashboard.local / admin123')
  console.log('- Operator: operator@synology-dashboard.local / operator123')
  console.log('\nPlease change these passwords immediately!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
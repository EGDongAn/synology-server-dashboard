-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('ENVIRONMENT', 'PURPOSE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DOCKER', 'SYSTEMD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('RUNNING', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'VALIDATING', 'PULLING', 'CREATING', 'HEALTH_CHECKING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SERVER_DOWN', 'SERVICE_DOWN', 'HIGH_CPU', 'HIGH_MEMORY', 'HIGH_DISK', 'DEPLOYMENT_FAILED', 'HEALTH_CHECK_FAILED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ipAddress" TEXT NOT NULL,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "dockerPort" INTEGER,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "privateKey" TEXT,
    "status" "ServerStatus" NOT NULL DEFAULT 'OFFLINE',
    "cpuUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "GroupType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerGroupMember" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serverId" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'STOPPED',
    "config" JSONB NOT NULL,
    "healthCheckUrl" TEXT,
    "healthCheckInterval" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL,
    "logs" JSONB[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ServiceType" NOT NULL,
    "config" JSONB NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "serverId" TEXT,
    "serviceId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "responseTime" INTEGER,
    "statusCode" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMetric" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "memoryUsage" DOUBLE PRECISION NOT NULL,
    "diskUsage" DOUBLE PRECISION NOT NULL,
    "networkIn" BIGINT,
    "networkOut" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "result" "AuditResult" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Server_status_idx" ON "Server"("status");

-- CreateIndex
CREATE INDEX "Server_ipAddress_idx" ON "Server"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ServerGroup_name_key" ON "ServerGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServerGroupMember_serverId_groupId_key" ON "ServerGroupMember"("serverId", "groupId");

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "Service"("status");

-- CreateIndex
CREATE INDEX "Service_serverId_idx" ON "Service"("serverId");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "Deployment_serviceId_idx" ON "Deployment"("serviceId");

-- CreateIndex
CREATE INDEX "Deployment_serverId_idx" ON "Deployment"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentTemplate_name_key" ON "DeploymentTemplate"("name");

-- CreateIndex
CREATE INDEX "DeploymentTemplate_name_idx" ON "DeploymentTemplate"("name");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "HealthCheck_serviceId_checkedAt_idx" ON "HealthCheck"("serviceId", "checkedAt");

-- CreateIndex
CREATE INDEX "ServiceLog_serviceId_timestamp_idx" ON "ServiceLog"("serviceId", "timestamp");

-- CreateIndex
CREATE INDEX "ServerMetric_serverId_timestamp_idx" ON "ServerMetric"("serverId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "ServerGroupMember" ADD CONSTRAINT "ServerGroupMember_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerGroupMember" ADD CONSTRAINT "ServerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ServerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLog" ADD CONSTRAINT "ServiceLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMetric" ADD CONSTRAINT "ServerMetric_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

# Backend Build Stage
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Copy backend dependencies
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci
RUN npx prisma generate

# Copy backend source
COPY src ./src
COPY tsconfig.json ./

# Build backend
RUN npm run build

# Frontend Build Stage
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy frontend dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

# Copy built backend
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend
COPY --from=frontend-builder /app/dist ./public

# Copy necessary files
COPY .env.example .env

# Expose port
EXPOSE 3000

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
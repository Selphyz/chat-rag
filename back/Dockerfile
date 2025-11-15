FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "start:dev"]

# Production build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install postgresql-client for wait logic
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

# Wait for postgres then start the app
ENTRYPOINT ["sh", "-c", "until pg_isready -h ${DATABASE_HOST:-postgres} -p ${DATABASE_PORT:-5432} -U ${DATABASE_USER:-postgres} > /dev/null 2>&1; do echo 'Waiting for PostgreSQL...'; sleep 1; done; echo 'PostgreSQL is ready! Waiting additional time for full initialization...'; sleep 5; NODE_ENV=production node dist/main"]
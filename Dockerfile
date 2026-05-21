# Stage 1: Build front-end and back-end
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Packaging runtime
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# Bind to dynamic port requested by runtime environment (e.g. Cloud Run)
CMD ["node", "dist/server.cjs"]

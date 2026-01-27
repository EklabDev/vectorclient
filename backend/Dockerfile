FROM --platform=linux/arm64/v8 node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build step if using typescript (we are)
RUN npm run build

# Prune dev dependencies to get production-only node_modules
RUN npm prune --production

FROM --platform=linux/arm64/v8 node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production node_modules and built files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["npm", "start"]

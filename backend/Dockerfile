FROM --platform=linux/arm64/v8 node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build step if using typescript (we are)
RUN npm run build

FROM --platform=linux/arm64/v8 node:20-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["npm", "start"]

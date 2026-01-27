FROM --platform=linux/arm64/v8 node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Accept VITE_API_URL as build argument
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Install preview globally in builder stage
RUN npm install -g preview

FROM --platform=linux/arm64/v8 node:20-alpine

WORKDIR /app

# Copy built files and global node_modules (which includes preview)
COPY --from=builder /app/dist .
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin /usr/local/bin

EXPOSE 3000

CMD ["preview", "-l", "3000"]

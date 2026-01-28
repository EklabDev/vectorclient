FROM --platform=linux/arm64/v8 node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Accept VITE_API_URL as build argument
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Install serve locally
RUN npm install serve

FROM --platform=linux/arm64/v8 node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist .

# Copy node_modules (including serve and all its dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Ensure node_modules/.bin is in PATH
ENV PATH="/app/node_modules/.bin:${PATH}"

EXPOSE 3000

CMD ["serve", "-s", ".", "-l", "3000"]

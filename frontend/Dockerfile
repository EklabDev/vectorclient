FROM --platform=linux/arm64/v8 node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Accept VITE_API_URL as build argument
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM --platform=linux/arm64/v8 node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist .
RUN npm install -g preview

EXPOSE 3000

CMD ["preview", "-l", "3000"]

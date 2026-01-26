FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build step if using typescript (we are)
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]

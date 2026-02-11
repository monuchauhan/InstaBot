FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Configure npm to bypass SSL issues and install dependencies
RUN npm config set strict-ssl false && npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

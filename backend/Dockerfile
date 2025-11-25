FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (explicitly disable production mode)
RUN npm install --production=false

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]

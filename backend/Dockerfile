FROM node:18-alpine

WORKDIR /app

# Enable Yarn
RUN corepack enable

# Copy package files
COPY package.json ./

# Install ALL dependencies with Yarn
RUN yarn install

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Expose port
EXPOSE 3000

# Start the app
CMD ["yarn", "start"]

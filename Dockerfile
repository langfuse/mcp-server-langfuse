# Generated by https://smithery.ai. See: https://smithery.ai/docs/config#dockerfile
# Use the official Node.js image.
FROM node:18-alpine as build

# Create and set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Use a new clean image for the final stage
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy built files and node_modules from the build stage
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# Set environment variables
ENV LANGFUSE_PUBLIC_KEY=your-public-key
ENV LANGFUSE_SECRET_KEY=your-secret-key
ENV LANGFUSE_BASEURL=https://cloud.langfuse.com

# Start the MCP server
CMD ["node", "build/index.js"]

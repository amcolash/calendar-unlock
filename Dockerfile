# Dependency Stage
FROM mhart/alpine-node:14

# Create app directory
WORKDIR /usr/src/app

# Copy source code
COPY . ./

# Install deps
RUN npm ci

# Set things up
EXPOSE 8002
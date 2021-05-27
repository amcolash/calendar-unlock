# Dependency Stage
FROM mhart/alpine-node:14

# Install python3, pip and dependencies for icalfilter
RUN apk add --update --no-cache python3 && python3 -m ensurepip
RUN pip3 install pytz icalendar

# Create app directory
WORKDIR /usr/src/app

# Copy source code
COPY . ./

# Install deps
RUN npm ci

# Set things up
EXPOSE 8002
FROM node:20-alpine

# Install git and cloc
RUN apk add --no-cache git cloc python3 py3-pip

# Create working directory
WORKDIR /analyzer

# Copy analysis scripts
COPY analyze.js /analyzer/
COPY package.json /analyzer/

# Install dependencies
RUN npm install

# Set entrypoint
ENTRYPOINT ["node", "/analyzer/analyze.js"]

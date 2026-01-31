# Get Docker CLI from official image
FROM docker:cli AS docker-cli

# Use full node image which has openssl and other deps pre-installed
FROM node:20

# Copy Docker CLI from the first stage
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]

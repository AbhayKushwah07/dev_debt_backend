# Use full node image which has openssl and other deps pre-installed
FROM node:20

# Install git and cloc for repository analysis
RUN apt-get update && apt-get install -y git cloc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY geo_database.js ./
COPY admin_logs.json ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]

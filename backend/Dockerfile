FROM node:20.18.0-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 9000

CMD ["node", "server.js"]
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm install --omit=dev

COPY src ./src
COPY .env.example ./

CMD ["npm", "start"]

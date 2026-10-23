FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY config ./config
COPY public ./public
COPY scripts ./scripts
USER node
# 프로세스 종류는 command 로 선택: api | engine | collector | notifier
CMD ["node", "src/api/server.js"]

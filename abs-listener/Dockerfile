FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app

# Copy abs-listener package files first for layer caching
COPY abs-listener/package*.json ./

RUN npm ci

# Copy prisma schema from the repo root (build context must be repo root)
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy TypeScript config and source
COPY abs-listener/tsconfig.json ./
COPY abs-listener/src/ ./src/

RUN npm run build

CMD ["node", "dist/index.js"]

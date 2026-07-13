FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY apps/api ./apps/api

RUN npm run prisma:generate && npm run build --workspace apps/api
RUN test -f apps/api/dist/main.js

FROM node:22-alpine AS production-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --omit=dev

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV API_PORT=3001

WORKDIR /app

COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/package-lock.json ./package-lock.json
COPY --from=production-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=production-deps /app/apps/web/package.json ./apps/web/package.json
COPY --from=production-deps /app/node_modules ./node_modules

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN test -f apps/api/prisma/schema.prisma \
  && test -d apps/api/prisma/migrations \
  && test -f apps/api/package.json \
  && test -x node_modules/.bin/prisma

USER node

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]

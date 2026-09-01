FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./

FROM base AS development
RUN pnpm install
COPY . .
CMD ["pnpm", "dev"]

FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma:generate
RUN pnpm build
RUN pnpm prune --prod

FROM node:20-alpine AS release
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && addgroup -S nodeapp && adduser -S nodeapp -G nodeapp
COPY --from=builder --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodeapp /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodeapp /app/prisma ./prisma
COPY --from=builder --chown=nodeapp:nodeapp /app/package.json ./package.json
USER nodeapp
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV STORAGE_PROVIDER=local
ENV FILE_STORAGE_DIR=/data/uploads

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY production-server.mjs ./production-server.mjs
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/api-server run build
RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/signal87-core run build

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./production-server.mjs"]

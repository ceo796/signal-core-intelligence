FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY railway-placeholder.mjs ./railway-placeholder.mjs

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./railway-placeholder.mjs"]

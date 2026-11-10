# API Fastify. Roda com tsx (TypeScript direto), resolvendo @seginfo/shared
# via alias do tsconfig — mesmo caminho do dev, sem etapa de bundle do shared.
FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production

# todos os manifestos do workspace (o lockfile referencia todos)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

# gera o Prisma Client (precisa do schema; DATABASE_URL só é usada em runtime)
RUN npm run prisma:generate --workspace apps/api

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1
# aplica migrations pendentes e sobe a API
CMD ["sh", "-c", "npm run prisma:migrate --workspace apps/api && npm run start --workspace apps/api"]

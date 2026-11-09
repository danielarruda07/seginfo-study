# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /repo

# manifestos primeiro (cache de camadas)
# todos os manifestos do workspace (o lockfile referencia todos)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci

# código
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace apps/web

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]

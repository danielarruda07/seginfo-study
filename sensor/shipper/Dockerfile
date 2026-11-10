FROM node:22-alpine
WORKDIR /app
COPY shipper.mjs .
# /state guarda os offsets de leitura dos logs (volume nomeado herda este dono)
RUN mkdir -p /state && chown node:node /state
USER node
CMD ["node", "shipper.mjs"]

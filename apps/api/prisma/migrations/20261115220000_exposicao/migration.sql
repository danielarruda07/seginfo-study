-- Minha exposição: alvos (domínios e IPs próprios) e varreduras de OSINT passivo.
CREATE TABLE "ExposicaoAlvo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL DEFAULT '',
    "rotulo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExposicaoAlvo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExposicaoAlvo_usuarioId_tipo_valor_key" ON "ExposicaoAlvo"("usuarioId", "tipo", "valor");
CREATE TABLE "ExposicaoVarredura" (
    "id" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" JSONB NOT NULL,
    "mudancas" JSONB NOT NULL DEFAULT '[]',
    "erro" TEXT,
    CONSTRAINT "ExposicaoVarredura_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExposicaoVarredura_alvoId_criadoEm_idx" ON "ExposicaoVarredura"("alvoId", "criadoEm");
CREATE INDEX "ExposicaoVarredura_usuarioId_criadoEm_idx" ON "ExposicaoVarredura"("usuarioId", "criadoEm");
ALTER TABLE "ExposicaoAlvo" ADD CONSTRAINT "ExposicaoAlvo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExposicaoVarredura" ADD CONSTRAINT "ExposicaoVarredura_alvoId_fkey" FOREIGN KEY ("alvoId") REFERENCES "ExposicaoAlvo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

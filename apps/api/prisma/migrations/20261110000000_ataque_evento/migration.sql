-- CreateTable
CREATE TABLE "AtaqueEvento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "ipOrigem" TEXT,
    "paisOrigem" TEXT,
    "portaDestino" INTEGER,
    "protocolo" TEXT,
    "servico" TEXT,
    "acao" TEXT NOT NULL,
    "usuarioTentado" TEXT,
    "senhaTentada" TEXT,
    "alvo" TEXT,
    "detalhes" JSONB NOT NULL DEFAULT '{}',
    "dedupKey" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtaqueEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtaqueEvento_usuarioId_ocorridoEm_idx" ON "AtaqueEvento"("usuarioId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "AtaqueEvento_usuarioId_ipOrigem_idx" ON "AtaqueEvento"("usuarioId", "ipOrigem");

-- CreateIndex
CREATE INDEX "AtaqueEvento_usuarioId_servico_idx" ON "AtaqueEvento"("usuarioId", "servico");

-- CreateIndex
CREATE UNIQUE INDEX "AtaqueEvento_usuarioId_dedupKey_key" ON "AtaqueEvento"("usuarioId", "dedupKey");

-- AddForeignKey
ALTER TABLE "AtaqueEvento" ADD CONSTRAINT "AtaqueEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

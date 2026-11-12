
-- CreateTable
CREATE TABLE "Agente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "resumo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "config" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgenteAvaliacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "caso" TEXT NOT NULL,
    "criterio" TEXT NOT NULL DEFAULT '',
    "resultado" TEXT NOT NULL,
    "latenciaMs" INTEGER,
    "observacao" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgenteAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agente_usuarioId_atualizadoEm_idx" ON "Agente"("usuarioId", "atualizadoEm");

-- CreateIndex
CREATE INDEX "AgenteAvaliacao_agenteId_criadoEm_idx" ON "AgenteAvaliacao"("agenteId", "criadoEm");

-- CreateIndex
CREATE INDEX "AgenteAvaliacao_usuarioId_idx" ON "AgenteAvaliacao"("usuarioId");

-- AddForeignKey
ALTER TABLE "Agente" ADD CONSTRAINT "Agente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgenteAvaliacao" ADD CONSTRAINT "AgenteAvaliacao_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "Agente"("id") ON DELETE CASCADE ON UPDATE CASCADE;


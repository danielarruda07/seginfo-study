-- CreateTable
CREATE TABLE "AgenteExecucao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rodando',
    "entrada" TEXT NOT NULL,
    "resposta" TEXT NOT NULL DEFAULT '',
    "erro" TEXT NOT NULL DEFAULT '',
    "modelo" TEXT NOT NULL,
    "passos" JSONB NOT NULL DEFAULT '[]',
    "mensagens" JSONB NOT NULL DEFAULT '[]',
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "duracaoMs" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgenteExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgenteExecucao_agenteId_criadoEm_idx" ON "AgenteExecucao"("agenteId", "criadoEm");

-- CreateIndex
CREATE INDEX "AgenteExecucao_usuarioId_status_idx" ON "AgenteExecucao"("usuarioId", "status");

-- AddForeignKey
ALTER TABLE "AgenteExecucao" ADD CONSTRAINT "AgenteExecucao_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "Agente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

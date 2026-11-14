-- CreateTable
CREATE TABLE "Pericia" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "vmid" INTEGER NOT NULL,
    "sistema" TEXT NOT NULL,
    "sensor" TEXT,
    "janelaInicio" TIMESTAMP(3) NOT NULL,
    "janelaFim" TIMESTAMP(3) NOT NULL,
    "resumo" JSONB NOT NULL DEFAULT '{}',
    "dados" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pericia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pericia_usuarioId_janelaFim_idx" ON "Pericia"("usuarioId", "janelaFim");

-- CreateIndex
CREATE UNIQUE INDEX "Pericia_usuarioId_alvo_janelaFim_key" ON "Pericia"("usuarioId", "alvo", "janelaFim");

-- AddForeignKey
ALTER TABLE "Pericia" ADD CONSTRAINT "Pericia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


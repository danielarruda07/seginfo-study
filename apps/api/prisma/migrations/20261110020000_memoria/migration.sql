-- CreateTable
CREATE TABLE "Memoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "urlOrigem" TEXT,
    "escopo" TEXT NOT NULL DEFAULT 'pessoal',
    "excluirEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memoria_usuarioId_atualizadoEm_idx" ON "Memoria"("usuarioId", "atualizadoEm");

-- CreateIndex
CREATE INDEX "Memoria_usuarioId_excluirEm_idx" ON "Memoria"("usuarioId", "excluirEm");

-- AddForeignKey
ALTER TABLE "Memoria" ADD CONSTRAINT "Memoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "LinkedinPost" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlNormalizada" TEXT NOT NULL,
    "publicadoEm" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "formato" TEXT NOT NULL DEFAULT 'texto',
    "metricas" JSONB NOT NULL DEFAULT '{}',
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "analise" JSONB,
    "memoriaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioEntrada" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiarioEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedinEstrategia" (
    "usuarioId" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "publico" TEXT NOT NULL,
    "voz" TEXT NOT NULL,
    "pilares" TEXT[],
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinEstrategia_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateIndex
CREATE INDEX "LinkedinPost_usuarioId_publicadoEm_idx" ON "LinkedinPost"("usuarioId", "publicadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedinPost_usuarioId_urlNormalizada_key" ON "LinkedinPost"("usuarioId", "urlNormalizada");

-- CreateIndex
CREATE INDEX "DiarioEntrada_usuarioId_data_idx" ON "DiarioEntrada"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "LinkedinPost" ADD CONSTRAINT "LinkedinPost_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioEntrada" ADD CONSTRAINT "DiarioEntrada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedinEstrategia" ADD CONSTRAINT "LinkedinEstrategia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


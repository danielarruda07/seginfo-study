-- CreateTable
CREATE TABLE "Cofre2fa" (
    "usuarioId" TEXT NOT NULL,
    "segredo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "ultimoPasso" INTEGER NOT NULL DEFAULT 0,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "codigosRecuperacao" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cofre2fa_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "CofreSessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CofreSessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CofreEvento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "ip" TEXT,
    "agente" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CofreEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CofreSessao_tokenHash_key" ON "CofreSessao"("tokenHash");

-- CreateIndex
CREATE INDEX "CofreSessao_usuarioId_idx" ON "CofreSessao"("usuarioId");

-- CreateIndex
CREATE INDEX "CofreEvento_usuarioId_criadoEm_idx" ON "CofreEvento"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Cofre2fa" ADD CONSTRAINT "Cofre2fa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CofreSessao" ADD CONSTRAINT "CofreSessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CofreEvento" ADD CONSTRAINT "CofreEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

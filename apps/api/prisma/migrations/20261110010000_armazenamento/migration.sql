-- CreateTable
CREATE TABLE "ArmazenamentoConta" (
    "usuarioId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'onedrive',
    "contaNome" TEXT,
    "refreshTokenCifrado" TEXT NOT NULL,
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoBackupEm" TIMESTAMP(3),
    "ultimoErro" TEXT,

    CONSTRAINT "ArmazenamentoConta_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "BackupRegistro" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "erro" TEXT,
    "itemId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupRegistro_usuarioId_criadoEm_idx" ON "BackupRegistro"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "ArmazenamentoConta" ADD CONSTRAINT "ArmazenamentoConta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRegistro" ADD CONSTRAINT "BackupRegistro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progresso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "topicoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'a_estudar',
    "anotacoes" TEXT NOT NULL DEFAULT '',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "trilhaId" TEXT,
    "topicoId" TEXT,
    "minutos" INTEGER NOT NULL,
    "nota" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "trilhaId" TEXT,
    "prazo" TEXT NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "gancho" TEXT NOT NULL DEFAULT '',
    "corpo" TEXT NOT NULL DEFAULT '',
    "topicoId" TEXT,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArsenalItem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "dominio" TEXT NOT NULL DEFAULT 'geral',
    "resumo" TEXT NOT NULL DEFAULT '',
    "conteudo" TEXT NOT NULL DEFAULT '',
    "quandoUsar" TEXT NOT NULL DEFAULT '',
    "requisitos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "artefatos" JSONB NOT NULL DEFAULT '[]',
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArsenalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiblioItem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT '',
    "dominio" TEXT NOT NULL DEFAULT '',
    "textoOriginal" TEXT NOT NULL DEFAULT '',
    "resumo" TEXT NOT NULL DEFAULT '',
    "palavrasChave" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoria" TEXT NOT NULL DEFAULT 'geral',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estado" TEXT NOT NULL DEFAULT 'para_ler',
    "favorito" BOOLEAN NOT NULL DEFAULT false,
    "anotacoes" TEXT NOT NULL DEFAULT '',
    "topicoId" TEXT,
    "fonteResumo" TEXT NOT NULL DEFAULT 'local',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiblioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CofreBlob" (
    "usuarioId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "salt" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "autoLockMin" INTEGER NOT NULL DEFAULT 5,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CofreBlob_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Progresso_usuarioId_idx" ON "Progresso"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Progresso_usuarioId_topicoId_key" ON "Progresso"("usuarioId", "topicoId");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE INDEX "Meta_usuarioId_idx" ON "Meta"("usuarioId");

-- CreateIndex
CREATE INDEX "Post_usuarioId_idx" ON "Post"("usuarioId");

-- CreateIndex
CREATE INDEX "ArsenalItem_usuarioId_idx" ON "ArsenalItem"("usuarioId");

-- CreateIndex
CREATE INDEX "BiblioItem_usuarioId_idx" ON "BiblioItem"("usuarioId");

-- CreateIndex
CREATE INDEX "BiblioItem_usuarioId_categoria_idx" ON "BiblioItem"("usuarioId", "categoria");

-- AddForeignKey
ALTER TABLE "Progresso" ADD CONSTRAINT "Progresso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArsenalItem" ADD CONSTRAINT "ArsenalItem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiblioItem" ADD CONSTRAINT "BiblioItem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CofreBlob" ADD CONSTRAINT "CofreBlob_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pipeline do LinkedIn: projetos, ideias, ciclo de vida do rascunho, versões e conta da API.

ALTER TABLE "Post"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'rascunho',
ADD COLUMN "formato" TEXT NOT NULL DEFAULT 'texto',
ADD COLUMN "projetoId" TEXT,
ADD COLUMN "ideiaId" TEXT,
ADD COLUMN "agendadoPara" TIMESTAMP(3),
ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'lembrete',
ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ultimoErro" TEXT NOT NULL DEFAULT '',
ADD COLUMN "linkedinPostId" TEXT,
ADD COLUMN "aprovadoEm" TIMESTAMP(3),
ADD COLUMN "publicadoEm" TIMESTAMP(3),
ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- rascunhos que já estavam marcados como publicados entram no pipeline nesse estado
UPDATE "Post" SET "status" = 'publicado' WHERE "publicado" = true;
UPDATE "Post" SET "atualizadoEm" = "criadoEm";

CREATE INDEX "Post_status_agendadoPara_idx" ON "Post"("status", "agendadoPara");

CREATE TABLE "PostVersao" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "gancho" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVersao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostVersao_postId_numero_key" ON "PostVersao"("postId", "numero");
CREATE INDEX "PostVersao_usuarioId_idx" ON "PostVersao"("usuarioId");
ALTER TABLE "PostVersao" ADD CONSTRAINT "PostVersao_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkedinPost" ADD COLUMN "projetoId" TEXT, ADD COLUMN "urn" TEXT;
ALTER TABLE "DiarioEntrada" ADD COLUMN "projetoId" TEXT;

CREATE TABLE "LinkedinProjeto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "objetivo" TEXT NOT NULL DEFAULT '',
    "pilar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinProjeto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LinkedinProjeto_usuarioId_status_idx" ON "LinkedinProjeto"("usuarioId", "status");
ALTER TABLE "LinkedinProjeto" ADD CONSTRAINT "LinkedinProjeto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LinkedinIdeia" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "briefing" TEXT NOT NULL DEFAULT '',
    "pilar" TEXT,
    "projetoId" TEXT,
    "formato" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "origemRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nova',
    "sugeridaPara" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinIdeia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LinkedinIdeia_usuarioId_origem_origemRef_titulo_key" ON "LinkedinIdeia"("usuarioId", "origem", "origemRef", "titulo");
CREATE INDEX "LinkedinIdeia_usuarioId_status_idx" ON "LinkedinIdeia"("usuarioId", "status");
ALTER TABLE "LinkedinIdeia" ADD CONSTRAINT "LinkedinIdeia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LinkedinConta" (
    "usuarioId" TEXT NOT NULL,
    "personUrn" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',
    "accessTokenCifrado" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "escopos" TEXT NOT NULL DEFAULT '',
    "ultimoErro" TEXT,
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinConta_pkey" PRIMARY KEY ("usuarioId")
);
ALTER TABLE "LinkedinConta" ADD CONSTRAINT "LinkedinConta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

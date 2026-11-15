-- LinkedIn: visibilidade do post e arquivo anexado (imagem ou PDF) para publicar pela API.

ALTER TABLE "Post" ADD COLUMN "visibilidade" TEXT NOT NULL DEFAULT 'PUBLIC';

CREATE TABLE "PostMidia" (
    "postId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT '',
    "tamanho" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMidia_pkey" PRIMARY KEY ("postId")
);
CREATE INDEX "PostMidia_usuarioId_idx" ON "PostMidia"("usuarioId");
ALTER TABLE "PostMidia" ADD CONSTRAINT "PostMidia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Perfil profissional, inspirações e perfil de voz do módulo LinkedIn.
CREATE TABLE "LinkedinPerfilPro" (
    "usuarioId" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "importadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedinPerfilPro_pkey" PRIMARY KEY ("usuarioId")
);
CREATE TABLE "LinkedinInspiracao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "texto" TEXT NOT NULL DEFAULT '',
    "motivo" TEXT NOT NULL DEFAULT '',
    "aspectos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observacaoVisual" TEXT NOT NULL DEFAULT '',
    "frequencia" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedinInspiracao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LinkedinInspiracao_usuarioId_tipo_idx" ON "LinkedinInspiracao"("usuarioId", "tipo");
CREATE TABLE "LinkedinVoz" (
    "usuarioId" TEXT NOT NULL,
    "perfil" JSONB,
    "ajustes" TEXT NOT NULL DEFAULT '',
    "baseadoEmPosts" INTEGER NOT NULL DEFAULT 0,
    "baseadoEmInspiracoes" INTEGER NOT NULL DEFAULT 0,
    "modelo" TEXT NOT NULL DEFAULT '',
    "geradoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkedinVoz_pkey" PRIMARY KEY ("usuarioId")
);
ALTER TABLE "LinkedinPerfilPro" ADD CONSTRAINT "LinkedinPerfilPro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedinInspiracao" ADD CONSTRAINT "LinkedinInspiracao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedinVoz" ADD CONSTRAINT "LinkedinVoz_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

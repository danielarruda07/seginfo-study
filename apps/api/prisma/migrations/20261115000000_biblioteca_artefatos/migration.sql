CREATE TABLE "ArtefatoAtaque" (
 "id" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL, "chave" TEXT NOT NULL, "tipo" TEXT NOT NULL,
 "nome" TEXT NOT NULL, "conteudo" TEXT NOT NULL DEFAULT '', "sha256" TEXT, "formato" TEXT NOT NULL DEFAULT 'texto',
 "resumo" TEXT NOT NULL DEFAULT '', "categoria" TEXT NOT NULL DEFAULT 'outro', "notas" TEXT NOT NULL DEFAULT '',
 "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "favorito" BOOLEAN NOT NULL DEFAULT false, "amostraBase64" TEXT,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ArtefatoAtaque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArtefatoAtaque_usuarioId_chave_key" ON "ArtefatoAtaque"("usuarioId", "chave");
CREATE INDEX "ArtefatoAtaque_usuarioId_tipo_criadoEm_idx" ON "ArtefatoAtaque"("usuarioId", "tipo", "criadoEm");
CREATE TABLE "ArtefatoOcorrencia" (
 "id" TEXT PRIMARY KEY, "artefatoId" TEXT NOT NULL, "chave" TEXT NOT NULL, "alvo" TEXT, "origem" TEXT NOT NULL,
 "referencia" TEXT NOT NULL, "caminho" TEXT, "ip" TEXT, "sessao" TEXT, "quando" TIMESTAMP(3) NOT NULL, "contexto" JSONB NOT NULL DEFAULT '{}',
 CONSTRAINT "ArtefatoOcorrencia_artefatoId_fkey" FOREIGN KEY ("artefatoId") REFERENCES "ArtefatoAtaque"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArtefatoOcorrencia_artefatoId_chave_key" ON "ArtefatoOcorrencia"("artefatoId", "chave");
CREATE INDEX "ArtefatoOcorrencia_artefatoId_quando_idx" ON "ArtefatoOcorrencia"("artefatoId", "quando");
CREATE INDEX "ArtefatoOcorrencia_alvo_quando_idx" ON "ArtefatoOcorrencia"("alvo", "quando");

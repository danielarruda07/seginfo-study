-- Revisão de segurança de código (plugin claude-security via worker Linux).
CREATE TABLE "VarreduraCodigo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "branch" TEXT,
    "modo" TEXT NOT NULL,
    "esforco" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'fila',
    "commit" TEXT,
    "resumo" JSONB NOT NULL DEFAULT '{}',
    "achados" JSONB NOT NULL DEFAULT '[]',
    "relatorioMd" TEXT,
    "patches" JSONB NOT NULL DEFAULT '[]',
    "erro" TEXT,
    "workerId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    CONSTRAINT "VarreduraCodigo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VarreduraCodigo_usuarioId_criadoEm_idx" ON "VarreduraCodigo"("usuarioId", "criadoEm");
CREATE INDEX "VarreduraCodigo_status_criadoEm_idx" ON "VarreduraCodigo"("status", "criadoEm");
ALTER TABLE "VarreduraCodigo" ADD CONSTRAINT "VarreduraCodigo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

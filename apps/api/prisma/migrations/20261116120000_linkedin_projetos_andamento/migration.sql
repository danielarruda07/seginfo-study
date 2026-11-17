ALTER TABLE "LinkedinProjeto" ADD COLUMN "resultadoEsperado" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LinkedinProjeto" ADD COLUMN "escopo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LinkedinProjeto" ADD COLUMN "criteriosSucesso" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LinkedinProjeto" ADD COLUMN "fase" TEXT NOT NULL DEFAULT 'iniciacao';
ALTER TABLE "LinkedinProjeto" ADD COLUMN "condicao" TEXT NOT NULL DEFAULT 'sem_avaliacao';
ALTER TABLE "LinkedinProjeto" ADD COLUMN "avanco" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LinkedinProjetoMarco" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projetoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "entrega" TEXT NOT NULL DEFAULT '',
  "responsavel" TEXT NOT NULL DEFAULT '',
  "prazo" TEXT,
  "situacao" TEXT NOT NULL DEFAULT 'planejado',
  "concluidoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkedinProjetoMarco_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "LinkedinProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LinkedinProjetoMarco_projetoId_prazo_idx" ON "LinkedinProjetoMarco"("projetoId", "prazo");

CREATE TABLE "LinkedinProjetoInforme" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projetoId" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "condicao" TEXT NOT NULL,
  "avanco" INTEGER NOT NULL,
  "resumo" TEXT NOT NULL,
  "entregas" TEXT NOT NULL DEFAULT '',
  "proximosPassos" TEXT NOT NULL DEFAULT '',
  "impedimentos" TEXT NOT NULL DEFAULT '',
  "autorId" TEXT NOT NULL,
  "excluidoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkedinProjetoInforme_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "LinkedinProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LinkedinProjetoInforme_projetoId_excluidoEm_data_idx" ON "LinkedinProjetoInforme"("projetoId", "excluidoEm", "data");

CREATE TABLE "LinkedinProjetoEvento" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projetoId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "entidade" TEXT NOT NULL,
  "entidadeId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "antes" JSONB,
  "depois" JSONB,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkedinProjetoEvento_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "LinkedinProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LinkedinProjetoEvento_projetoId_criadoEm_idx" ON "LinkedinProjetoEvento"("projetoId", "criadoEm");

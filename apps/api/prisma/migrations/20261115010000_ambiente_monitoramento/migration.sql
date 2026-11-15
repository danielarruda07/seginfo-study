ALTER TABLE "AtaqueEvento" ADD COLUMN "ambiente" TEXT NOT NULL DEFAULT 'nao_classificado';
UPDATE "AtaqueEvento" SET "ambiente" = CASE
 WHEN "detalhes"->>'ambiente' IN ('laboratorio','producao') THEN "detalhes"->>'ambiente'
 WHEN "fonte" <> 'fortigate' AND lower(coalesce("detalhes"->>'sensor',"alvo",'')) LIKE 'prod-%' THEN 'producao'
 WHEN "fonte" IN ('cowrie','dionaea','opencanary','heralding','isca','prompt_honeypot') THEN 'laboratorio'
 WHEN "fonte" <> 'fortigate' AND lower(coalesce("detalhes"->>'sensor',"alvo",'')) LIKE 'range-%'
   AND lower(coalesce("detalhes"->>'sensor',"alvo",'')) <> 'range-wazuh' THEN 'laboratorio'
 ELSE 'nao_classificado' END;
CREATE INDEX "AtaqueEvento_usuarioId_ambiente_ocorridoEm_idx" ON "AtaqueEvento"("usuarioId","ambiente","ocorridoEm");

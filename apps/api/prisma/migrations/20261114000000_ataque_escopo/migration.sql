-- Escopo do evento: 'internet' (IP público) ou 'interno' (rede privada/reservada ou sem IP).
-- Mesmas faixas de apps/api/src/radarEscopo.ts.
ALTER TABLE "AtaqueEvento" ADD COLUMN "escopo" TEXT NOT NULL DEFAULT 'internet';

UPDATE "AtaqueEvento"
SET "escopo" = 'interno'
WHERE "ipOrigem" IS NULL
   OR "ipOrigem"::inet <<= ANY (ARRAY[
        '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
        '172.16.0.0/12', '192.168.0.0/16', '::1/128', 'fc00::/7', 'fe80::/10'
      ]::inet[]);

CREATE INDEX "AtaqueEvento_usuarioId_escopo_ocorridoEm_idx" ON "AtaqueEvento"("usuarioId", "escopo", "ocorridoEm");

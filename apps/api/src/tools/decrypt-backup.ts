/**
 * Restauração OFFLINE de um backup .sgb (rode na SUA máquina, nunca no servidor).
 *
 *   npx tsx src/tools/decrypt-backup.ts <backup.sgb> <chave-privada.pem> <saida.json>
 *
 * Se a chave privada tiver senha (recomendado), defina antes:
 *   $env:BACKUP_KEY_PASSPHRASE = "..."      (PowerShell)
 *
 * A saída é o JSON de exportação (progresso, sessões, metas, posts, arsenal, biblioteca,
 * cofre ainda cifrado, ataques). Guarde-o com o mesmo cuidado de um backup.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decifrarBackup } from '../storage-crypto.js';

const [, , arquivo, chave, saida] = process.argv;
if (!arquivo || !chave || !saida) {
  console.error('Uso: npx tsx src/tools/decrypt-backup.ts <backup.sgb> <chave-privada.pem> <saida.json>');
  process.exit(1);
}

try {
  const gz = decifrarBackup(readFileSync(arquivo), readFileSync(chave, 'utf8'), process.env.BACKUP_KEY_PASSPHRASE);
  const json = gunzipSync(gz);
  JSON.parse(json.toString('utf8')); // valida antes de gravar
  writeFileSync(saida, json);
  console.log(`OK: ${saida} (${json.length} bytes)`);
} catch (e) {
  console.error('Falha ao decifrar:', (e as Error).message);
  process.exit(2);
}

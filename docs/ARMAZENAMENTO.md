# Armazenamento externo: OneDrive pessoal + backups cifrados

Objetivo: ter uma cópia dos dados da SegInfo **fora do lab**. Se a VM100, o Proxmox ou o
disco forem perdidos, os backups continuam na sua conta Microsoft pessoal e podem ser
restaurados.

```
PostgreSQL (seginfo_study)
   └─ exportação JSON ─► gzip ─► AES-256-GCM (chave aleatória por backup)
                                   └─ chave cifrada com a CHAVE PÚBLICA RSA (no servidor)
                                          └─► OneDrive pessoal: /Apps/<app>/backups/seginfo-AAAAMMDD-HHMMSS.sgb

Restauração (na sua máquina): arquivo .sgb + CHAVE PRIVADA RSA (fora do lab) ─► JSON
```

## Por que esse desenho

- **O servidor só consegue cifrar, não decifrar.** Ele guarda só a chave pública. Quem
  invadir a VM100 não decifra os backups que já estão no OneDrive.
- **A chave privada decide tudo.** Sem ela os backups são irrecuperáveis. Com ela e o
  arquivo `.sgb` você restaura em qualquer máquina.
- **Permissão mínima.** `Files.ReadWrite.AppFolder`: o app só vê a própria pasta em
  `/Apps`. O resto do seu OneDrive fica inacessível.
- **Token protegido.** O refresh token do OneDrive fica cifrado no banco (AES-256-GCM) com
  `STORAGE_TOKEN_KEY` e é rotacionado a cada uso.

## O que o backup cobre hoje (leia isto)

O backup exporta **o que está no PostgreSQL**. Hoje o Radar e o Segundo Cérebro usam o
banco; a maioria das telas de estudo continua lendo e gravando no `localStorage`.
Portanto, o backup externo ainda não é uma cópia completa da aplicação. O backup local
em **Cofre → Backup & Restauração** cobre as chaves do navegador deste perfil.

Enquanto isso, existe um caminho parcial: em **Cofre → Backup & Restauração**, o botão
**"Importar no servidor"** mescla os registros locais no banco. Coleções com IDs locais
estáveis podem ser enviadas novamente sem criar cópias; os registros são atualizados
pelos mesmos IDs. Isso é uma importação pontual, não uma sincronização contínua, e não
inclui dados que não estejam no payload local (como eventos do Radar ou memórias do
Segundo Cérebro).

O backup local inclui o inventário real do homelab em texto legível. Armazene o JSON em
local privado. No backup externo, memórias marcadas como corporativas ficam fora da
exportação para o OneDrive pessoal.

## 1. Gerar o par de chaves (na sua máquina, nunca no servidor)

Use o Git Bash (já traz o `openssl`):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out seginfo-backup-private.pem
openssl pkey -in seginfo-backup-private.pem -pubout -out seginfo-backup-public.pem
```

O primeiro comando pede uma **senha para a chave privada**. Use uma senha forte.

- **Chave privada + senha:** guarde em **pelo menos dois lugares fora do lab e fora da
  conta OneDrive onde ficam os backups** (gerenciador de senhas pessoal, pendrive
  guardado offline). Se o atacante pegar o OneDrive e a chave juntos, a cifra perde o sentido.
  **Não coloque no Coolify, na VM, no repositório nem no Cofre da SegInfo** (ele está no banco
  que você quer proteger).
- **Chave pública:** vai para o servidor, em base64. No PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("seginfo-backup-public.pem"))
```

Copie a saída para `BACKUP_PUBLIC_KEY_B64`. O servidor recusa iniciar o backup se esse
valor for uma chave privada.

## 2. Registrar o app no Microsoft Entra (você faz; eu não tenho acesso)

1. Acesse **entra.microsoft.com** com a conta @hotmail → **Identity → Applications →
   App registrations → New registration**.
2. Nome: `SegInfo Storage`. Tipos de conta: **Personal Microsoft accounts only**.
3. Redirect URI: plataforma **Web**, valor exatamente
   `https://estudo.criecom.ia.br/api/storage/onedrive/callback`.
4. Na página do app, copie **Application (client) ID** para `MS_CLIENT_ID`.
5. **Certificates & secrets → New client secret.** Copie o **Value** na hora (some depois)
   para `MS_CLIENT_SECRET`. O segredo expira: anote a data e renove antes, senão o
   backup para.
6. **API permissions → Add a permission → Microsoft Graph → Delegated permissions →**
   `Files.ReadWrite.AppFolder`. A conta pessoal concede o consentimento no login.

Não confirmei se uma conta Microsoft pessoal sem assinatura do Azure consegue registrar
app. Se o portal pedir para criar um diretório ou uma conta gratuita do Azure, é isso;
me diga o que aparecer.

## 3. Variáveis no Coolify (`seginfo-api`, runtime, sem Build Variable)

| Variável | Valor |
|---|---|
| `PUBLIC_BASE_URL` | `https://estudo.criecom.ia.br` (sem barra no final) |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | o Value do client secret |
| `STORAGE_TOKEN_KEY` | `openssl rand -base64 32` (guarde cópia fora do lab) |
| `BACKUP_PUBLIC_KEY_B64` | a chave pública em base64 |
| `BACKUP_AUTOMATICO` | `true` para um backup a cada 24 h (padrão `false`) |
| `BACKUP_RETENCAO` | quantos manter no OneDrive (padrão 14, mínimo 3) |

Depois: redeploy. A tela **Armazenamento** lista as variáveis que ainda faltam.

## 4. Migration

O módulo cria as tabelas `ArmazenamentoConta` e `BackupRegistro`. Sem banco:

```powershell
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO\apps\api"
npx prisma generate
cd ..\..
git show HEAD:apps/api/prisma/schema.prisma | Out-File -Encoding ascii apps\api\prisma\old.prisma
cd apps\api
npx prisma migrate diff --from-schema prisma/old.prisma --to-schema prisma/schema.prisma --script
```

Se o `HEAD` já incluir as tabelas do Radar, o SQL virá com elas também; me mande a saída
e eu separo. Grave em `prisma/migrations/<timestamp>_armazenamento/migration.sql` e apague
o `old.prisma`.

## 5. Conectar e testar

1. Abra **Armazenamento** → **Conectar OneDrive** → entre com a conta @hotmail e aceite.
2. **Fazer backup agora**. Confira no OneDrive em `Apps/<nome do app>/backups/`.
3. **Teste a decifragem em uma máquina local**, porque um backup que nunca foi aberto não foi verificado:

```powershell
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO\apps\api"
$env:BACKUP_KEY_PASSPHRASE = "a senha da chave privada"
npx tsx src/tools/decrypt-backup.ts C:\caminho\seginfo-AAAAMMDD-HHMMSS.sgb C:\caminho\seginfo-backup-private.pem C:\caminho\saida.json
```

Esperado: `OK: ...saida.json`. O JSON traz progresso, sessões, metas, posts, arsenal,
biblioteca, o blob do Cofre (ainda cifrado), eventos do Radar e memórias pessoais.

## Ensaio de restauração em banco descartável

O script `apps/api/src/tools/restore-backup.ts` importa todas as coleções do backup,
incluindo eventos do Radar e memórias pessoais. Ele só aceita um banco vazio cujo nome
comece com `seginfo_restore_`; não apaga dados e deixa memórias corporativas fora da
restauração. Use-o primeiro em um banco separado, nunca aponte para produção.

1. Baixe um `.sgb` do OneDrive e decifre-o localmente conforme a seção anterior.
2. Crie um banco PostgreSQL vazio, por exemplo `seginfo_restore_20261110`.
3. No PowerShell, configure temporariamente a URL desse banco e aplique as migrations:

```powershell
$env:RESTORE_TARGET_DATABASE_URL = "postgresql://USUARIO:SENHA@HOST:5432/seginfo_restore_20261110"
$env:DATABASE_URL = $env:RESTORE_TARGET_DATABASE_URL
npm.cmd run prisma:migrate --workspace apps/api
Remove-Item Env:DATABASE_URL
npm.cmd run restore:test --workspace apps/api -- "C:\caminho\saida.json"
```

4. Compare as contagens impressas pelo script com as quantidades no JSON. A ferramenta
   também confirma as contagens após a gravação e aborta se o destino já tiver usuário.
5. Depois do ensaio, apague o banco descartável e remova os arquivos JSON/PEM temporários.
   Mantenha a chave privada e sua senha fora do servidor e do OneDrive.

Exportações antigas sem metadados de identidade ainda podem ser restauradas se contiverem
registros; defina `RESTORE_USER_EMAIL` no terminal para informar o e-mail do usuário.
O script exige um único `usuarioId` consistente nos registros.

## Restauração em caso de desastre

1. Suba a SegInfo com um banco novo e aplique as migrations.
2. Decifre o `.sgb` na sua máquina e restaure no banco recém-criado com o procedimento
   acima. O script preserva os IDs do usuário e dos registros para que o Cloudflare Access
   volte a encontrar a mesma conta pelo e-mail.
3. Confira as contagens e o acesso ao Cofre antes de voltar a usar o ambiente. O Cofre
   continua cifrado e exige a senha-mestra original. A conta do OneDrive não é restaurada;
   reconecte-a pela tela **Armazenamento**.

## Limites e riscos conhecidos

- Upload simples da Graph vai até 250 MB (o código recusa acima de 240 MB). Para mais,
  falta implementar sessão de upload.
- O backup carrega tudo na memória do container; é adequado ao volume de um homelab.
- Se o `MS_CLIENT_SECRET` expirar ou a autorização for revogada, os backups falham e a tela
  mostra o último erro. Reconecte.
- Nada disso substitui backup do próprio Postgres/Proxmox; é uma cópia lógica dos dados da app.

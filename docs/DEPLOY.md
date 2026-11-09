# Deploy — SegInfo Study no seu ambiente (Proxmox + Coolify + Cloudflare)

Alvo: publicar em **https://estudo.criecom.ia.br**, rodando no **Coolify** da
**VM100 (10.10.10.99)** e exposto pelo **Cloudflare Tunnel `criecomia`** já existente,
protegido por **Cloudflare Access** (só o seu login).

```
Internet → Cloudflare (DNS + Access) → Tunnel criecomia (na VM100)
          → container web (Nginx :80) ──/api──▶ container api (Fastify :3001)
```

## Arquitetura dos containers

- **web**: build do Vite servido por Nginx. O Nginx faz proxy de `/api` para o
  container `seginfo-api` (mesma origem → sem CORS no browser) e faz fallback de SPA.
- **seginfo-api**: Fastify, busca de URL com proteção anti-SSRF. Não é exposto à
  internet. Fala com o `web` pela rede privada do compose e com o Postgres pela rede
  `coolify`; por isso valida o JWT do Cloudflare Access em toda requisição (ver 4).

Arquivos: `docker-compose.yml`, `apps/web/Dockerfile`, `apps/web/nginx.conf`,
`apps/api/Dockerfile`.

## Passo 1 — Repositório

O Coolify faz deploy a partir de um repositório Git. Suba este projeto para o seu
Gitea/GitHub (ex: `danielarruda07/seginfo-study`), como você já faz com o CRIECOMIA.

## Passo 2 — Projeto no Coolify

1. No Coolify: **New Resource → Docker Compose** (aponta para este repo/branch).
2. O Coolify detecta o `docker-compose.yml` e builda `web` + `seginfo-api`.
3. Em **Domains**, defina o domínio do serviço `web`: `estudo.criecom.ia.br`.
4. Variáveis do serviço `seginfo-api` (já no compose, ajuste se mudar o domínio):
   - `WEB_ORIGIN=https://estudo.criecom.ia.br`
   - `PORT=3001`
5. Deploy.

> Observação: o serviço `seginfo-api` NÃO deve ter domínio público. Só o `web` é publicado.

## Passo 3 — Cloudflare Tunnel

No túnel `criecomia` (UUID `33b791de-...`, systemd na VM100), adicione uma rota
(public hostname):

- **Subdomain**: `estudo`  **Domain**: `criecom.ia.br`
- **Service**: `http://localhost:<porta_do_web_no_coolify>`
  (use a porta que o Coolify atribuiu ao container `web`; se preferir fixa,
  descomente `ports: 8080:80` no compose e aponte para `http://localhost:8080`).

Se você edita o túnel por arquivo (`config.yml`), a entrada fica assim:

```yaml
ingress:
  - hostname: estudo.criecom.ia.br
    service: http://localhost:8080
  # ...demais rotas (criecom.ia.br, coolify, rdp) acima/abaixo
  - service: http_status:404
```

Depois: `cloudflared tunnel ingress validate` e reiniciar o serviço do túnel.

## Passo 4 — Cloudflare Access (proteção)

Como a app tem o **Cofre**, proteja o hostname para que só você entre:

1. Cloudflare Zero Trust → **Access → Applications → Add application → Self-hosted**.
2. **Application domain**: `estudo.criecom.ia.br`.
3. **Policy**: Allow, por e-mail (o seu) — igual ao que já usa no RDP (team `lampfortup`).
4. Salvar. Agora o hostname exige login Cloudflare antes de chegar na app.

## Passo 5 — Validar

- `https://estudo.criecom.ia.br` pede login do Cloudflare Access.
- Após login, o Painel abre.
- Na **Biblioteca**, o botão "Buscar" funciona (o `web` chama `/api/extract` → container `seginfo-api`).
- `GET /api/../health` interno responde (healthcheck do compose).

## Dados / persistência (PostgreSQL)

A persistência usa o **seu Postgres 16** já existente, com **banco e usuário
dedicados** (NÃO reusar o banco do Coolify nem o da app CRIECOMIA).

### 1. Provisionar o banco (rode no seu Postgres 16, uma vez)

Já executado no container `lgrzsnhe4pycyjjsoyk7f3hi` (`postgres:16-alpine`, rede
`coolify`). Resumo do que foi feito, para reproduzir se precisar:

```bash
docker exec -it lgrzsnhe4pycyjjsoyk7f3hi psql -U postgres
```

```sql
CREATE ROLE seginfo_app LOGIN;          -- sem SUPERUSER, sem CREATEDB
\password seginfo_app                   -- prompt escondido; guarde a senha no Cofre
CREATE DATABASE seginfo_study OWNER seginfo_app;
REVOKE ALL ON DATABASE seginfo_study FROM PUBLIC;
```

`seginfo_app` é dono só do `seginfo_study` e não tem acesso aos bancos das outras apps.
Sendo dono do banco, ele também é dono do schema `public` (PostgreSQL 15+), então não
precisa de `GRANT` extra.

### 2. DATABASE_URL

No Coolify, defina como **Secret** no serviço `seginfo-api`:

```
DATABASE_URL=postgresql://seginfo_app:<<SENHA>>@lgrzsnhe4pycyjjsoyk7f3hi:5432/seginfo_study?schema=public
```

O host é o nome do container do Postgres na rede `coolify`. Esse nome é o UUID do
recurso e muda se o banco for recriado no Coolify. A senha deve ter só letras e
números (ou ser URL-encoded).

### 3. Migrations

A migration inicial já está versionada em `apps/api/prisma/migrations/20261109000000_init/`
(gerada com `prisma migrate diff`, sem precisar de banco). Ela **deve ser comitada**.

O container `seginfo-api` roda `prisma migrate deploy` automaticamente no start (ver
`apps/api/Dockerfile`), aplicando as migrations pendentes no banco do `DATABASE_URL`.

Para aplicar manualmente (por exemplo, a partir do seu PC, se o Postgres for alcançável):

```cmd
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO\apps\api"
set DATABASE_URL=postgresql://seginfo_app:SENHA@HOST:5432/seginfo_study?schema=public
npx prisma migrate deploy
```

Mudanças futuras no schema: use `npx prisma migrate dev --name <descricao>` contra um
banco de desenvolvimento e comite a nova pasta em `migrations/`.

Observação: o SQL inicial começa com `CREATE SCHEMA IF NOT EXISTS "public"`. Para o
usuário `seginfo_app` rodar isso, ele precisa de `CREATE` no banco, o que ele já tem
por ser o dono do `seginfo_study`.

### 4. Autenticação (JWT do Cloudflare Access)

A API **verifica a assinatura** do JWT que o Cloudflare Access envia em
`Cf-Access-Jwt-Assertion` (RS256, chaves públicas do seu time, emissor e AUD
conferidos). Ela **não** confia no header de e-mail em texto puro, porque a API fica
na rede `coolify`, compartilhada com outros containers que poderiam forjá-lo.

Defina no Coolify (Secrets do serviço `seginfo-api`):

- `CF_ACCESS_TEAM`: nome do seu time Zero Trust (ex: `lampfortup`).
- `CF_ACCESS_AUD`: Zero Trust → Access → Applications → `estudo` → Overview →
  **Application Audience (AUD) Tag**. Crie a aplicação do passo 4 antes de pegar o valor.

Sem essas duas variáveis a API responde 503 a tudo em produção (fail-closed). Cada
e-mail verificado vira um `Usuario` isolado. Em dev, sem Access, use `DEV_USER_EMAIL`.

### 4b. Rede com o Postgres

O Postgres escolhido (`postgres:16-alpine`, container `lgrzsnhe4pycyjjsoyk7f3hi`)
só é alcançável pela rede Docker `coolify`. O `docker-compose.yml` conecta o serviço
`seginfo-api` a essa rede (`external: true`) além da rede privada do compose, e o
serviço usa um nome único para não colidir com outras apps no DNS compartilhado.
Se o Coolify não aplicar a rede externa, ative **Connect to Predefined Network** no
recurso (confira a opção na sua versão).

### 5. Migrar dados do navegador

Depois do primeiro deploy, abra a app, vá em **Cofre → Backup & Restauração** e
clique em **"Sincronizar com servidor"**: envia o que estava no localStorage
(estudo, metas, biblioteca, arsenal e o cofre cifrado) para o PostgreSQL.

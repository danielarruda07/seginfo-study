# Biblioteca de artefatos de ataques

Em **Blue Team e honeypot → Biblioteca de artefatos** (`/artefatos`), arquivos, comandos observados no Radar, trechos de persistência e linhas de processos são preservados para estudo no PostgreSQL. A biblioteca tem busca em nome, conteúdo, hash, resumo e notas; filtros de tipo, categoria, alvo e favoritos; anotações e tags por item. Um comando observado e um processo presente na coleta possuem tipos diferentes: a presença do comando no log não comprova seu sucesso.

## Preservação e histórico

Os endpoints de ingestão passam a preservar cada comando, transferência com hash e laudo recebido. Arquivos são deduplicados pelo SHA-256 dentro do usuário; comandos e trechos, pelo conteúdo e tipo. Ocorrências preservam data, alvo, caminho, IP e sessão quando disponíveis. Não há vínculo com exclusão em cascata do Radar ou dos laudos: apagar eventos pela retenção não apaga a biblioteca. Reenvios são idempotentes. A captura precisa concluir para a ingestão confirmar sucesso; uma falha pode ser reprocessada sem duplicar registros.

O botão **Importar histórico existente** percorre os laudos e os eventos anteriores do próprio usuário em lotes, com progresso. Ele importa o que ainda existe no banco, incluindo comandos e trechos, mas não inventa o conteúdo de arquivos que nunca chegou. É possível repetir a operação após uma interrupção. O histórico de um artefato tem navegação de 25 ocorrências por página; todas ficam preservadas no banco e no backup.

## Conteúdo e amostras

- Scripts e binários guardados pelo coletor podem ser anexados pela ficha ou enviados a `POST /api/ingest/amostra`, com o mesmo Service Token, JWT do Access e `X-Ingest-Token` exigidos no restante da ingestão. O laudo deve chegar primeiro para cadastrar o hash.
- Payload: `{ "sha256": "<64 caracteres hexadecimais>", "base64": "<conteúdo>" }`. Limite: **8 MB de bytes por arquivo**. Hash divergente ou base64 inválido é recusado. O proxy aceita até 12 MB para acomodar o base64; a API continua impondo limites por rota.
- O original é guardado em base64 no PostgreSQL, sem execução. A prévia mostra até 64 KB de texto ou cabeçalho e strings de até 1 MB do binário; estas não são uma representação completa. Download explícito do original: `.bin`, `application/octet-stream`, `nosniff`, `no-store`.
- A leitura estática explica padrões de transferência, persistência, reconhecimento, limpeza, mineração e carregamento de bibliotecas. Trata-se de hipótese de triagem. Não usa IA externa, não consulta URLs do payload e não executa comandos. Conteúdo bruto só aparece após clicar em **Revelar conteúdo capturado**; trate arquivos baixados como material de análise.
- Notas, tags e favoritos são independentes da evidência capturada. O backend só permite alterá-los; conteúdo e hash não podem ser editados pelas rotas de anotações.

## Atualizar o coletor no ambiente privado

A publicação do app aplica a migration automaticamente, mas o coletor da VM do Wazuh precisa receber a versão atualizada de `infra/range/pericia/seginfo-pericia.py`. Use o mesmo caminho `ExecStart` e o mesmo `EnvironmentFile` do serviço `seginfo-pericia.service` do ambiente. O script atualizado envia as amostras já copiadas e verificadas após cada laudo, sem executar os arquivos.

Para importar **os laudos JSON e as amostras antigas já guardadas na VM**, execute o script atualizado com `--biblioteca` e o mesmo ambiente do serviço (incluindo `STATE_DIRECTORY`). Essa opção só lê `STATE_DIRECTORY/laudos/*.json` e `STATE_DIRECTORY/amostras/<sha256>.bin` e envia à API; não inspeciona ou reseta os alvos. `DRY_RUN=true` lista os laudos sem enviar. Arquivos ausentes ou acima de 8 MB são informados e precisam de análise local; não reaparecem automaticamente no app.

Esta mudança no repositório não atualiza a VM do Wazuh por conta própria. Enquanto o coletor não for atualizado, comandos e metadados continuam chegando pela ingestão existente, e o botão de anexar permite importar manualmente uma amostra de hash já cadastrado.

O modelo `infra/range/pericia/seginfo-biblioteca-importar.service` reaproveita os arquivos de ambiente e usuário do serviço de perícia. Depois de instalar o coletor atualizado e copiar essa unidade para `/etc/systemd/system/`, execute `systemctl daemon-reload` e `systemctl start --no-block seginfo-biblioteca-importar.service`. Acompanhe com `journalctl -u seginfo-biblioteca-importar.service`; a unidade não depende do timer de reset. Confirme caminhos e usuário contra o serviço efetivo antes de instalar.

## Backup e privacidade

`ArtefatoAtaque`, `ArtefatoOcorrencia` e `Pericia` entram no backup cifrado e na ferramenta de restauração; backups antigos sem essas coleções continuam aceitos. As amostras aumentam o volume de banco e backup. Todas as consultas e anexos são limitados ao usuário autenticado. Dados reais e amostras nunca entram no Git.

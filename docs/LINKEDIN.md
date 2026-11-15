# Central de conteúdo para LinkedIn

## Posicionamento

Conte a transição como continuidade: a experiência em infraestrutura, DevOps e virtualização ajuda a entender disponibilidade, operação e risco; os estudos e labs atuais mostram como essa base está sendo aplicada à segurança. Identifique claramente o que veio de trabalho, estudo ou laboratório. Use exemplos verificáveis e marque fatos que precisam de confirmação antes de publicar.

Pilares editoriais sugeridos:

- Infraestrutura, DevOps e virtualização aplicados à segurança.
- Labs e prática de Segurança da Informação.
- Aprendizados de Blue Team e operações seguras.
- Transição de carreira com evidências e próximos passos.
- Construção da SegInfo Study e decisões técnicas.

## Formato e tamanho

Não há uma contagem universal que torne um post melhor. Posts de texto servem para um aprendizado ou ponto de vista curto; imagem ajuda a dar contexto visual; documento/carrossel funciona para explicar uma sequência ou checklist; vídeo é útil para demonstração e bastidores; enquete é adequada quando as opções ajudam a entender uma questão profissional. Artigo serve para conteúdo que realmente precisa de mais espaço.

O limite atual de uma publicação comum é 3.000 caracteres. O checklist do Estúdio mostra esse limite, mas não trata um post conciso como inferior. Compare comprimento e formato dentro do seu próprio histórico, anotando métricas alguns dias depois de publicar.

Para imagens, prefira arquivos nítidos e uma ideia visual simples. O LinkedIn recomenda imagem com ao menos 1080 px de largura e aceita proporções de 3:1 a 4:5; a área visual pode cortar imagens fora dessa faixa. Para documento/carrossel, use PDF, título descritivo e texto de acompanhamento que explique por que abrir o material. O Estúdio prepara roteiro, direção visual e texto alternativo, mas a imagem precisa ser criada e revisada antes do upload.

## Assuntos para a ponte Infra → Segurança

1. Decisões operacionais que também afetam segurança: privilégio, segmentação, observabilidade, backup e recuperação.
2. Um lab por vez: hipótese, configuração em termos genéricos, observação e aprendizado — sem publicar endereços, hosts, credenciais ou fraquezas em aberto.
3. Conceitos de segurança vistos pela ótica de quem opera infraestrutura.
4. Reflexões de transição de carreira apoiadas em evidência: estudo concluído, prática realizada e próximo passo.
5. Erros e correções com contexto suficiente para ensinar, sem expor terceiros ou o ambiente real.

## Rotina sustentável

- Comece com uma publicação autoral por semana e comentários úteis em conversas de profissionais da área.
- Alterne os pilares e experimente texto, documento/imagem e vídeo quando o assunto pedir.
- Registre formato, tema/pilar, data e métricas disponíveis; compare resultados depois de alguns dias e procure conversas e visitas relevantes, não apenas curtidas.
- A cada mês, escolha uma hipótese para testar (por exemplo, relato de lab versus explicação técnica) e mude uma variável de cada vez.
- Responda comentários com conteúdo e curiosidade reais. Não use pods, marcações irrelevantes nem pedidos artificiais de engajamento.

## Como o módulo funciona (pipeline)

O conteúdo anda por um caminho só, do assunto até a métrica:

```
Projeto ─► Ideia (backlog) ─► Rascunho ─► Aprovado ─► Agendado ─► Publicado ─► métricas e análise
            ▲                    │ versões      │ preflight      │ lembrete ou API
   análise de post, lab,         └ refino com IA└ (no servidor)  └ registro em "Publicados"
   marco do diário, Radar,
   planejador, à mão
```

| Conceito | O que é | Onde fica |
|---|---|---|
| **Projeto** | Assunto ou série que agrupa ideias, rascunhos, posts e marcos do diário (ex.: "Honeypot exposto"). Apagar o projeto só solta o vínculo. | `LinkedinProjeto` |
| **Ideia** | Item do backlog. Nasce à mão, da análise de um post publicado (cada "ideia derivada" entra sozinha), de um lab concluído, de um marco do diário, do Radar ou do planejador. | `LinkedinIdeia` |
| **Rascunho** | O post em preparação, com estado: `rascunho`, `aprovado`, `agendado`, `publicando`, `publicado`, `falhou`. | `Post` |
| **Versão** | Cada mudança de texto salva (manual ou da IA) fica guardada; dá para restaurar. Até 30 por rascunho. | `PostVersao` |
| **Publicado** | Registro oficial do post no LinkedIn, com métricas e análise da IA. O rascunho aponta para ele. | `LinkedinPost` |

### Regras que protegem a publicação

- **Preflight.** Antes de aprovar, agendar ou publicar, o texto passa por uma verificação: tem gancho e corpo, cabe em 3.000 caracteres, não tem campo entre colchetes para preencher (`[CONFIRMAR: ...]`), não tem endereço IP, faixa de rede nem domínio interno, e não cita ativo do inventário. Termos como "senha" ou "exposto" só avisam. A regra fica em `packages/shared/src/linkedinPipeline.ts` e o **servidor aplica a mesma** (a tela só mostra).
- **Aprovação vale para um texto.** Mudar o gancho, o corpo ou o formato de um rascunho aprovado ou agendado devolve-o para `rascunho`. Nem a importação de dados antigos altera um rascunho aprovado.
- **Um post por dia.** Agendar dois posts para o mesmo dia pede confirmação; horário fora de 6h–22h só avisa.
- **Nada sai sem aprovação.** O agendador só publica o que está `agendado` no canal `api`, e refaz o preflight na hora.
- **Nunca publica duas vezes.** O rascunho é reservado (`publicando`) numa atualização condicional antes de chamar o LinkedIn. Se a API reiniciar no meio, ele vira `falhou` e não é reenviado sozinho: confira no perfil e use "Publiquei: registrar" ou reagende.

### Canais de agendamento

| Canal | O que acontece na hora marcada | Quando usar |
|---|---|---|
| `lembrete` | O post aparece em "Hora de publicar" na aba Pipeline. Você copia, publica no LinkedIn e registra o link. | Sempre disponível; único canal para vídeo, artigo e enquete. |
| `api` | O servidor publica no seu perfil (texto, imagem ou PDF) e cria o registro em Publicados. | Conta do LinkedIn conectada. Imagem e carrossel precisam do arquivo anexado. |

### Arquivo do post, visibilidade e "desfazer"

- **Imagem** (PNG, JPG ou GIF, até 8 MB) para o formato `imagem`; **PDF** (até 20 MB, com título) para o formato `carrossel`, que o LinkedIn mostra como documento que se folheia. O arquivo é anexado no Estúdio, depois de salvar o rascunho; o servidor confere o tipo pelo conteúdo (não pelo nome) e ajusta o formato do post. Anexar, trocar ou tirar o arquivo desfaz a aprovação, como mudar o texto.
- O arquivo fica no banco (`PostMidia`), fora do backup cifrado: é material de publicação. Quem restaurar um backup reanexa o arquivo.
- **Visibilidade:** "Público" ou "Só conexões". Use "Só conexões" no primeiro teste real. Mudar a visibilidade também desfaz a aprovação.
- **Apagar no LinkedIn:** na ficha de um post publicado pela API, o botão apaga o post do perfil (com reações e comentários), tira o registro de Publicados e devolve o rascunho para revisão. Posts publicados à mão continuam sendo apagados direto no LinkedIn.

### Perfil & Voz (a IA aprende quem escreve)

A aba **Perfil & Voz** tem três seções. Tudo fica no servidor e entra no backup (`LinkedinPerfilPro`, `LinkedinInspiracao`, `LinkedinVoz`).

| Seção | O que guarda | Como a IA usa |
|---|---|---|
| **Perfil profissional** | Headline e Sobre atuais, competências, certificações (obtida, em andamento ou planejada), cursos, experiência, projetos e vagas-alvo. Importa o PDF do perfil (Mais > Salvar como PDF) ou edita à mão; "Mesclar" só acrescenta o que falta, "Substituir" troca tudo, e nada grava antes de **Salvar**. | Entra no bloco da jornada como fatos. Só o que está *obtida* vira conquista; *em andamento* vira "estudando para"; *planejada* nunca é citada como feita. As vagas-alvo ajustam ênfase e vocabulário, sem inventar experiência. |
| **Inspirações** | Posts e perfis que você admira, com o que chamou atenção (texto, imagem, frequência, assuntos, carreira). Um print pode ser analisado pela IA, que devolve só a descrição do visual; a imagem não é guardada. | Alimentam o perfil de voz: a IA separa estilo, estrutura e frequência (aproveitar) de conteúdo e opinião (não copiar). |
| **Minha voz** | Perfil aprendido dos seus posts publicados e das inspirações, mais **Minhas regras** em texto livre. Precisa de 3 posts seus ou 2 inspirações. | Vai num bloco de sistema próprio (com cache) em todo rascunho e refino, junto com até 3 posts seus por inteiro como exemplo. Suas regras valem mais que o perfil aprendido. |

O perfil não tem campo para o **nome do empregador**, e a importação do PDF o descarta. Em experiência use só setor ou porte.

**Filtro anti-genérico.** `detectarGenerico` (`packages/shared/src/linkedinEstilo.ts`) procura clichês, abertura genérica, contraste "não é X, é Y", pergunta retórica com resposta, revelação encenada, pedido artificial de interação, marcação que o LinkedIn não renderiza, travessões e emojis em excesso e sequências de frases curtíssimas. Ele atua em três pontos: o card **Soa genérico?** no Estúdio (ao vivo, sem IA), a ação **Tirar o tom de IA** no refino, e uma segunda passada automática sobre o rascunho recém-gerado (o aviso diz o que foi corrigido). É heurístico: avisa, nunca bloqueia.

### IA

- **Gerar rascunho** e **planejador da semana** usam o modelo principal; **refinar** (encurtar, mais concreto, 3 ganchos, tom direto, tirar o tom de IA, roteiro de carrossel, pedido livre) e **organizar** posts usam o modelo rápido. Variáveis `IA_MODELO` e `IA_MODELO_RAPIDO` trocam os dois.
- As tarefas de IA rodam em segundo plano e a tela consulta o resultado. Uma requisição longa não depende mais do túnel, que corta em cerca de 100 s.
- O contexto da jornada (estratégia, histórico, projetos, diário, estudo) vai num bloco de sistema com cache, reaproveitado entre pedidos seguidos.
- **Radar → ideia** usa só números agregados dos eventos da internet (totais, serviços, países, usuários tentados, ações). Nunca IP de origem, alvo, porta ou senha.

## Conectar o LinkedIn (publicação pelo servidor)

O que a API oficial permite para um perfil pessoal, e o que não permite:

| Recurso | Situação |
|---|---|
| Publicar texto no perfil | Sim (produto "Share on LinkedIn"). É o que o app faz. |
| Imagem e documento (PDF, o "carrossel") | Sim, com upload em duas etapas (`initializeUpload` + envio). Implementado. |
| Vídeo, enquete, várias imagens | A API aceita, mas **não implementado**: use o lembrete. |
| Apagar post | Sim (`DELETE /rest/posts/{urn}`). Implementado para o que o servidor publicou. |
| Agendar | A API não tem agendamento: quem agenda é este servidor. |
| Métricas de post pessoal | **Não existem na API** (só páginas de empresa). Continue anotando à mão, alguns dias depois. |
| Validade do acesso | Cerca de 60 dias. Sem refresh token (só apps parceiros têm), é preciso reconectar; a tela avisa quando faltar 7 dias. |

Só a API oficial é usada. Automação de navegador ou raspagem põe a conta em risco e não entra neste projeto.

Passo a passo (uma vez):

1. Em `developers.linkedin.com`, crie um app. Ele precisa estar associado a uma Página do LinkedIn (pode ser uma página sua).
2. Na aba **Products**, peça **Share on LinkedIn** e **Sign In with LinkedIn using OpenID Connect** (os dois são liberados na hora).
3. Na aba **Auth**, em *Authorized redirect URLs*, cadastre `https://<domínio do app>/api/linkedin/conta/callback`.
4. Copie o **Client ID** e o **Client Secret** para as variáveis `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` do serviço `seginfo-api` no Coolify (o segundo como Secret). `PUBLIC_BASE_URL` e `STORAGE_TOKEN_KEY` são as mesmas do backup (docs/ARMAZENAMENTO.md).
5. Redeploy. Em **LinkedIn → Marca pessoal & IA**, clique em **Conectar** e autorize.

O token fica cifrado no banco (AES-256-GCM com `STORAGE_TOKEN_KEY`), nunca chega ao navegador e não entra no backup. Variáveis opcionais: `LINKEDIN_FUSO` (padrão `America/Fortaleza`), `LINKEDIN_API_VERSION` (AAAAMM; o padrão é uma versão conferida na documentação, e cada versão vive cerca de 12 meses) e `LINKEDIN_DOMINIOS_BLOQUEADOS` (domínios próprios que o preflight do servidor trata como "do ambiente").

> A publicação pela API foi escrita conforme a documentação pública do LinkedIn e testada só nas partes que não dependem dele (formato do texto, regras, agendador). O primeiro post real é o teste que falta: publique um texto curto com "Publicar agora" e confira como ficou.

## Próximos passos do módulo

- Upload de imagem e de documento (carrossel) pela API.
- Aviso fora do app (e-mail ou push) quando um lembrete vence ou uma publicação falha.
- "Experimento do mês": registrar hipótese, variável e conclusão ao lado das métricas.

## Fontes oficiais consultadas

- [Recomendações de conteúdo do LinkedIn: o que evitar](https://www.linkedin.com/blog/content-recommendations-avoid)
- [Como escrever um post envolvente no feed do LinkedIn](https://www.linkedin.com/business/talent/blog/talent-acquisition/how-to-write-engaging-post-in-linkedin-feed)
- [Compartilhar fotos no LinkedIn: tamanho e proporção](https://www.linkedin.com/help/linkedin/answer/a527229)
- [Enviar e compartilhar documentos no LinkedIn](https://www.linkedin.com/help/billing/answer/a518909)
- [Publicar e compartilhar atualizações: limite de caracteres](https://www.linkedin.com/help/linkedin/answer/a527226)

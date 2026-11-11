# Ideias de painéis, assuntos e laboratório

Complemento ao `docs/SUGESTOES.md`, focado no **conteúdo de estudo**, não no código.
Parte do que existe hoje: 11 trilhas, cerca de 30 tópicos, 7 labs, o Radar com o
honeypot (Cowrie + OpenCanary) e o homelab (Proxmox, FortiGate, Catalyst 2960,
VLANs 30/60/70, Wazuh/Zabbix/Grafana).

> **Já no app (10/11/2026):** trilhas Resposta a Incidentes & Forense, Análise de Malware
> (defensiva) e Purple Team & Detecção, com 22 tópicos novos; 9 labs novos (range isolado,
> Sysmon + Wazuh, cobertura com Atomic Red Team, análise do honeypot, T-Pot + Radar, NSM com
> SPAN, honeytokens, KEV/EPSS, recuperação de ransomware); campo MITRE em tópicos e labs;
> páginas **Matriz ATT&CK** e **Ameaças (KEV)**. Os labs ofensivos de C2 descritos abaixo
> ficaram fora do catálogo do app.

A ideia central é tratar o homelab como um **campo de treino (cyber range)**: um
ambiente vulnerável de propósito, onde você ataca (Red), detecta e responde (Blue) e
compara os dois lados (Purple). O app registra tudo isso.

---

## 1. Regras do campo de treino (antes de tudo)

Para se deixar vulnerável sem risco para o resto do lab:

- **Duas coisas diferentes, que não se misturam:**
  - *Honeypot* (já existe): fica exposto à internet, mas é de **baixa interação**. Ele
    finge ser um serviço e não executa nada de verdade.
  - *Range vulnerável* (novo): máquinas realmente exploráveis. **Nunca** devem ser
    expostas à internet; só você as ataca, de dentro.
- **Segmento próprio** (por exemplo, uma VLAN 80 "RANGE", ou a VLAN70 de quarentena):
  sem rota para as VLANs de produção, gerência e Coolify, e **sem saída para a
  internet** por padrão. Libere a saída só temporariamente, para baixar uma
  ferramenta.
- **Snapshots no Proxmox** de cada alvo em estado limpo. Todo exercício termina com
  rollback. Uma máquina "infectada" nunca volta ao uso normal.
- **Credenciais exclusivas do range.** Nenhuma senha real, nenhuma conta Microsoft ou
  Google pessoal, nenhum equipamento ou conta da empresa.
- **Atacante dedicado:** uma VM Kali dentro do range. O seu desktop não deve ser o
  atacante.
- Payloads, C2 e amostras de malware ficam **somente** dentro do range.

---

## 2. Labs novos

### Lab 8: Montar o Range (pré-requisito dos próximos)
*Domínio: infra · Nível: intermediário*
1. Criar a VLAN do range no FortiGate e no 2960, com policy "range → qualquer: negar"
   e "Kali → alvos do range: permitir".
2. Subir a VM Kali e os alvos clássicos: **Metasploitable 2/3**, **DVWA/Juice Shop**
   (move o lab existente para cá) e imagens do **VulnHub**.
3. **Vulhub** (docker-compose com CVEs reais: Log4Shell, Struts, Jenkins etc.) numa VM
   Docker do range.
4. Snapshot "limpo" de tudo e um checklist de reset.
5. Teste de contenção: a partir da Kali, confirmar que *não* alcança produção nem a
   internet (reaproveita o lab de segmentação).

### Lab 9: Cavalo de Troia controlado (infecção simulada → detecção → resposta)
*Domínio: purple · Nível: avançado*. É o "me deixar vulnerável" de ponta a ponta.
- **Preparação (Blue):** VM Windows 10/11 "vítima" com **Sysmon** (configuração
  SwiftOnSecurity ou Olaf Hartong) e agente **Wazuh**. Snapshot limpo.
- **Ataque (Red):** na Kali, subir um framework de C2 de código aberto (**Sliver** ou
  **Mythic**), gerar um implante e "ser vítima": executar o arquivo na VM Windows,
  como se fosse um anexo de e-mail.
- Praticar o que um trojan faz, mapeando cada etapa no ATT&CK:
  execução (T1204), persistência via Run key ou tarefa agendada (T1547/T1053),
  descoberta (T1082/T1087), coleta de credenciais (T1003, contra contas de teste) e
  comunicação com o C2 (T1071).
- **Detecção (Blue):** o que o Wazuh e o Sysmon viram? Eventos 1 (processo),
  3 (conexão), 11 (arquivo) e 13 (registro). Escrever uma regra para cada etapa que
  passou despercebida.
- **Resposta:** isolar a VM (policy no FortiGate), capturar a memória, analisar com
  **Volatility 3** (processo suspeito, conexões, injeção), remover a persistência e
  depois fazer rollback do snapshot.
- **Entregável:** relatório "o que o atacante fez × o que eu detectei × tempo até
  detectar". É um ótimo post para o LinkedIn.

### Lab 10: Análise do malware que o honeypot captura
*Domínio: blue · Nível: intermediário*. Aproveita o que o Radar já recebe.
- O Cowrie registra os comandos dos invasores e salva os arquivos que eles tentam
  baixar (em geral, bots Mirai e mineradores).
- Copiar as amostras para uma **VM de análise isolada** (REMnux), sem rede.
- Análise estática: `file`, `strings`, hash, consulta do **hash** (nunca do arquivo) no
  VirusTotal e no MalwareBazaar, e uma regra **YARA** própria.
- Reconstruir a sessão do invasor: o que ele tentou fazer depois de "entrar"?
- Registrar no app como estudo de caso, ligado às técnicas MITRE.

### Lab 11: Purple Team automatizado com Atomic Red Team e Caldera
*Domínio: purple · Nível: intermediário*
- Rodar testes do **Atomic Red Team** (um por técnica) na VM vítima.
- Usar o **MITRE Caldera** para encadear um "adversário" completo.
- Medir: de N técnicas executadas, quantas o Wazuh detectou? Repetir após cada
  melhoria de regra e acompanhar a evolução (alimenta o painel de cobertura, seção 3).

### Lab 12: GOAD, um Active Directory vulnerável completo
*Domínio: purple · Nível: avançado*. Evolui o lab de AD que já existe.
- **GOAD (Game of Active Directory):** vários domínios e florestas cheios de falhas
  de propósito. Precisa de bastante RAM; a versão "mini" é mais leve.
- Praticar: enumeração (BloodHound), Kerberoasting e AS-REP, ataques de ACL, ADCS
  (ESC1-ESC8), relay NTLM, delegações e Golden/Silver Ticket.
- Lado Blue: eventos 4768/4769/4624/4662 no Wazuh e detecção de Kerberoasting por
  tipo de cifra RC4.

### Lab 13: Sensor de rede (NSM) com o SPAN do Catalyst 2960
*Domínio: blue · Nível: intermediário*
- Configurar `monitor session` no 2960 espelhando a VLAN do range para uma VM com
  **Suricata** e **Zeek** (ou Security Onion, que traz tudo pronto).
- Rodar os labs 9 e 12 e ver o ataque **pela rede**: beacon do C2, Kerberos, SMB.
- Comparar a detecção por rede com a detecção no endpoint (Sysmon).

### Lab 14: Honeytokens (enganar o invasor de dentro)
*Domínio: blue · Nível: básico*
- Plantar iscas: um usuário falso "admin_backup" no AD de lab, um arquivo
  `senhas.xlsx` falso num compartilhamento e um **Canarytoken** (URL ou DNS) num
  documento.
- Qualquer toque gera um alerta, que entra no Radar como fonte `canary`; a ingestão
  já suporta novas fontes.

### Lab 15: Senhas e credenciais
*Domínio: red · Nível: básico*
- Extrair hashes do AD de lab (`secretsdump` em contas de teste) e quebrar com
  **hashcat** usando wordlist e regras.
- Comparar o tempo de quebra por política de senha (8 × 12 × frase-senha). Isso
  justifica, com números, a política que você recomenda.

### Lab 16: Phishing contra você mesmo
*Domínio: red · Nível: básico*
- **GoPhish** no range, com campanhas enviadas para contas de teste criadas para isso.
- Lado Blue: analisar os cabeçalhos do e-mail e checar SPF, DKIM e DMARC do seu
  domínio de lab.

### Lab 17: Simulação de ransomware e recuperação
*Domínio: blue · Nível: intermediário*
- Exercício de mesa (tabletop) com o roteiro NIST 800-61r3: um servidor do range
  "criptografado".
- Executar a recuperação de verdade: snapshot e backup, medindo RTO e RPO. Serve
  também como ensaio do restore do próprio SegInfo (pendência aberta).

### Lab 18: Varredura de vulnerabilidades e priorização
*Domínio: blue · Nível: básico*
- **OpenVAS/Greenbone** ou **Nessus Essentials** contra o range.
- Priorizar os achados por **CVSS + EPSS + CISA KEV**, não só por CVSS. Corrigir os 5
  principais e varrer de novo.

---

## 3. Painéis novos

### Painel Purple: Matriz ATT&CK de cobertura (o mais valioso)
Uma grade com táticas nas colunas e técnicas nas células. Cada célula se acende em
camadas:
- **Estudei** (tópico concluído);
- **Ataquei** (executada num lab Red);
- **Detectei** (existe regra no Wazuh testada com sucesso);
- **Vi de verdade** (o Radar registrou na internet).

Mostra num relance onde você sabe atacar mas não sabe detectar, que é exatamente o
que um recrutador de SOC ou Purple Team quer ver. Exportável como camada do
**ATT&CK Navigator** (JSON), que vai para o portfólio.

### Painel do Range
Cada VM alvo com estado (`limpa` / `em exercício` / `comprometida` / `aguardando
rollback`), data do último snapshot, exercício em andamento e um alerta para "VM
comprometida há mais de X dias". Fica no Inventário, com filtro `range`.

### Painel de Exercícios (Red × Blue lado a lado)
Linha do tempo dupla: à esquerda, as ações do atacante com horário; à direita, os
alertas que o Blue recebeu. As métricas são **MTTD** (tempo até detectar),
**técnicas não detectadas** e **falsos positivos**. A evolução entre exercícios mostra
o seu progresso real como defensor.

### Painel Radar ampliado
- Mapa mundial de origens (precisa do GeoIP, já listado nas pendências).
- **Replay de sessões do Cowrie:** os comandos que o invasor digitou, em ordem.
- "Ataque da semana": o padrão mais frequente, explicado com a técnica MITRE e o
  tópico de estudo ligado.
- Top senhas e usuários tentados (se `RADAR_GUARDAR_SENHAS` for ligado), cruzados com
  uma checagem "alguma senha do meu range está nesta lista?".

### Painel de Ameaças relevantes para o seu inventário
Consulta diária ao feed **CISA KEV** e ao NVD, filtrada pelos produtos do seu
inventário (FortiOS, Proxmox, Cisco IOS, Windows Server, Wazuh). Por exemplo:
"saiu uma CVE explorada ativamente no FortiOS que você usa". Alerta prático e ótimo
assunto para posts.

### Painel de Detecções (engenharia de detecção)
Catálogo das suas regras (Wazuh e Sigma): técnica coberta, data em que foi testada,
qual lab a validou e taxa de falso positivo. Uma regra que nunca foi testada aparece
em amarelo.

### Painel de Equilíbrio Red/Blue
Horas e labs por domínio (red, blue, purple, infra), para você não estudar só um
lado. Usa o campo `dominio`, que os labs já têm.

---

## 4. Assuntos (tópicos e trilhas) que faltam

Hoje a trilha Blue tem 3 tópicos e a Red tem 3. Sugestões:

### Trilha nova: Resposta a Incidentes & Forense
- Ciclo de resposta: NIST SP 800-61r3 e SANS PICERL; playbooks.
- Event IDs essenciais do Windows: 4624, 4625, 4672, 4688, 4697, 4720, 4768, 4769,
  1102, 7045.
- Sysmon: instalação, configuração e leitura dos eventos.
- Forense de memória com Volatility 3.
- Forense de disco e linha do tempo (Autopsy, KAPE, Plaso).
- Coleta em larga escala com **Velociraptor**.

### Trilha nova: Análise de Malware
- Tipos: trojan, RAT, worm, ransomware, botnet, loader, infostealer.
- Análise estática (strings, PE, entropia, imports).
- Análise dinâmica em sandbox (REMnux, FLARE-VM, ANY.RUN).
- Regras YARA.
- Engenharia reversa básica (Ghidra).

### Trilha nova: Purple Team & Emulação de Adversários
- Conceito de Purple Team e ciclo de melhoria contínua.
- Atomic Red Team, MITRE Caldera e planos de emulação (CTID Adversary Emulation
  Library, como APT29 e FIN6).
- Engenharia de detecção: regras **Sigma**, testes e métricas.
- Deception: honeypots, honeytokens, Canarytokens.

### Blue Team (ampliar)
- NSM: Suricata, Zeek, Security Onion.
- Threat Intelligence: IOC × TTP, Pirâmide da Dor, MISP, OpenCTI.
- Hardening de Linux (CIS, auditd) e de Windows (GPO, ASR, LAPS, Credential Guard).

### Red Team (ampliar)
- Frameworks de C2: Sliver, Mythic, Havoc. Arquitetura, implantes e o que deixam
  de rastro.
- Escalação de privilégio em Linux (GTFOBins, SUID, cron) e em Windows (serviços,
  tokens, WinPEAS).
- Pivoting e túneis (Ligolo-ng, Chisel, SSH).
- Ataques a AD: Kerberos, ADCS, relay, delegação.
- Quebra de senhas (hashcat, regras, máscaras).
- Engenharia social e phishing (GoPhish).
- **Escrita de relatório de pentest:** sumário executivo, achados, CVSS, evidências,
  recomendações.

### Outros que valorizam o currículo
- Python para Segurança (já está nas pendências).
- Segurança em nuvem (AWS/Azure: IAM, configurações erradas, CloudTrail).
- Containers e Kubernetes (imagens, segredos, Trivy, kube-bench). Você já usa Docker
  e Coolify.
- Wi-Fi (WPA2/WPA3, Evil Twin, apenas em rede própria).
- Certificações práticas: **PNPT** e **CPTS** (Red), **BTL1** e **CyberDefenders**
  (Blue), **CySA+**.

---

## 5. Incrementos no app para suportar tudo isso

1. **Entidade "Exercício"**, com escopo, **regras de engajamento** (alvos permitidos,
   janela, o que é proibido), alvos do inventário, lab ligado, linha do tempo Red e
   linha do tempo Blue. É a base dos painéis de Exercícios e do Range.
2. **Registro de achados**, com título, CVSS, evidência (sem segredos), impacto e
   recomendação. Um botão gera o **relatório de pentest** em PDF, reaproveitando a
   página de Portfólio imprimível.
3. **Wazuh → Radar:** nova fonte `wazuh` na ingestão. O Radar passa a mostrar ataques
   externos (honeypot) **e** detecções internas (range), separados por filtro.
4. **Campo de técnicas MITRE** em tópicos, labs, regras e achados. Alimenta a Matriz
   de cobertura.
5. **Checklist de reset do range** no fim de cada exercício (rollback, credenciais
   trocadas, policy de isolamento conferida). O exercício só fecha com o checklist
   completo.
6. **Arsenal → tipo "cheatsheet"**: comandos de Nmap, Impacket, hashcat, Volatility,
   consultas do Wazuh, com cópia rápida.
7. **Playbooks de resposta** como checklists executáveis (Identificar → Conter →
   Erradicar → Recuperar → Lições), registrando o horário de cada passo.
8. **Gerador de post do exercício**, que estende o "lab concluído → rascunho": "Ataquei
   meu próprio lab com um C2 e veja o que meu SOC detectou". Passa sempre pela
   revisão de segurança, que já existe.

---

## Sequência sugerida

1. **Lab 8 (Range)**: sem isolamento, nenhum dos outros é seguro.
2. **Lab 10 (malware do honeypot)**: usa o que você já tem rodando.
3. **Lab 9 (Cavalo de Troia)** e **Lab 11 (Atomic/Caldera)**, com a trilha "Resposta a
   Incidentes".
4. No app: entidade Exercício e campo MITRE, depois a **Matriz ATT&CK de cobertura**.
5. **Lab 12 (GOAD)** e **Lab 13 (NSM)**, conforme o hardware permitir.

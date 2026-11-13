# Versões

A versão aparece no rodapé do menu lateral (`v0.7.0 · build dd/mm hh:mm`) e em `/api/health`. Ela fica em `packages/shared/src/versao.ts`, lida pelo front e pela API.

**Como conferir se você está na versão certa:** compare o número do rodapé com o da publicação mais recente abaixo. Se o rodapé mostrar um aviso "API em vX", o front e a API estão em versões diferentes: espere o deploy terminar ou recarregue com Ctrl+F5.

**Regra:** toda publicação na `main` aumenta a versão e ganha uma linha aqui. Último número para correção ou ajuste; número do meio para funcionalidade nova.

| Versão | Data | O que entrou |
|---|---|---|
| 0.7.0 | 13/11/2026 | Versão no rodapé do menu; painel "Acessos e integrações" em Meu Ambiente; erros do Proxmox resumidos com dica |
| 0.6.0 | 13/11/2026 | FortiGate e Catalyst 2960 nos agentes, controle de custo diário, auditoria das ações (publicado por outra sessão, sem número na época) |
| 0.5.0 | 13/11/2026 | Tela de aprovação e ações de escrita no Proxmox (sem número na época) |
| 0.4.0 | 13/11/2026 | Leitura do Proxmox pelos agentes (sem número na época) |
| 0.3.0 | 13/11/2026 | Playground: execução de agentes (sem número na época) |

As versões anteriores à 0.7.0 foram numeradas depois, para referência; o app só mostra versão a partir da 0.7.0.

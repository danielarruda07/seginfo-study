# Inteligência: fluxo operacional da Matriz ATT&CK

A Matriz ATT&CK separa evidências operacionais em quatro etapas. Os indicadores
de estudo e prática continuam existindo, mas não contam como evidência de que um
controle detectou ou respondeu a um evento.

## Etapas exibidas

1. **Observação — Radar:** eventos reais recebidos pelos coletores e agregados
   por técnica ATT&CK no período selecionado. Um evento observado não prova,
   sozinho, comprometimento, geração de alerta ou resposta.
2. **Alerta — Wazuh ou exercício:** a técnica acende quando (a) uma regra do
   Wazuh com essa técnica em `rule.mitre.id` disparou nos últimos 30 dias, lido
   direto do indexador (subtécnicas contam para a técnica-mãe), ou (b) um
   exercício do diário Red × Blue registrou resultado `detectado` ou `parcial`.
   A ficha mostra as regras, níveis, agentes e o último alerta. O seletor de
   ambiente separa pelo nome do agente: `prod-*` é produção, o resto é
   laboratório; "Não classificado" não usa o Wazuh.
3. **Validação — regra registrada:** regra/consulta e data marcadas na ficha da
   técnica ou resultado de detecção `detectado` de um exercício. Continua
   declaratório de propósito: o alerta do Wazuh prova que a regra dispara, não
   que ela está certa (falso positivo, cobertura). Quando a técnica tem alerta
   do Wazuh mas nenhuma validação, o próximo passo cita a regra e pede o teste.
4. **Resposta — exercício documentado:** existe texto de triagem/resposta no
   diário Red × Blue. O tempo até responder é informado no exercício. A tela
   ainda não abre incidente automaticamente nem mede contenção diretamente nos
   equipamentos.

Na ficha da técnica, o ciclo mostra o dado que sustenta cada etapa e links para
os eventos do Radar e o diário do Lab. As lacunas sugerem o próximo passo:
investigar o evento, testar um alerta, registrar a validação ou documentar a
resposta. O filtro e as cores da matriz representam essas quatro etapas.

## Limites de interpretação

- Radar e diário Red × Blue são fontes distintas e ainda não compartilham um ID
  de correlação. Não inferir que um evento real foi alertado ou respondido só
  porque existe um exercício semelhante.
- O alerta do Wazuh é agregado por técnica, não por evento: a etapa "Alerta"
  diz que existe regra disparando para a técnica, não que cada evento do Radar
  daquela técnica gerou alerta.
- “Validação” significa que o usuário registrou a regra/data após o teste; não
  é uma comprovação independente do SIEM.
- “Resposta documentada” indica anotação no exercício, não confirmação
  automática de contenção, recuperação ou encerramento de incidente.
- Para correlacionar ponta a ponta, uma fase posterior deve associar exercício,
  evento, alerta e evidência por identificadores e timestamps, preservando a
  origem e o estado de cada registro.

## Arquivos principais

- `apps/web/src/routes/Attack.tsx`: indicadores e matriz.
- `apps/web/src/routes/inteligencia/TecnicaDrawer.tsx`: ciclo operacional por
  técnica.
- `apps/web/src/routes/inteligencia/regras.ts`: filtros e próximo passo.
- `apps/web/src/services/attack.ts`: agregação ATT&CK e exportação Navigator.
- `apps/web/src/services/radar.ts`: resumo e eventos de observação; alertas do
  Wazuh por técnica (`GET /api/radar/wazuh-tecnicas?dias=30&ambiente=`).
- `apps/api/src/wazuhIndexador.ts`: agregação por `rule.mitre.id` (cache de 5 min).
- `apps/web/src/services/exerciciosPurple.ts`: registros Red × Blue.

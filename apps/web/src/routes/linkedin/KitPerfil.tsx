import { useState } from 'react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { copyToClipboard } from '@/lib/clipboard';

const HEADLINE_INICIAL = 'Infraestrutura, DevOps e virtualização | Em transição para Segurança da Informação | Labs e aprendizado prático';
const SOBRE_INICIAL = `Minha trajetória em tecnologia passa por infraestrutura, DevOps e virtualização. Agora estou direcionando essa base para Segurança da Informação, conectando operação, disponibilidade e proteção.

Estou estudando e praticando por meio de labs, projetos e documentação do que funcionou, do que precisei rever e do que ainda estou aprendendo.

Por aqui, compartilho aprendizados sobre infraestrutura segura, virtualização, automação e minha evolução em segurança.

Meu foco atual: [complete com a função ou área de segurança que está buscando].

Se você também conecta infraestrutura e segurança, vamos conversar.`;

export function KitPerfil() {
  const [headline, setHeadline] = useState(HEADLINE_INICIAL);
  const [sobre, setSobre] = useState(SOBRE_INICIAL);
  const [copiado, setCopiado] = useState('');
  function copiar(tipo: string, texto: string) {
    copyToClipboard(texto);
    setCopiado(tipo);
    window.setTimeout(() => setCopiado(''), 1800);
  }

  return (
    <section className="iv-card linkedin-kit">
      <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
        <div><h3 style={{ margin: 0 }}>Kit do perfil</h3><p className="iv-muted" style={{ marginBottom: 0 }}>Rascunhos editáveis para alinhar seu perfil à ponte entre infraestrutura e segurança.</p></div>
        <a href="https://www.linkedin.com/in/danielarruda07/" target="_blank" rel="noreferrer" className="p-button p-button-outlined p-button-sm"><i className="pi pi-external-link p-button-icon p-button-icon-left" /><span className="p-button-label">Abrir perfil</span></a>
      </div>

      <div className="linkedin-kit__grid iv-mt">
        <label className="iv-col iv-gap"><strong>Headline sugerida</strong>
          <InputTextarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={3} autoResize maxLength={220} />
          <Button label={copiado === 'headline' ? 'Copiado' : 'Copiar headline'} icon="pi pi-copy" outlined size="small" onClick={() => copiar('headline', headline)} />
        </label>
        <label className="iv-col iv-gap"><strong>Sobre · versão inicial</strong>
          <InputTextarea value={sobre} onChange={(e) => setSobre(e.target.value)} rows={9} autoResize />
          <Button label={copiado === 'sobre' ? 'Copiado' : 'Copiar texto Sobre'} icon="pi pi-copy" outlined size="small" onClick={() => copiar('sobre', sobre)} />
        </label>
      </div>

      {sobre.includes('[') && <Message severity="warn" text="Complete o trecho entre colchetes com sua área alvo antes de usar o texto no perfil." style={{ width: '100%', marginTop: '.8rem' }} />}

      <div className="linkedin-kit__insight iv-mt">
        <strong><i className="pi pi-lightbulb" /> Sinal do seu conteúdo público</strong>
        <p>Seu post sobre ficar a uma questão do AZ-104 tornou uma dificuldade concreta em conversa entre profissionais. A continuação mais forte é mostrar o que você revisou, como praticou e o que mudou na tentativa seguinte — sem transformar o resultado em uma história de sucesso antes da hora.</p>
        <a href="https://pt.linkedin.com/posts/danielarruda07_n%C3%A3o-foi-dessa-vez-por-apenas-01-quest%C3%A3o-activity-7388602898303242240-yZ9c" target="_blank" rel="noreferrer">Ver publicação usada como referência <i className="pi pi-arrow-up-right" /></a>
      </div>

      <div className="linkedin-kit__grid iv-mt">
        <div><strong>Checklist de conversão do perfil</strong><ol className="iv-muted"><li>Headline: função/área + especialidades comprováveis + direção em segurança.</li><li>Sobre: comece pela proposta de valor; feche com o tipo de desafio que quer resolver.</li><li>Em destaque: 2 ou 3 provas — projeto, lab documentado e apresentação técnica.</li><li>Experiências: descreva contexto, ação e resultado verificável; inclua escala só quando puder sustentá-la.</li><li>Competências: priorize infraestrutura, virtualização, DevOps e as competências de segurança que já praticou.</li></ol></div>
        <div><strong>Ritmo editorial sugerido</strong><ul className="iv-muted"><li>1 publicação autoral por semana: aprendizado, decisão técnica ou projeto.</li><li>2 sessões curtas de comentários úteis em publicações de infraestrutura e segurança.</li><li>A cada mês: reveja conversas, visitas ao perfil e contatos relevantes; repita temas que abriram boas conversas.</li><li>Registre impressões e interações após 7 dias. Compare posts do mesmo formato e tema.</li></ul></div>
      </div>

      <section className="iv-mt" aria-labelledby="linkedin-boas-praticas">
        <h3 id="linkedin-boas-praticas" className="ca-h3">O que tende a tornar seu conteúdo mais útil</h3>
        <div className="linkedin-kit__grid">
          <div><strong>Mostre a ponte entre as áreas</strong><p className="iv-muted ca-small">Contexto real → decisão técnica → evidência do que você praticou → aprendizado. Separe experiência profissional, estudo e laboratório.</p></div>
          <div><strong>Escolha formato pela ideia</strong><p className="iv-muted ca-small">Texto para uma observação; documento/carrossel para uma sequência didática; imagem para apoiar uma ideia; vídeo para demonstração. Não há tamanho universal ideal: o limite do post comum é 3.000 caracteres.</p></div>
          <div><strong>Use arte visual legível</strong><p className="iv-muted ca-small">Comece em 1080 px de largura, confira proporção entre 3:1 e 4:5 e escreva texto alternativo. Carrosséis devem funcionar mesmo para quem só percorre os títulos.</p></div>
          <div><strong>Meça conversas e resultados</strong><p className="iv-muted ca-small">Compare tema e formato com impressões, comentários, compartilhamentos, salvamentos e visitas relevantes ao perfil. Não otimize por curtidas isoladas.</p></div>
        </div>
        <p className="iv-muted ca-small">Sem pods ou pedidos artificiais de engajamento. Veja as <a href="https://www.linkedin.com/blog/content-recommendations-avoid" target="_blank" rel="noreferrer">recomendações do LinkedIn</a> e os <a href="https://www.linkedin.com/help/linkedin/answer/a527229" target="_blank" rel="noreferrer">requisitos para fotos</a>.</p>
      </section>
    </section>
  );
}

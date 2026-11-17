"""Testes do forwarder (so biblioteca padrao): python3 -m unittest test_forwarder.py"""
import gzip
import os
import tempfile
import unittest

import forwarder as fw


class GeoIPTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.caminho = os.path.join(self.dir.name, 'geo.csv.gz')
        # fora de ordem de proposito, com IPv6 e uma linha ZZ
        with gzip.open(self.caminho, 'wt', encoding='utf-8') as f:
            f.write('203.0.113.0,203.0.113.255,BR\n')
            f.write('198.51.100.0,198.51.100.127,NL\n')
            f.write('2001:db8::,2001:db8:ffff:ffff:ffff:ffff:ffff:ffff,"US"\n')
            f.write('192.0.2.0,192.0.2.255,ZZ\n')
            f.write('lixo\n')

    def tearDown(self):
        self.dir.cleanup()

    def test_busca(self):
        g = fw.GeoIP(self.caminho)
        self.assertEqual(g.pais('203.0.113.10'), 'BR')
        self.assertEqual(g.pais('198.51.100.5'), 'NL')
        self.assertIsNone(g.pais('198.51.100.200'))  # buraco entre faixas
        self.assertEqual(g.pais('2001:db8::1'), 'US')
        self.assertIsNone(g.pais('192.0.2.1'))  # ZZ ignorado
        self.assertIsNone(g.pais('nao-e-ip'))

    def test_sem_arquivo(self):
        g = fw.GeoIP(os.path.join(self.dir.name, 'nao-existe.csv'))
        self.assertIsNone(g.pais('203.0.113.10'))


class EnviarTest(unittest.TestCase):
    def setUp(self):
        self.postar_original = fw.postar
        self.dry = fw.CFG['dry']
        fw.CFG['dry'] = False
        self.enviados = []

        def postar(eventos):
            if any(e.get('ruim') for e in eventos):
                return 'invalido'
            self.enviados.extend(eventos)
            return 'ok'
        fw.postar = postar

    def tearDown(self):
        fw.postar = self.postar_original
        fw.CFG['dry'] = self.dry

    def test_isola_evento_invalido(self):
        lote = [{'n': i} for i in range(10)]
        lote[6]['ruim'] = True
        self.assertTrue(fw.enviar(lote))
        self.assertEqual([e['n'] for e in self.enviados], [0, 1, 2, 3, 4, 5, 7, 8, 9])

    def test_erro_de_rede_pede_reenvio(self):
        fw.postar = lambda eventos: 'erro'
        self.assertFalse(fw.enviar([{'n': 1}]))


class ConverterTest(unittest.TestCase):
    def test_cowrie_com_pais_so_para_ip_publico(self):
        dirt = tempfile.TemporaryDirectory()
        caminho = os.path.join(dirt.name, 'geo.csv')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('8.8.8.0,8.8.8.255,US\n')  # faixa publica (as de documentacao contam como reservadas)
        fw.GEO = fw.GeoIP(caminho)
        try:
            base = {'timestamp': '2026-11-13T20:42:23.101-0300', 'rule': {'groups': ['cowrie'], 'level': 5},
                    'agent': {'name': 'range-honeypot'}}
            ev = fw.converter({**base, 'data': {'eventid': 'cowrie.login.failed', 'src_ip': '8.8.8.8',
                                                'username': 'root', 'protocol': 'ssh'}})
            self.assertEqual(ev['paisOrigem'], 'US')
            self.assertEqual(ev['ocorridoEm'], '2026-11-13T23:42:23.101Z')
            interno = fw.converter({**base, 'data': {'eventid': 'cowrie.login.failed', 'src_ip': '10.10.81.10',
                                                     'username': 'root', 'protocol': 'ssh'}})
            self.assertNotIn('paisOrigem', interno)
        finally:
            fw.GEO = None
            dirt.cleanup()


class PromptHoneypotTest(unittest.TestCase):
    def test_converte_sinais_sem_valores(self):
        alerta = {
            'timestamp': '2026-11-14T21:00:00.000-0300', 'agent': {'name': 'range-honeypot'},
            'rule': {'id': '100281', 'level': 10, 'groups': ['honeypot', 'prompt_honeypot'], 'description': 'canario'},
            'data': {'honeypot_type': 'prompt', 'event_type': 'canary_followed', 'src_ip': '8.8.8.8', 'dst_port': '8088',
                     'method': 'GET', 'path': '/_canary/observed', 'query_keys': ['q'], 'body_fields': ['username', 'password'],
                     'user_agent_class': 'python', 'canary_followed': True, 'probe_sqli': True, 'gap_seconds': 0.5},
        }
        ev = fw.converter(alerta)
        self.assertEqual(ev['fonte'], 'prompt_honeypot')
        self.assertEqual(ev['acao'], 'scan')
        self.assertEqual(ev['portaDestino'], 8088)
        self.assertTrue(ev['detalhes']['canarioSeguido'])
        self.assertEqual(ev['detalhes']['sinais'], ['sqli'])
        self.assertEqual(ev['detalhes']['camposFormulario'], ['username', 'password'])
        self.assertNotIn('senhaTentada', ev)
        self.assertNotIn('usuarioTentado', ev)

    def test_login_da_isca_vira_login_falha(self):
        alerta = {'timestamp': '2026-11-14T21:00:00.000-0300', 'rule': {'groups': ['prompt_honeypot']},
                  'data': {'event_type': 'login_attempt', 'src_ip': '8.8.4.4', 'path': '/login.php'}}
        self.assertEqual(fw.converter(alerta)['acao'], 'login_falha')

    def test_formato_real_do_wazuh_com_booleanos_e_numeros_em_texto(self):
        # o decodificador JSON do Wazuh entrega true/false e números como texto no campo data
        alerta = {'timestamp': '2026-11-14T22:21:29.998-0300', 'rule': {'id': '100281', 'groups': ['honeypot', 'prompt_honeypot']},
                  'data': {'honeypot_type': 'prompt', 'event_type': 'canary_followed', 'src_ip': '8.8.8.8', 'dst_port': '8088',
                           'canary_followed': 'true', 'canary_credential_used': 'false', 'probe_sqli': 'true', 'probe_xss': 'false',
                           'gap_seconds': '0.512', 'method_count': '2', 'query_keys': 'q'}}
        det = fw.converter(alerta)['detalhes']
        self.assertTrue(det['canarioSeguido'])
        self.assertFalse(det['credencialIscaUsada'])
        self.assertEqual(det['sinais'], ['sqli'])
        self.assertEqual(det['intervaloSegundos'], 0.512)
        self.assertEqual(det['metodosNaSessao'], 2)
        self.assertEqual(det['chavesQuery'], ['q'])


class ProducaoTest(unittest.TestCase):
    def test_evento_local_sem_ip_sem_mitre_e_sem_senha(self):
        a = {'timestamp': '2026-11-15T01:00:00.000-0300', 'agent': {'id': '099', 'name': 'prod-example', 'labels': {'environment': 'production'}},
             'rule': {'id': '550', 'level': 7, 'groups': ['syscheck'], 'description': 'Integrity changed'},
             'syscheck': {'path': '/etc/example.conf', 'event': 'modified'}}
        ev = fw.converter(a)
        self.assertEqual(ev['ambiente'], 'producao')
        self.assertEqual(ev['fonte'], 'wazuh')
        self.assertNotIn('ipOrigem', ev)
        self.assertNotIn('senhaTentada', ev)
        self.assertEqual(ev['detalhes']['arquivo'], '/etc/example.conf')

    def test_producao_nao_aplica_lista_de_ips_ignorados_do_lab(self):
        ignored = fw.IGNORAR
        import ipaddress
        fw.IGNORAR = [ipaddress.ip_network('192.0.2.0/24')]
        try:
            a = {'agent': {'name': 'prod-example'}, 'rule': {'level': 5, 'groups': ['windows']},
                 'data': {'win': {'system': {'eventID': '4625'}, 'eventdata': {'ipAddress': '192.0.2.20'}}}}
            ev = fw.converter(a)
            self.assertEqual(ev['ipOrigem'], '192.0.2.20')
            self.assertEqual(ev['acao'], 'login_falha')
        finally:
            fw.IGNORAR = ignored

    def test_firewall_nao_herda_ambiente_do_manager(self):
        self.assertEqual(fw.ambiente_alerta({'agent': {'id': '000', 'name': 'range-wazuh'}}), 'nao_classificado')


class VarreduraTest(unittest.TestCase):
    def test_varredura_vinda_da_internet_vira_scan_do_laboratorio(self):
        a = {'timestamp': '2026-11-16T19:30:01.000-0300', 'agent': {'id': '000', 'name': 'range-wazuh'},
             'rule': {'id': '100331', 'level': 8, 'groups': ['range', 'fortigate', 'varredura', 'recon', 'scan'],
                      'mitre': {'id': ['T1046'], 'technique': ['Network Service Discovery']}},
             'data': {'srcip': '45.33.32.156', 'dstport': '6379', 'action': 'accept', 'proto': '6', 'devname': 'fw'}}
        ev = fw.converter(a)
        self.assertEqual((ev['fonte'], ev['acao'], ev['ambiente']), ('fortigate', 'scan', 'laboratorio'))
        self.assertEqual(ev['detalhes']['mitre'][0]['id'], 'T1046')


class IscaWebTest(unittest.TestCase):
    AGENTE = {'id': '006', 'name': 'range-isca-web'}

    def alerta(self, regra, linha, **data):
        return {'timestamp': '2026-11-16T18:10:05.000-0300', 'agent': self.AGENTE, 'rule': regra,
                'full_log': linha, 'data': {'srcip': '203.0.113.7', **data}}

    def test_exploracao_de_plugin_vira_comando_com_tecnica(self):
        linha = ('203.0.113.7 - - [16/Nov/2026:21:10:05 +0000] "POST /wp-content/plugins/wp-file-manager/lib/php/'
                 'connector.minimal.php HTTP/1.1" 200 12 "-" "python-requests/2.31" host=empresa.example scheme=https')
        regra = {'id': '100322', 'level': 12, 'description': 'wp-file-manager', 'groups': ['range', 'isca_web'],
                 'mitre': {'id': ['T1190'], 'technique': ['Exploit Public-Facing Application']}}
        ev = fw.converter(self.alerta(regra, linha))
        self.assertEqual(ev['fonte'], 'isca')
        self.assertEqual(ev['ambiente'], 'laboratorio')
        self.assertEqual(ev['servico'], 'wordpress')
        self.assertEqual(ev['portaDestino'], 443)
        self.assertEqual(ev['detalhes']['mitre'][0]['id'], 'T1190')
        self.assertTrue(ev['detalhes']['url'].startswith('POST /wp-content/plugins/wp-file-manager'))
        self.assertEqual(ev['detalhes']['userAgent'], 'python-requests/2.31')

    def test_ataque_classificado_pelo_wazuh_vira_comando(self):
        linha = '203.0.113.7 - - [x] "GET /vulnerabilities/sqli/?id=1%27+or+1=1 HTTP/1.1" 200 5 "-" "sqlmap" host=dvwa.empresa.example scheme=http'
        regra = {'id': '31103', 'level': 7, 'groups': ['web', 'accesslog', 'attack', 'sql_injection']}
        ev = fw.converter(self.alerta(regra, linha))
        self.assertEqual((ev['acao'], ev['servico'], ev['portaDestino']), ('comando', 'dvwa', 80))

    def test_post_no_login_vira_forca_bruta_e_404_vira_varredura(self):
        regra = {'id': '100324', 'level': 8, 'groups': ['range', 'isca_web']}
        login = '203.0.113.7 - - [x] "POST /xmlrpc.php HTTP/1.1" 200 5 "-" "Mozilla" host=empresa.example scheme=https'
        self.assertEqual(fw.converter(self.alerta(regra, login))['acao'], 'login_falha')
        scan = '203.0.113.7 - - [x] "GET /.env HTTP/1.1" 404 5 "-" "zgrab" host=shop.empresa.example scheme=http'
        ev = fw.converter(self.alerta({'id': '31101', 'level': 5, 'groups': ['web', 'accesslog']}, scan))
        self.assertEqual((ev['acao'], ev['servico']), ('scan', 'juice-shop'))

    def test_webshell_pelo_fim_sem_ip(self):
        a = {'timestamp': '2026-11-16T18:10:05.000-0300', 'agent': self.AGENTE,
             'rule': {'id': '100320', 'level': 12, 'groups': ['range', 'isca_web', 'webshell', 'syscheck'],
                      'mitre': {'id': ['T1505.003'], 'technique': ['Web Shell']}},
             'syscheck': {'path': '/srv/isca/wp/wp-content/uploads/x.php', 'event': 'added'}}
        ev = fw.converter(a)
        self.assertEqual(ev['acao'], 'download')
        self.assertNotIn('ipOrigem', ev)
        self.assertEqual(ev['detalhes']['arquivo'], '/srv/isca/wp/wp-content/uploads/x.php')

    def test_sem_ip_valido_descarta(self):
        regra = {'id': '31101', 'level': 5, 'groups': ['web', 'accesslog']}
        self.assertIsNone(fw.converter(self.alerta(regra, 'x', srcip='lixo')))


if __name__ == '__main__':
    unittest.main()

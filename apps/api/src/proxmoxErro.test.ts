import { describe, expect, it } from 'vitest';
import { resumirErroProxmox } from './proxmoxErro.js';

describe('resumirErroProxmox', () => {
  it('extrai a última mensagem de erro do LINSTOR, corta a pilha e dá a dica', () => {
    const bruto =
      'API Return-Code: 500. Message: Could not create cluster wide snapshot snap_x of pm-1, because: [' +
      '{"ret_code":17563649,"message":"New snapshot \'snap_x\' registered.","obj_refs":{}},' +
      '{"ret_code":17563651,"message":"Suspended IO of \'[pm-1]\' on \'pm02\' for snapshot","obj_refs":{}},' +
      '{"ret_code":-4611686018409823277,"message":"Cannot take snapshot from non-UpToDate DRBD device. Snapshot creation aborted","obj_refs":{}}]' +
      '  at /usr/share/perl5/PVE/Storage/Custom/LINSTORPlugin.pm line 761. \tPVE::Storage::Custom::LINSTORPlugin::volume_snapshot(...) called at /usr/share/perl5/PVE/Storage.pm line 435';
    const r = resumirErroProxmox(bruto);
    expect(r).toContain('Could not create cluster wide snapshot snap_x of pm-1: Cannot take snapshot from non-UpToDate DRBD device');
    expect(r).toContain('réplica DRBD');
    expect(r).not.toContain('perl5');
    expect(r).not.toContain('Suspended IO');
  });

  it('mantém mensagens curtas e reconhece casos comuns', () => {
    expect(resumirErroProxmox('VM 101 not running')).toBe('VM 101 not running — A VM está desligada; essa ação só funciona com ela ligada.');
    expect(resumirErroProxmox('erro qualquer')).toBe('erro qualquer');
  });

  it('limita o tamanho', () => {
    expect(resumirErroProxmox('x'.repeat(2000)).length).toBeLessThanOrEqual(501);
  });
});

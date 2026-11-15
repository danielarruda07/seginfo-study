import { describe, expect, it } from 'vitest';
import { problemaDoArquivo } from './MidiaRascunho';

const MB = 1024 * 1024;

describe('problemaDoArquivo', () => {
  it('aceita imagem até 8 MB e PDF até 20 MB', () => {
    expect(problemaDoArquivo({ type: 'image/png', size: 2 * MB })).toBeNull();
    expect(problemaDoArquivo({ type: 'image/jpeg', size: 8 * MB })).toBeNull();
    expect(problemaDoArquivo({ type: 'application/pdf', size: 19 * MB })).toBeNull();
  });
  it('recusa tamanho acima do limite e tipo não aceito', () => {
    expect(problemaDoArquivo({ type: 'image/png', size: 9 * MB })).toMatch(/8,0 MB/);
    expect(problemaDoArquivo({ type: 'application/pdf', size: 21 * MB })).toMatch(/20,0 MB/);
    expect(problemaDoArquivo({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPG ou GIF/);
    expect(problemaDoArquivo({ type: 'video/mp4', size: 1000 })).toMatch(/PDF/);
  });
});

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextoMarkdown } from './TextoMarkdown';

const html = (texto: string) => renderToStaticMarkup(createElement(TextoMarkdown, { texto }));

describe('TextoMarkdown', () => {
  it('renderiza tabela com cabeçalho e linhas', () => {
    const h = html('Há **2 VMs**:\n\n| VMID | Nome |\n|---|---|\n| 100 | web |\n| 101 | banco |\n\nFim.');
    expect(h).toContain('<th');
    expect(h.match(/<tr>/g)).toHaveLength(3);
    expect(h).toContain('>banco</td>');
    expect(h).toContain('<strong>2 VMs</strong>');
    expect(h).not.toContain('|---');
  });

  it('renderiza listas e código, e não interpreta HTML vindo do texto', () => {
    const h = html('- um\n- `dois`\n\n1. a\n2. b\n\n```\nx < 1\n```\n<script>alert(1)</script>');
    expect(h).toContain('<ul');
    expect(h).toContain('<ol');
    expect(h).toContain('<code>dois</code>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).not.toContain('<script>');
  });
});

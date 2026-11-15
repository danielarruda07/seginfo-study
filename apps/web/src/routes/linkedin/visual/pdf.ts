/**
 * PDF mínimo com uma imagem JPEG por página (o "carrossel" do LinkedIn). Sem dependência externa:
 * cada página tem o tamanho exato da arte, então o LinkedIn mostra os slides sem margem.
 */
export interface PaginaPdf { jpeg: Uint8Array; largura: number; altura: number }

const enc = new TextEncoder();

export function montarPdf(paginas: PaginaPdf[]): Blob {
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const empurrar = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b;
    partes.push(bytes);
    pos += bytes.length;
  };
  const objeto = (n: number, corpo: (string | Uint8Array)[]) => {
    offsets[n] = pos;
    empurrar(`${n} 0 obj\n`);
    corpo.forEach(empurrar);
    empurrar('\nendobj\n');
  };

  empurrar('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const idPagina = (i: number) => 3 + i * 3;
  objeto(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  objeto(2, [`<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] >>`]);
  paginas.forEach((p, i) => {
    const pag = idPagina(i);
    const conteudo = `q ${p.largura} 0 0 ${p.altura} 0 0 cm /Im0 Do Q`;
    objeto(pag, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.largura} ${p.altura}] /Resources << /XObject << /Im0 ${pag + 2} 0 R >> >> /Contents ${pag + 1} 0 R >>`]);
    objeto(pag + 1, [`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`]);
    objeto(pag + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${p.largura} /Height ${p.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      '\nendstream',
    ]);
  });

  const total = 3 + paginas.length * 3;
  const inicioXref = pos;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  empurrar(xref);
  empurrar(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);
  return new Blob(partes as BlobPart[], { type: 'application/pdf' });
}

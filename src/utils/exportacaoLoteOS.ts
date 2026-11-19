import * as XLSX from 'xlsx';
import type { LinhaLancamentoHistoricoOS } from '../components/ModalLancamentoRapidoHistorico';

export const COLUNAS_EXPORTACAO_OS = [
  'Cliente',
  'CNPJ_Cliente',
  'Poco_TAG',
  'Nome_Local_Poco',
  'Cidade_UF',
  'Numero_OS',
  'Data_Execucao',
  'Tipo_Servico',
  'Profundidade_Total_m',
  'Diametro_Pol',
  'NE_Antes_m',
  'NE_Depois_m',
  'ND_Antes_m',
  'ND_Depois_m',
  'Vazao_Antes_m3h',
  'Vazao_Depois_m3h',
  'Crivo_Antes_m',
  'Crivo_Depois_m',
  'Eletrodo_Sup_m',
  'Eletrodo_Inf_m',
  'Tubo_Edutor',
  'Motobomba',
  'Painel_Eletrico',
  'Simular_Teste_Vazao',
  'Duracao_Teste',
  'Equipe',
  'Materiais_Aplicados',
  'Servicos_Executados',
  'Observacoes_Campo',
] as const;

/**
 * Formata data ISO YYYY-MM-DD para DD/MM/AAAA
 */
export function formatarDataBR(data: string): string {
  const limpo = (data || '').trim();
  if (!limpo) return '';
  const mIso = limpo.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    return `${mIso[3].padStart(2, '0')}/${mIso[2].padStart(2, '0')}/${mIso[1]}`;
  }
  const mBr = limpo.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mBr) {
    const ano = mBr[3].length === 2 ? `20${mBr[3]}` : mBr[3];
    return `${mBr[1].padStart(2, '0')}/${mBr[2].padStart(2, '0')}/${ano}`;
  }
  return limpo;
}

/**
 * Converte um texto numérico PT-BR/EN em number JS
 */
function parseNumeroFlex(raw: string): number | null {
  const limpo = raw.trim();
  if (!limpo) return null;
  // Se tiver ponto e vírgula (ex: "4.100,50") -> ponto é milhar, vírgula é decimal
  if (limpo.includes('.') && limpo.includes(',')) {
    const v = Number(limpo.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  }
  // Se tiver apenas vírgula (ex: "22,40" ou "4,10")
  if (limpo.includes(',')) {
    const v = Number(limpo.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  }
  // Se tiver ponto de milhar padrão brasileiro (ex: "4.100" ou "10.000")
  if (/^\d{1,3}(?:\.\d{3})+$/.test(limpo)) {
    const v = Number(limpo.replace(/\./g, ''));
    return Number.isFinite(v) ? v : null;
  }
  const v = Number(limpo);
  return Number.isFinite(v) ? v : null;
}

/**
 * Padroniza medições decimais com vírgula (ex: "22.4" -> "22,40", "36,20 m" -> "36,20").
 * Preserva textos descritivos que não são simples medições numéricas (ex: "Cabo 3x10 mm²").
 */
export function normalizarDecimalVirgula(valor?: string): string {
  const raw = (valor || '').trim();
  if (!raw) return '';

  // Remove apenas sufixo de unidade métrica final (" m", "m", " mts")
  const semUnidadeM = raw.replace(/\s*(?:m|mts|metros)\s*$/i, '').trim();

  // Só converte se o restante for essencialmente um número (com ponto ou vírgula)
  if (/^-?\d+(?:[.,]\d+)?$/.test(semUnidadeM)) {
    const num = parseNumeroFlex(semUnidadeM);
    if (num !== null) {
      return num.toFixed(2).replace('.', ',');
    }
  }

  // Se houver texto misto, troca separador decimal apenas se for um número isolado inicial + nada mais
  return raw;
}

/**
 * Padroniza vazões para m³/h com vírgula (ex: "4.100 L/h" -> "4,10", "2,60 m³/h (2.600 L/h)" -> "2,60").
 */
export function normalizarVazaoParaM3h(valor?: string): string {
  const raw = (valor || '').trim();
  if (!raw) return '';

  // Caso 1: já informa m³/h explicitamente (ex: "2,60 m³/h (2.600 L/h)")
  const m3Match = raw.match(/(\d+(?:[.,]\d+)?)\s*m[³3]\s*\/\s*h/i);
  if (m3Match) {
    const num = parseNumeroFlex(m3Match[1]);
    if (num !== null) return num.toFixed(2).replace('.', ',');
  }

  // Caso 2: informa L/h ou litros/h explicitamente (ex: "4.100 L/h", "2600 L/H")
  const lhMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:l|litros?)\s*\/\s*h/i);
  if (lhMatch) {
    const num = parseNumeroFlex(lhMatch[1]);
    if (num !== null) return (num / 1000).toFixed(2).replace('.', ',');
  }

  // Caso 3: número puro ou com milhar brasileiro
  const numMatch = raw.match(/(\d+(?:[.,]\d+)*)/);
  if (numMatch) {
    const token = numMatch[1];
    const num = parseNumeroFlex(token);
    if (num !== null) {
      // Se for >= 150 (ex: 2600, 4.100, 8000), interpreta como L/h e converte para m³/h
      const emM3h = num >= 150 ? num / 1000 : num;
      return emM3h.toFixed(2).replace('.', ',');
    }
  }

  return raw;
}

/**
 * Converte uma LinhaLancamentoHistoricoOS na matriz exata das 29 colunas obrigatórias
 */
export function linhaParaArray29Colunas(l: LinhaLancamentoHistoricoOS): string[] {
  const durValidas = ['6H', '12H', '24H', '36H', '48H', '72H'];
  const dur = durValidas.includes((l.duracaoTesteLabel || '').toUpperCase())
    ? l.duracaoTesteLabel.toUpperCase()
    : '24H';

  return [
    (l.clienteNome || '').trim(),
    (l.clienteCNPJ || '').trim(),
    (l.pocoTag || '').trim(),
    (l.nomeLocalPoco || '').trim(),
    (l.cidadeUF || '').trim(),
    (l.numeroOS || '').trim(),
    formatarDataBR(l.dataExecucaoISO),
    (l.tipoServico || '').trim(),
    normalizarDecimalVirgula(l.profundidadeTotal),
    (l.diametroRevestimento || '').trim(),
    normalizarDecimalVirgula(l.neAntes),
    normalizarDecimalVirgula(l.neDepois),
    normalizarDecimalVirgula(l.ndAntes),
    normalizarDecimalVirgula(l.ndDepois),
    normalizarVazaoParaM3h(l.vazaoAntes),
    normalizarVazaoParaM3h(l.vazaoDepois),
    normalizarDecimalVirgula(l.crivoAntes),
    normalizarDecimalVirgula(l.crivoDepois),
    normalizarDecimalVirgula(l.eletrodoSup),
    normalizarDecimalVirgula(l.eletrodoInf),
    (l.tuboEdutor || '').trim(),
    (l.especificacaoBomba || '').trim(),
    (l.painelEletrico || '').trim(),
    l.simularTesteVazao ? 'SIM' : 'NÃO',
    dur,
    (l.equipeTexto || '').trim(),
    (l.materiaisTexto || '').trim(),
    (l.servicosTexto || '').trim(),
    (l.observacoesCampo || '').trim(),
  ];
}

function dispararDownloadBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta as linhas no padrão CSV UTF-8 com BOM (\uFEFF), delimitador `;` e escape de aspas/quebras de linha.
 */
export function exportarLoteParaCSV(
  linhas: LinhaLancamentoHistoricoOS[],
  nomeArquivo = `Ordens_Servico_Lote_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const cabecalho = COLUNAS_EXPORTACAO_OS.join(';');
  const corpo = linhas.map((l) =>
    linhaParaArray29Colunas(l)
      .map((val) => {
        const str = String(val ?? '').replace(/"/g, '""');
        return str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')
          ? `"${str}"`
          : str;
      })
      .join(';')
  );

  const conteudo = `\uFEFF${[cabecalho, ...corpo].join('\r\n')}`;
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  dispararDownloadBlob(blob, nomeArquivo);
}

/**
 * Exporta as linhas para Excel (.xlsx) real com:
 * - Exatamente as 29 colunas na ordem exata
 * - Largura automática de colunas
 * - Auto-filtro no cabeçalho e congelamento da 1ª linha
 * - Valores em formato texto/limpo preservando zeros à esquerda em Numero_OS e CNPJ_Cliente
 */
export function exportarLoteParaXLSX(
  linhas: LinhaLancamentoHistoricoOS[],
  nomeArquivo = `Ordens_Servico_Lote_${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const matrizDados: string[][] = [
    [...COLUNAS_EXPORTACAO_OS],
    ...linhas.map((l) => linhaParaArray29Colunas(l)),
  ];

  const ws = XLSX.utils.aoa_to_sheet(matrizDados);

  // Largura automática das colunas baseada no maior conteúdo
  ws['!cols'] = COLUNAS_EXPORTACAO_OS.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 1; r < matrizDados.length; r++) {
      const val = matrizDados[r][colIdx] || '';
      const primeiraLinha = val.split('\n')[0];
      if (primeiraLinha.length > maxLen) {
        maxLen = primeiraLinha.length;
      }
    }
    return { wch: Math.min(48, Math.max(13, maxLen + 3)) };
  });

  // AutoFilter no cabeçalho (linha 1)
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(1, matrizDados.length - 1), c: COLUNAS_EXPORTACAO_OS.length - 1 },
    }),
  };

  // Garante tipo string ('s') e formato texto ('@') nas células para preservar zeros à esquerda (Numero_OS, CNPJ_Cliente, Data, decimais com vírgula)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell) {
        cell.t = 's';
        cell.z = '@';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ordens_de_Servico');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  dispararDownloadBlob(blob, nomeArquivo);
}

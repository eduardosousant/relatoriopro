import React, { useState, useMemo } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  Clock,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  LeituraBombeamentoGeoeste,
  LeituraRecuperacaoGeoeste,
} from '../types/relatorio';
import { parseNumeroSEMA } from './StepDrawdownSection';

interface ModalImportadorPlanilhaProps {
  isOpen: boolean;
  onClose: () => void;
  neBase: number;
  onImportarBombeamento: (leituras: LeituraBombeamentoGeoeste[]) => void;
  onImportarRecuperacao: (leituras: LeituraRecuperacaoGeoeste[]) => void;
}

interface LinhaProcessada {
  linhaNum: number;
  tempo: number | null;
  nd: number | null;
  vazao: number | null;
  areia?: string;
  observacoes?: string;
  bruto: string;
}

export const ModalImportadorPlanilha: React.FC<ModalImportadorPlanilhaProps> = ({
  isOpen,
  onClose,
  neBase,
  onImportarBombeamento,
  onImportarRecuperacao,
}) => {
  const [destino, setDestino] = useState<'bombeamento' | 'recuperacao'>('bombeamento');
  const [textoColado, setTextoColado] = useState<string>('');
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [mensagemStatus, setMensagemStatus] = useState<string>('');

  // Parser inteligente de texto tabular (CSV, TSV, Ponto-e-vírgula ou Espaços de Datalogger)
  const linhasParseadas = useMemo(() => {
    if (!textoColado.trim()) return [];

    const linhas = textoColado
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (linhas.length === 0) return [];

    // Detecção de delimitador com base na primeira linha
    const primeira = linhas[0];
    let delimitador = ';';
    if (primeira.includes('\t')) delimitador = '\t';
    else if (primeira.includes(';')) delimitador = ';';
    else if (primeira.includes(',') && (primeira.match(/,/g) || []).length > 2) delimitador = ',';
    else if (primeira.includes('|')) delimitador = '|';

    // Checar se primeira linha é cabeçalho textual
    let inicioDadosIdx = 0;
    const primeiraColunas = primeira.split(delimitador).map((c) => c.trim().toLowerCase());
    const temCabecalho = primeiraColunas.some(
      (c) =>
        c.includes('tempo') ||
        c.includes('min') ||
        c.includes('hora') ||
        c.includes('nd') ||
        c.includes('nivel') ||
        c.includes('vazao') ||
        c.includes('q')
    );

    if (temCabecalho) {
      inicioDadosIdx = 1;
    }

    const resultado: LinhaProcessada[] = [];

    for (let i = inicioDadosIdx; i < linhas.length; i++) {
      const linha = linhas[i];
      // Separação por delimitador ou múltiplos espaços consecutivos (para logs de datalogger)
      const partes = delimitador === ' '
        ? linha.split(/\s+/)
        : linha.split(delimitador).map((p) => p.trim());

      if (partes.length < 2) continue;

      // Extração de tempo e ND
      // Padrões comuns:
      // [Hora, Tempo, ND, Vazao, Areia, Obs]
      // [Tempo, ND, Vazao]
      // [Tempo, ND]
      let tempo: number | null = null;
      let nd: number | null = null;
      let vazao: number | null = null;
      let areia = '0';
      let obs = '';

      // Tenta achar colunas numéricas
      const numerosDetectados: { val: number; idx: number }[] = [];
      partes.forEach((p, idx) => {
        // Se for horário HH:MM:SS, ignora para número
        if (p.includes(':') && p.split(':').length >= 2) return;
        const num = parseNumeroSEMA(p);
        if (num !== null) {
          numerosDetectados.push({ val: num, idx });
        }
      });

      if (numerosDetectados.length >= 2) {
        // O primeiro número geralmente é o tempo em minutos
        tempo = Math.round(numerosDetectados[0].val);
        // O segundo número é o Nível Dinâmico (m)
        nd = Number(numerosDetectados[1].val.toFixed(2));

        if (numerosDetectados.length >= 3) {
          vazao = Number(numerosDetectados[2].val.toFixed(3));
        }

        // Se houver texto além dos números, vira observação
        const textosExtras = partes.filter((p, idx) => {
          return (
            !numerosDetectados.some((ndItem) => ndItem.idx === idx) &&
            !p.includes(':') &&
            p.length > 0
          );
        });
        if (textosExtras.length > 0) {
          obs = textosExtras.join(' ');
        }
      }

      if (tempo !== null && nd !== null) {
        resultado.push({
          linhaNum: i + 1,
          tempo,
          nd,
          vazao,
          areia,
          observacoes: obs || 'Importado via planilha',
          bruto: linha,
        });
      }
    }

    return resultado;
  }, [textoColado]);

  if (!isOpen) return null;

  // Upload de arquivo pelo navegador
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const conteudo = (event.target?.result as string) || '';
      setTextoColado(conteudo);
      setMensagemStatus(`Arquivo "${file.name}" carregado (${conteudo.length} caracteres).`);
    };
    reader.readAsText(file);
  };

  // Download do modelo oficial de CSV para o usuário preencher no Excel
  const handleBaixarModeloCSV = () => {
    const cabecalho = 'Tempo (min);Nivel Dinamico (m);Vazao (m3/h);Areia (ppm);Observacoes\n';
    const dadosExemplo =
      '1;26,90;10,286;0;Inicio ensaio Q cte\n' +
      '2;29,40;10,286;0;\n' +
      '5;35,60;10,286;0;\n' +
      '10;44,90;10,286;0;Ciclo log t=10 min\n' +
      '30;53,10;10,286;0;\n' +
      '60;59,40;10,286;0;\n' +
      '100;62,90;10,286;0;Ciclo log t=100 min\n' +
      '160;64,10;10,286;0;Estabilizacao de ND\n' +
      '250;64,10;10,286;0;Estabilizado\n' +
      '400;64,10;10,286;0;Estabilizado (24h)\n';

    const blob = new Blob([cabecalho + dadosExemplo], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Modelo_Planilha_Teste_Vazao_Geoeste.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Carregar exemplo de preenchimento rápido
  const carregarExemploColagem = () => {
    const exemplo =
`Tempo (min)\tND (m)\tVazão (m³/h)\tObservação
1\t27.40\t12.500\tInício ensaio
2\t30.10\t12.500\t
5\t36.80\t12.500\t
10\t45.20\t12.500\tCiclo log t=10
20\t51.30\t12.500\t
60\t60.10\t12.500\t
100\t63.40\t12.500\tCiclo log t=100
160\t64.80\t12.500\tEstabilização
250\t64.80\t12.500\tEstabilizado
400\t64.80\t12.500\tEncerramento 24h`;
    setTextoColado(exemplo);
    setNomeArquivo('Exemplo_Colado_Excel.tsv');
  };

  // Confirmar e aplicar importação
  const handleConfirmarImportacao = () => {
    if (linhasParseadas.length === 0) return;

    if (destino === 'bombeamento') {
      const leiturasBomb: LeituraBombeamentoGeoeste[] = linhasParseadas.map(
        (l, idx) => ({
          id: `bomb-import-${Date.now()}-${idx}`,
          tMin: l.tempo ?? idx + 1,
          ndM: (l.nd ?? 0).toFixed(2).replace('.', ','),
          vazaoM3h: (l.vazao ?? 10.29).toFixed(3).replace('.', ','),
          areiaPpm: l.areia || '0',
          observacoes: l.observacoes || 'Água límpida',
        })
      );
      onImportarBombeamento(leiturasBomb);
    } else {
      const leiturasRec: LeituraRecuperacaoGeoeste[] = linhasParseadas.map(
        (l, idx) => ({
          id: `rec-import-${Date.now()}-${idx}`,
          tMin: l.tempo ?? idx + 1,
          ndM: (l.nd ?? 0).toFixed(2).replace('.', ','),
          sCalcM: '',
          observacoes: l.observacoes || 'Ascensão contínua',
        })
      );
      onImportarRecuperacao(leiturasRec);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#1B2A3B] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#E8A020] text-[#1B2A3B]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Importar Planilha de Leituras de Teste de Vazão
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-[#E8A020]/20 text-[#E8A020] border border-[#E8A020]/30">
                  CSV · Excel · TXT · Datalogger
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Carregue arquivos do campo ou cole dados diretamente copiados do Excel / Google Sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-[#1B2A3B] dark:text-slate-200">
          {/* Seletor do Destino das Leituras */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200 block">
                Destino das Leituras Importadas
              </span>
              <span className="text-[11px] text-[#6B7A8D]">
                Selecione qual tabela do ensaio receberá estas medições
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDestino('bombeamento')}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  destino === 'bombeamento'
                    ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 text-[#6B7A8D]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>1. Bombeamento (Anexo I.1)</span>
              </button>

              <button
                type="button"
                onClick={() => setDestino('recuperacao')}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  destino === 'recuperacao'
                    ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 text-[#6B7A8D]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>2. Recuperação (Anexo I.2)</span>
              </button>
            </div>
          </div>

          {/* Área de Upload e Download de Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opção 1: Upload de Arquivo */}
            <div className="p-4 rounded-xl border border-dashed border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] transition-colors bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center p-5">
              <input
                type="file"
                id="input-arquivo-csv"
                accept=".csv,.txt,.tsv,.dat"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="input-arquivo-csv"
                className="cursor-pointer flex flex-col items-center group w-full"
              >
                <div className="p-3 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[#E8A020] group-hover:scale-110 transition-transform mb-2">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100 group-hover:text-[#E8A020]">
                  {nomeArquivo || 'Selecionar arquivo CSV / TXT'}
                </span>
                <span className="text-[11px] text-[#6B7A8D] mt-0.5">
                  Suporta arquivos de Datalogger e planilhas (.csv, .tsv, .txt)
                </span>
              </label>
            </div>

            {/* Opção 2: Baixar Planilha Modelo + Ação Rápida */}
            <div className="p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200 block mb-1">
                  Modelo Oficial de Planilha
                </span>
                <p className="text-[11px] text-[#6B7A8D] leading-relaxed">
                  Baixe o modelo com as colunas certas para preencher no Excel e importar de volta ao sistema.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleBaixarModeloCSV}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] text-[#1B2A3B] dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#E8A020]" />
                  <span>Baixar Modelo CSV</span>
                </button>

                <button
                  type="button"
                  onClick={carregarExemploColagem}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100 text-amber-900 dark:text-amber-300 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Carregar Exemplo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Área de Colagem Direta (Ctrl+V) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A8D]">
                Ou cole o texto diretamente da sua planilha (Ctrl+V)
              </label>
              {linhasParseadas.length > 0 && (
                <span className="text-[11px] font-mono font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {linhasParseadas.length} leituras válidas identificadas
                </span>
              )}
            </div>

            <textarea
              rows={4}
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
              placeholder="Exemplo de colagem direta do Excel:&#10;1  26,90  10,286&#10;2  29,40  10,286&#10;5  35,60  10,286&#10;10 44,90  10,286"
              className="w-full p-3 font-mono text-xs rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-[#E8A020]"
            />
          </div>

          {/* Tabela de Pré-visualização dos Dados Parseados */}
          {linhasParseadas.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                  Pré-visualização dos Dados Identificados ({linhasParseadas.length} linhas)
                </span>
                <span className="text-[11px] text-[#6B7A8D]">
                  N.E. de Referência atual: <strong>{neBase.toFixed(2).replace('.', ',')} m</strong>
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto border border-[#DDE3EC] dark:border-slate-800 rounded-xl">
                <table className="w-full border-collapse text-xs font-mono">
                  <thead className="sticky top-0 bg-[#1B2A3B] text-white text-[10px] uppercase">
                    <tr>
                      <th className="py-1.5 px-3 text-center w-12">#</th>
                      <th className="py-1.5 px-3 text-center">Tempo (min)</th>
                      <th className="py-1.5 px-3 text-right">N.D. (m)</th>
                      <th className="py-1.5 px-3 text-right">Rebaixamento s (m)</th>
                      {destino === 'bombeamento' && (
                        <th className="py-1.5 px-3 text-right">Vazão Q (m³/h)</th>
                      )}
                      <th className="py-1.5 px-3 text-left">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                    {linhasParseadas.slice(0, 50).map((l, idx) => {
                      const sCalc = l.nd !== null ? Math.max(0, l.nd - neBase) : 0;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-1 px-3 text-center text-[#6B7A8D]">{idx + 1}</td>
                          <td className="py-1 px-3 text-center font-bold text-sky-600">
                            {l.tempo} min
                          </td>
                          <td className="py-1 px-3 text-right font-bold text-amber-600">
                            {l.nd !== null ? l.nd.toFixed(2).replace('.', ',') : '-'} m
                          </td>
                          <td className="py-1 px-3 text-right text-slate-500">
                            {sCalc.toFixed(2).replace('.', ',')} m
                          </td>
                          {destino === 'bombeamento' && (
                            <td className="py-1 px-3 text-right text-emerald-600">
                              {l.vazao !== null ? l.vazao.toFixed(3).replace('.', ',') : '10,290'}
                            </td>
                          )}
                          <td className="py-1 px-3 text-left text-[#6B7A8D] truncate max-w-[200px]">
                            {l.observacoes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {linhasParseadas.length > 50 && (
                <div className="text-[11px] text-center text-[#6B7A8D]">
                  Exibindo as primeiras 50 leituras de um total de {linhasParseadas.length}.
                </div>
              )}
            </div>
          ) : textoColado.trim() ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Nenhuma leitura numérica reconhecida no texto. Certifique-se de que há pelo menos uma coluna com o tempo em minutos e outra com o Nível Dinâmico em metros.
              </span>
            </div>
          ) : null}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#6B7A8D]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={linhasParseadas.length === 0}
            onClick={handleConfirmarImportacao}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all ${
              linhasParseadas.length > 0
                ? 'bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] cursor-pointer'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>
              Carregar {linhasParseadas.length} Leituras em {destino === 'bombeamento' ? 'Bombeamento' : 'Recuperação'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

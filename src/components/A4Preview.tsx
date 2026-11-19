import React, { useState, useRef, useEffect } from 'react';
import { RelatorioTecnico, SecoesVisiveisRelatorio } from '../types/relatorio';
import {
  formatarDataBR,
  CONFIG_LAYOUT_PDF_A4,
} from '../services/pdfExportService';
import {
  calcularParametrosStepDrawdownSEMA,
  calcularDominioRebaixamentoGrafico,
  calcularEscalaTempoLogGrafico,
  fmtNumeroSEMA,
} from './StepDrawdownSection';
import {
  MathFormulaBlock,
  construirEquacoesLivroRelatorio,
} from './MathFormulaBlock';
import { PocoLocationMap } from './PocoLocationMap';
import {
  extrairCoordenadasGeograficas,
  latLngParaUTM,
} from '../utils/coordenadasParser';
import { calcularDimensionamentoBomba } from '../utils/dimensionamentoBomba';
import {
  FileDown,
  Printer,
  Maximize2,
  Minimize2,
  Settings2,
  CheckSquare,
  SlidersHorizontal,
  X,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';

export interface SecaoConfigItem {
  key: keyof SecoesVisiveisRelatorio;
  numero: string;
  titulo: string;
  descricao: string;
  destaque?: boolean;
}

export const SECOES_CONFIG_RELATORIO: SecaoConfigItem[] = [
  {
    key: 'clienteLocal',
    numero: '3',
    titulo: 'Cliente e Local',
    descricao: 'Endereço da obra e coordenadas geográficas / UTM.',
  },
  {
    key: 'informacoesPoco',
    numero: '4',
    titulo: 'Informações do Poço',
    descricao: 'Profundidade, níveis (NE/ND), diâmetro, vazão de ensaio e bomba.',
  },
  {
    key: 'desenhoConstrutivo',
    numero: '5',
    titulo: 'Desenho Construtivo / Perfil Técnico do Poço',
    descricao: 'Casing Ø 6", cimentação sanitária (0-24m), laje de proteção e posicionamento de equipamentos.',
    destaque: true,
  },
  {
    key: 'servicosExecutados',
    numero: '6',
    titulo: 'Serviços Técnicos Executados',
    descricao: 'Memorial descritivo, etapas conduzidas, equipe técnica mobilizada e materiais aplicados.',
  },
  {
    key: 'parecerHidrogeologico',
    numero: '7',
    titulo: 'Parecer Hidrogeológico e Vazão Recomendada',
    descricao: 'Cálculos de Cooper-Jacob, rebaixamento, recuperação e formulação matemática.',
  },
  {
    key: 'checklist',
    numero: '8',
    titulo: 'Checklist de Conformidade e Segurança',
    descricao: 'Verificação dos itens normativos de segurança, sanitários e elétricos em campo.',
  },
  {
    key: 'recomendacoes',
    numero: '9',
    titulo: 'Recomendações Operacionais e Manutenção',
    descricao: 'Diretrizes preventivas, periodicidade de análises e observações gerais.',
  },
  {
    key: 'fotos',
    numero: '10',
    titulo: 'Registro Fotográfico de Evidências',
    descricao: 'Mosaico de fotos das etapas, motobomba, painel elétrico e cavalete.',
  },
  {
    key: 'assinaturas',
    numero: '11',
    titulo: 'Termo de Encerramento e Assinaturas',
    descricao: 'Assinatura digital e declaração técnica do responsável técnico e cliente.',
  },
  {
    key: 'anexos',
    numero: 'Anexo',
    titulo: 'Anexos I.1, I.2 e I.3 — Planilhas e Gráficos do Teste de Bombeamento',
    descricao: 'Planilhas completas de 24h, recuperação residual e gráficos semi-log (3 páginas).',
  },
];

interface A4PreviewProps {
  relatorio: RelatorioTecnico;
  exportandoPdf: boolean;
  onExportarPDF: () => void;
  onAtualizarSecoesVisiveis?: (secoes: NonNullable<RelatorioTecnico['secoesVisiveis']>) => void;
}

const A4_WIDTH_PX = 794; // 210mm @ 96dpi

export function valOuPreencher(
  valor: string | undefined | null,
  fallback = '[DADO A PREENCHER EM CAMPO]'
): string {
  if (!valor) return fallback;
  const limpo = valor.trim();
  if (!limpo || limpo === '—' || limpo === '-' || limpo.toUpperCase() === 'N/I') {
    return fallback;
  }
  return limpo;
}

const A4SheetScaled: React.FC<{
  scale: number;
  printBreakBefore?: boolean;
  children: React.ReactNode;
}> = ({ scale, printBreakBefore = false, children }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState<number>(1123);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const update = () => {
      const h = Math.max(el.offsetHeight, el.scrollHeight);
      if (h > 0) {
        setSheetHeight(h);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [children]);

  const isScaled = scale < 0.995;

  return (
    <div
      className={`w-full flex justify-center overflow-x-hidden overflow-y-visible print:!overflow-visible print:!h-auto ${
        printBreakBefore ? 'print:break-before-page' : ''
      }`}
      style={
        isScaled
          ? { minHeight: `${Math.ceil(sheetHeight * scale) + 8}px` }
          : undefined
      }
    >
      <div
        ref={sheetRef}
        style={
          isScaled
            ? {
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
              }
            : undefined
        }
        className="w-[210mm] min-w-[210mm] min-h-[297mm] h-fit bg-white text-[#1B2A3B] border border-[#DDE3EC] shadow-md p-[14mm] flex flex-col justify-between print:!transform-none print:border-none print:shadow-none print:p-0 shrink-0"
      >
        {children}
      </div>
    </div>
  );
};

const SectionBar: React.FC<{ titulo: string }> = ({ titulo }) => (
  <div className="flex items-center bg-[#1B2A3B] text-white h-[7.5mm] mb-2.5">
    <div className="w-[3mm] h-full bg-[#E8A020] shrink-0" />
    <span className="text-[9pt] font-bold tracking-wide px-2.5 uppercase">
      {titulo}
    </span>
  </div>
);

const TimbreHeaderPadrao: React.FC<{ relatorio: RelatorioTecnico }> = ({
  relatorio,
}) => (
  <div className="grid grid-cols-12 items-center bg-white pb-2.5 mb-3 border-b border-[#DDE3EC]">
    <div className="col-span-4 p-2.5 flex items-center justify-center h-full">
      {relatorio.cabecalho.logoBase64 ? (
        <img
          src={relatorio.cabecalho.logoBase64}
          alt="Hidrogeo Engenharia"
          className="max-h-14 w-auto object-contain"
        />
      ) : (
        <span className="text-base font-bold text-[#1B2A3B]">HIDROGEO</span>
      )}
    </div>
    <div className="col-span-8 p-2 text-center">
      <h1 className="text-[10.5pt] font-extrabold uppercase text-[#000080] tracking-wide">
        {valOuPreencher(
          relatorio.cabecalho.razaoSocial,
          CONFIG_LAYOUT_PDF_A4.cabecalho.razaoSocialPadrao
        )}
      </h1>
      <p className="text-[8pt] font-semibold text-slate-700 mt-0.5">
        CNPJ:{' '}
        {valOuPreencher(
          relatorio.cabecalho.cnpj,
          CONFIG_LAYOUT_PDF_A4.cabecalho.cnpjPadrao
        )}
      </p>
      <p className="text-[7.5pt] text-slate-600 leading-snug mt-0.5">
        {valOuPreencher(
          relatorio.cabecalho.enderecoEmpresa,
          CONFIG_LAYOUT_PDF_A4.cabecalho.enderecoPadrao
        )}
        <br />
        {valOuPreencher(
          relatorio.cabecalho.cidadeContatoEmpresa,
          CONFIG_LAYOUT_PDF_A4.cabecalho.cidadeContatoPadrao
        )}
        <br />
        E-mail:{' '}
        {valOuPreencher(
          relatorio.cabecalho.emailEmpresa,
          CONFIG_LAYOUT_PDF_A4.cabecalho.emailPadrao
        )}
      </p>
    </div>
  </div>
);

const RodapePadrao: React.FC<{
  relatorio: RelatorioTecnico;
  isFolhaDeRosto?: boolean;
  etiquetaPagina?: string;
}> = ({ relatorio, isFolhaDeRosto = false, etiquetaPagina }) => {
  const empresa = valOuPreencher(
    relatorio.cabecalho.razaoSocial,
    CONFIG_LAYOUT_PDF_A4.cabecalho.razaoSocialPadrao
  );

  const sufixo =
    isFolhaDeRosto && !CONFIG_LAYOUT_PDF_A4.rodape.exibirNumeracaoNaFolhaDeRosto
      ? ''
      : etiquetaPagina ||
        `Relatório Técnico — ${valOuPreencher(
          relatorio.cabecalho.contratoOS,
          'OS-2026-0842'
        )}`;

  return (
    <div className="mt-6 pt-2 border-t border-[#DDE3EC] text-center text-[7.3pt] text-[#6B7A8D]">
      {sufixo ? `${empresa} | ${sufixo}` : empresa}
    </div>
  );
};

export const A4Preview: React.FC<A4PreviewProps> = ({
  relatorio,
  exportandoPdf,
  onExportarPDF,
  onAtualizarSecoesVisiveis,
}) => {
  const [modalSecoesAberta, setModalSecoesAberta] = useState(false);
  const secoes = relatorio.secoesVisiveis || {};

  const isSecaoAtiva = (key: keyof SecoesVisiveisRelatorio): boolean => {
    return secoes[key] !== false;
  };

  const alternarSecao = (key: keyof SecoesVisiveisRelatorio) => {
    const atual = isSecaoAtiva(key);
    const novas: SecoesVisiveisRelatorio = {
      informacoesGerais: secoes.informacoesGerais !== false,
      clienteLocal: secoes.clienteLocal !== false,
      informacoesPoco: secoes.informacoesPoco !== false,
      desenhoConstrutivo: secoes.desenhoConstrutivo !== false,
      servicosExecutados: secoes.servicosExecutados !== false,
      parecerHidrogeologico: secoes.parecerHidrogeologico !== false,
      checklist: secoes.checklist !== false,
      recomendacoes: secoes.recomendacoes !== false,
      fotos: secoes.fotos !== false,
      assinaturas: secoes.assinaturas !== false,
      anexos: secoes.anexos !== false,
      [key]: !atual,
    };
    onAtualizarSecoesVisiveis?.(novas);
  };

  const aplicarPreset = (tipo: 'completo' | 'simplificado' | 'parecer_direto') => {
    if (tipo === 'completo') {
      onAtualizarSecoesVisiveis?.({
        informacoesGerais: true,
        clienteLocal: true,
        informacoesPoco: true,
        desenhoConstrutivo: true,
        servicosExecutados: true,
        parecerHidrogeologico: true,
        checklist: true,
        recomendacoes: true,
        fotos: true,
        assinaturas: true,
        anexos: true,
      });
    } else if (tipo === 'simplificado') {
      // Relatório Simplificado sem Desenho Construtivo e sem Checklist, e sem Anexos
      onAtualizarSecoesVisiveis?.({
        informacoesGerais: true,
        clienteLocal: true,
        informacoesPoco: true,
        desenhoConstrutivo: false, // Desabilitado conforme solicitado pelo usuário
        servicosExecutados: true,
        parecerHidrogeologico: true,
        checklist: false,
        recomendacoes: true,
        fotos: true,
        assinaturas: true,
        anexos: false,
      });
    } else if (tipo === 'parecer_direto') {
      onAtualizarSecoesVisiveis?.({
        informacoesGerais: true,
        clienteLocal: true,
        informacoesPoco: true,
        desenhoConstrutivo: false,
        servicosExecutados: false,
        parecerHidrogeologico: true,
        checklist: false,
        recomendacoes: true,
        fotos: false,
        assinaturas: true,
        anexos: false,
      });
    }
  };

  const totalAtivas = SECOES_CONFIG_RELATORIO.filter((s) => isSecaoAtiva(s.key)).length;

  const fotosOrdenadas = [...relatorio.fotos].sort((a, b) => a.ordem - b.ordem);
  const equipeValida = (relatorio.equipe || []).filter(
    (m) => m.nome.trim() || m.funcao.trim()
  );
  const servicosValidos = (relatorio.servicosConduzidos || []).filter((s) =>
    s.descricao.trim()
  );
  const materiaisValidos = (relatorio.materiaisAplicados || []).filter((m) =>
    m.descricao.trim()
  );
  const oc = relatorio.ocorrenciasCampo;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ajustarATela, setAjustarATela] = useState<boolean>(true);
  const [larguraContainer, setLarguraContainer] = useState<number>(A4_WIDTH_PX);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setLarguraContainer(el.clientWidth || window.innerWidth);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const escalaCalculada = Math.min(
    1,
    Math.max(0.38, (larguraContainer - 8) / A4_WIDTH_PX)
  );
  const escalaEfetiva = ajustarATela ? escalaCalculada : 1;
  const precisaEscala = escalaCalculada < 0.98;

  const nomeRespTecnico = valOuPreencher(
    relatorio.cabecalho.responsavelTecnicoNome ||
      relatorio.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoNome ||
      relatorio.assinaturaResponsavel?.nomeSignatario,
    'José Roberto Ribeiro'
  );
  const creaRespTecnico = valOuPreencher(
    relatorio.cabecalho.responsavelTecnicoCREA ||
      relatorio.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoCREA ||
      relatorio.assinaturaResponsavel?.documento,
    '[DADO A PREENCHER EM CAMPO]'
  );
  const formatarCREA = (valor: string) => {
    const limpo = valor.trim();
    if (!limpo || limpo.includes('DADO A PREENCHER')) {
      return limpo || '[DADO A PREENCHER EM CAMPO]';
    }
    return /^CREA\b/i.test(limpo) ? limpo : `CREA: ${limpo}`;
  };
  const creaRespFormatado = formatarCREA(creaRespTecnico);
  const respTecnicoFormatado =
    !creaRespTecnico || creaRespTecnico.includes('DADO A PREENCHER')
      ? nomeRespTecnico
      : `${nomeRespTecnico} — ${/^CREA\b/i.test(creaRespTecnico) ? creaRespTecnico : `CREA ${creaRespTecnico}`}`;

  const nomeRespElaboracao = valOuPreencher(
    relatorio.cabecalho.responsavelElaboracaoNome ||
      relatorio.assinaturaCliente?.nomeSignatario,
    'Departamento Técnico de Hidrogeologia'
  );
  const cargoRespElaboracao = valOuPreencher(
    relatorio.cabecalho.responsavelElaboracaoCargo ||
      relatorio.assinaturaCliente?.funcao,
    'Responsável pela Elaboração do Relatório Técnico'
  );

  const coordGeoBruta =
    relatorio.dadosPoco?.coordenadasGeograficas ||
    relatorio.cabecalho?.coordenadasGeograficas ||
    '';
  const coordExtraidaPreview = extrairCoordenadasGeograficas(
    relatorio.dadosPoco?.coordenadasGeograficas,
    relatorio.cabecalho?.coordenadasGeograficas
  );
  const utmPreviewStr = (() => {
    const utmBruto = relatorio.dadosPoco?.coordenadasUTM?.trim();
    if (
      utmBruto &&
      !utmBruto.startsWith('[DADO A PREENCHER') &&
      utmBruto !== '—' &&
      utmBruto !== '-'
    ) {
      return utmBruto;
    }
    if (coordExtraidaPreview) {
      const utm = latLngParaUTM(coordExtraidaPreview.lat, coordExtraidaPreview.lng);
      return `${utm.zona}${utm.banda} (E:${utm.easting} / N:${utm.northing})`;
    }
    return '[DADO A PREENCHER EM CAMPO]';
  })();

  // Numeração dinâmica sequencial para nunca pular número quando fotos ou seções opcionais forem omitidas
  const secNums = (() => {
    let n = 3;
    const clienteLocal =
      isSecaoAtiva('clienteLocal') ? n++ : n;
    const informacoesPoco =
      relatorio.dadosPoco?.incluirNoRelatorio && isSecaoAtiva('informacoesPoco')
        ? n++
        : n;
    const desenhoConstrutivo = isSecaoAtiva('desenhoConstrutivo') ? n++ : n;
    const servicosExecutados = isSecaoAtiva('servicosExecutados') ? n++ : n;
    const parecerHidrogeologico = isSecaoAtiva('parecerHidrogeologico')
      ? n++
      : n;
    const checklist =
      isSecaoAtiva('checklist') &&
      relatorio.checklist &&
      relatorio.checklist.length > 0
        ? n++
        : n;
    const recomendacoes = isSecaoAtiva('recomendacoes') ? n++ : n;
    const fotos = isSecaoAtiva('fotos') ? n++ : n;
    const assinaturas = isSecaoAtiva('assinaturas') ? n++ : n;
    return {
      clienteLocal,
      informacoesPoco,
      desenhoConstrutivo,
      servicosExecutados,
      parecerHidrogeologico,
      checklist,
      recomendacoes,
      fotos,
      assinaturas,
    };
  })();

  const tagPocoPreview = valOuPreencher(relatorio.dadosPoco?.pocoId);
  const profTotalPreview = valOuPreencher(relatorio.dadosPoco?.profundidadeTotal);
  const diamRevPreview = valOuPreencher(relatorio.dadosPoco?.diametroRevestimento);
  const crivoPreview = valOuPreencher(relatorio.dadosPoco?.crivo);
  const nePreview = valOuPreencher(relatorio.dadosPoco?.nivelEstatico);
  const ndPreview = valOuPreencher(relatorio.dadosPoco?.nivelDinamico);
  const vazaoPreview = valOuPreencher(relatorio.dadosPoco?.vazaoTeste);
  const dataExecPreview = formatarDataBR(relatorio.cabecalho.dataExecucao);

  const desenhoConstrutivoTexto = valOuPreencher(
    relatorio.dadosPoco?.desenhoConstrutivo,
    `• Poço Identificado: ${tagPocoPreview} | Profundidade Total: ${profTotalPreview}.\n• Revestimento / Diâmetro: ${diamRevPreview}.\n• Crivo / Posição da Bomba: ${crivoPreview}.`
  );

  const parecerHidrogeologicoTexto = valOuPreencher(
    relatorio.dadosPoco?.parecerHidrogeologico,
    `• Parâmetros aferidos no Poço ${tagPocoPreview} (${dataExecPreview}): NE = ${nePreview} | ND = ${ndPreview} | Vazão = ${vazaoPreview}.\n• Crivo / Posição da Bomba: ${crivoPreview}.`
  );

  const equacoesLivro = construirEquacoesLivroRelatorio(relatorio);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Barra de Controle Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-5 py-3.5 print:hidden">
        <div>
          <h1 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
            Relatório Técnico
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {precisaEscala && (
            <button
              type="button"
              onClick={() => setAjustarATela((prev) => !prev)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Alternar entre ajustar folha A4 à largura da tela ou tamanho real 100%"
            >
              {ajustarATela ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#E8A020]" />
                  <span>Zoom 100% ({Math.round(escalaEfetiva * 100)}%)</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#E8A020]" />
                  <span>Ajustar à Tela</span>
                </>
              )}
            </button>
          )}

          {/* Atalho rápido para ir direto ao Registro Fotográfico no Preview */}
          <button
            type="button"
            onClick={() => {
              if (!isSecaoAtiva('fotos')) {
                alternarSecao('fotos');
              }
              setTimeout(() => {
                document
                  .getElementById('secao-registro-fotografico-preview')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 80);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Rolar até a seção 10. Registro Fotográfico de Evidências"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>Ir para Fotos ({fotosOrdenadas.length})</span>
          </button>

          {/* Botão de Configuração de Seções Ativas */}
          <button
            type="button"
            onClick={() => setModalSecoesAberta(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
            title="Escolha quais seções incluir ou omitir no relatório (ex: omitir Desenho Construtivo para relatórios simplificados)"
          >
            <Settings2 className="w-4 h-4 text-[#E8A020]" />
            <span>Seções do Relatório</span>
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8A020]/20 text-[#1B2A3B] dark:text-[#E8A020]">
              {totalAtivas}/{SECOES_CONFIG_RELATORIO.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir A4</span>
          </button>
          <button
            type="button"
            disabled={exportandoPdf}
            onClick={onExportarPDF}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] disabled:opacity-60 text-[#1B2A3B] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            <span>{exportandoPdf ? 'Gerando PDF...' : 'PDF'}</span>
          </button>
        </div>
      </div>

      {/* Modal de Seleção de Seções Ativas */}
      {modalSecoesAberta && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho do Modal */}
            <div className="p-4 sm:p-5 border-b border-[#DDE3EC] dark:border-slate-800 flex items-center justify-between bg-[#F7F9FC] dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#E8A020]/15 text-[#E8A020]">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                    Personalizar Seções do Relatório
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8A020]/20 text-[#1B2A3B] dark:text-[#E8A020]">
                      {totalAtivas} de {SECOES_CONFIG_RELATORIO.length} ativas
                    </span>
                  </h3>
                  <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                    Selecione quais seções deseja incluir no laudo visual e no PDF exportado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSecoesAberta(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Rápidos */}
            <div className="px-4 sm:px-5 py-3 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-900/60 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#E8A020]" />
                Modelos Rápidos:
              </span>
              <button
                type="button"
                onClick={() => aplicarPreset('completo')}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
              >
                ⭐ Laudo Completo (ABNT)
              </button>
              <button
                type="button"
                onClick={() => aplicarPreset('simplificado')}
                className="px-2.5 py-1 text-xs font-bold rounded-md border border-[#E8A020] bg-[#E8A020]/15 text-[#1B2A3B] dark:text-[#E8A020] hover:bg-[#E8A020]/25 transition-colors shadow-xs"
                title="Desativa a Seção 4 (Desenho Construtivo) e anexos pesados para emissão rápida"
              >
                📄 Simplificado (Sem Desenho Construtivo)
              </button>
              <button
                type="button"
                onClick={() => aplicarPreset('parecer_direto')}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
              >
                ⚡ Parecer Direto
              </button>
            </div>

            {/* Lista de Seções com Checkboxes */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
              {SECOES_CONFIG_RELATORIO.map((secao) => {
                const ativa = isSecaoAtiva(secao.key);
                return (
                  <div
                    key={secao.key}
                    onClick={() => alternarSecao(secao.key)}
                    className={`pt-2.5 first:pt-0 flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      ativa
                        ? 'bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                        : 'opacity-50 hover:opacity-80 bg-transparent'
                    } ${secao.destaque ? 'ring-1 ring-[#E8A020]/40' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={ativa}
                      onChange={() => alternarSecao(secao.key)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 rounded text-[#E8A020] focus:ring-[#E8A020] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100">
                          {secao.numero === 'Anexo' ? 'Anexo I' : `${secao.numero}.`} {secao.titulo}
                        </span>
                        {secao.destaque && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#E8A020]/20 text-[#B87000] dark:text-[#E8A020]">
                            Opcional / Customizável
                          </span>
                        )}
                        {!ativa && (
                          <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400">
                            (Omitido no Relatório)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {secao.descricao}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-[#DDE3EC] dark:border-slate-800 flex items-center justify-between bg-[#F7F9FC] dark:bg-slate-950">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                As alterações atualizam a visualização e o PDF instantaneamente.
              </span>
              <button
                type="button"
                onClick={() => setModalSecoesAberta(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#25394e] text-white transition-colors"
              >
                Concluir & Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
{/* Folhas A4 Físicas Simuladas */}
      <div
        ref={containerRef}
        className={`space-y-6 sm:space-y-8 pb-8 ${
          ajustarATela ? 'overflow-x-hidden' : 'overflow-x-auto'
        }`}
      >
        {/* =====================================================================
            PÁGINA 1: IDENTIFICAÇÃO, DADOS CONTRATUAIS, LOCAL E INFORMAÇÕES DO POÇO (SEÇÕES 1 A 4)
           ===================================================================== */}
        <A4SheetScaled scale={escalaEfetiva}>
          <div className="space-y-3.5">
            <TimbreHeaderPadrao relatorio={relatorio} />

            {/* Moldura Principal do Título */}
            <div className="bg-[#1B2A3B] text-white border-l-[4mm] border-[#E8A020] px-5 py-3 text-center space-y-1">
              <div className="text-[12.5pt] font-extrabold tracking-wide uppercase">
                RELATÓRIO TÉCNICO DE ENTREGA DE SERVIÇOS
              </div>
            </div>

            {/* Quadro 1: Contratante / Interessado (Ao) */}
            <div>
              <div>
               <SectionBar titulo="1. IDENTIFICAÇÃO DO CONTRATANTE / INTERESSADO (AO)"/>
              </div>
              <table className="w-full text-[8pt] border border-[#DDE3EC] border-collapse">
                <tbody>
                  <tr className="bg-white border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt] w-36">
                      Cliente
                    </td>
                    <td className="py-1.5 px-2.5 font-bold" colSpan={3}>
                      {valOuPreencher(relatorio.cabecalho.cliente)}
                    </td>
                  </tr>
                  <tr className="bg-[#F5F7FA] border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      CNPJ / CPF
                    </td>
                    <td className="py-1.5 px-2.5 font-mono">
                      {valOuPreencher(relatorio.cabecalho.clienteCNPJ)}
                    </td>
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt] w-36">
                      Contato
                    </td>
                    <td className="py-1.5 px-2.5">
                      {valOuPreencher(relatorio.cabecalho.contatoLocal)}
                    </td>
                  </tr>
                  <tr className="bg-white border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Local da Prestação
                    </td>
                    <td className="py-1.5 px-2.5" colSpan={3}>
                      {valOuPreencher(relatorio.cabecalho.localizacao)}
                    </td>
                  </tr>
                  <tr className="bg-[#F5F7FA]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Cidade / UF
                    </td>
                    <td className="py-1.5 px-2.5">
                      {valOuPreencher(relatorio.cabecalho.cidadeUF)}
                    </td>
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Telefone
                    </td>
                    <td className="py-1.5 px-2.5 font-mono">
                      {valOuPreencher(relatorio.cabecalho.telefoneContato)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quadro 2: Dados Contratuais, Responsável Técnico e Normas ABNT */}
            <div>
              <div>
                <SectionBar titulo="2. DADOS CONTRATUAIS, RESPONSÁVEL TÉCNICO E NORMAS APLICADAS"/>
              </div>
              <table className="w-full text-[8pt] border border-[#DDE3EC] border-collapse">
                <tbody>
                  <tr className="bg-white border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt] w-24">
                      Ordem de Serviço
                    </td>
                    <td className="py-1.5 px-2.5 font-mono font-bold">
                      {valOuPreencher(relatorio.cabecalho.contratoOS)}
                    </td>
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt] w-20">
                      Contrato
                    </td>
                    <td className="py-1.5 px-2.5 font-mono">
                      {valOuPreencher(relatorio.cabecalho.contratoRef)}
                    </td>
                  </tr>
                  <tr className="bg-[#F5F7FA] border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Data da Execução
                    </td>
                    <td className="py-1.5 px-2.5 font-mono">
                      {formatarDataBR(relatorio.cabecalho.dataExecucao)}
                    </td>
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Status
                    </td>
                    <td className="py-1.5 px-2.5 font-bold text-[#27AE60]">
                      {valOuPreencher(relatorio.cabecalho.statusOS, 'Concluído')}
                    </td>
                  </tr>
                  <tr className="bg-white border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Tipo de Serviço
                    </td>
                    <td className="py-1.5 px-2.5 font-medium" colSpan={3}>
                      {valOuPreencher(relatorio.cabecalho.tipoServico)}
                    </td>
                  </tr>
                  <tr className="bg-[#F5F7FA] border-b border-[#DDE3EC]">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Responsável Técnico
                    </td>
                    <td className="py-1.5 px-2.5 font-bold">{nomeRespTecnico}</td>
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Registro
                    </td>
                    <td className="py-1.5 px-2.5 font-mono">
                      {creaRespFormatado}
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="py-1.5 px-2.5 font-bold uppercase text-[#6B7A8D] text-[7.2pt]">
                      Normas Aplicadas
                    </td>
                    <td className="py-1.5 px-2.5" colSpan={3}>
                      ABNT NBR 12212 (Projeto de poço tubular), ABNT NBR 12244
                      (Construção e ensaio de bombeamento de poço tubular) e ABNT NBR
                      10719 (Relatórios técnicos).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. CLIENTE E LOCAL (MOVIDO PARA A PÁGINA 1) */}
            {isSecaoAtiva('clienteLocal') && (
              <div>
                <SectionBar titulo={`${secNums.clienteLocal}. CLIENTE E LOCAL`} />
                <div className="text-[8.5pt] divide-y divide-slate-100 border border-[#DDE3EC]">
                  {[
                    [
                      'Endereço / Local da Obra',
                      valOuPreencher(relatorio.cabecalho.localizacao),
                      'Cidade / UF',
                      valOuPreencher(relatorio.cabecalho.cidadeUF),
                    ],
                    [
                      'Coordenadas Geográficas',
                      valOuPreencher(coordGeoBruta),
                      'Coordenadas UTM',
                      utmPreviewStr,
                    ],
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-2 px-3 py-1.5 ${
                        idx % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'
                      }`}
                    >
                      <div className="flex justify-between pr-4 gap-2">
                        <span className="font-bold uppercase text-[#6B7A8D] text-[7.5pt] shrink-0">
                          {row[0]}
                        </span>
                        <span className="text-right font-medium">{row[1]}</span>
                      </div>
                      <div className="flex justify-between pl-4 gap-2">
                        <span className="font-bold uppercase text-[#6B7A8D] text-[7.5pt] shrink-0">
                          {row[2]}
                        </span>
                        <span className="text-right font-mono">{row[3]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <PocoLocationMap
                  coordenadasGeograficas={
                    relatorio.dadosPoco?.coordenadasGeograficas ||
                    relatorio.cabecalho?.coordenadasGeograficas
                  }
                  coordenadasUTM={relatorio.dadosPoco?.coordenadasUTM}
                  pocoTag={relatorio.dadosPoco?.pocoId}
                  cliente={relatorio.cabecalho?.cliente}
                  localizacao={relatorio.cabecalho?.localizacao}
                  cidadeUF={relatorio.cabecalho?.cidadeUF}
                  variant="a4"
                />
              </div>
            )}

            {/* 4. INFORMAÇÕES DO POÇO (MOVIDO PARA A PÁGINA 1) */}
            {relatorio.dadosPoco?.incluirNoRelatorio && isSecaoAtiva('informacoesPoco') && (() => {
              const fmtAntesDepoisPreview = (inicial?: string, final?: string): string => {
                const ini = (inicial || '').trim();
                const fim = (final || '').trim();
                const iniValido =
                  ini.length > 0 &&
                  !ini.startsWith('[DADO A PREENCHER') &&
                  ini !== '—' &&
                  ini !== '-';
                const fimValido =
                  fim.length > 0 &&
                  !fim.startsWith('[DADO A PREENCHER') &&
                  fim !== '—' &&
                  fim !== '-';
                if (iniValido && fimValido) {
                  return `Antes: ${ini} | Depois: ${fim}`;
                }
                if (fimValido) return fim;
                if (iniValido) return `Inicial: ${ini}`;
                return valOuPreencher(final || inicial);
              };

              return (
              <div>
                <SectionBar titulo={`${secNums.informacoesPoco}. INFORMAÇÕES DO POÇO`} />
                <div className="text-[8.5pt] divide-y divide-slate-100 border border-[#DDE3EC]">
                  {[
                    [
                      'Poço (TAG)',
                      valOuPreencher(relatorio.dadosPoco.pocoId),
                      'Profundidade Total',
                      valOuPreencher(relatorio.dadosPoco.profundidadeTotal),
                    ],
                    [
                      'Diâmetro / Revestimento',
                      valOuPreencher(relatorio.dadosPoco.diametroRevestimento),
                      'Crivo / Posição da Bomba',
                      fmtAntesDepoisPreview(
                        relatorio.dadosPoco.crivoInicial,
                        relatorio.dadosPoco.crivo
                      ),
                    ],
                    [
                      'Nível Estático (NE)',
                      fmtAntesDepoisPreview(
                        relatorio.dadosPoco.nivelEstaticoInicial,
                        relatorio.dadosPoco.nivelEstatico
                      ),
                      'Nível Dinâmico Estab. (ND)',
                      fmtAntesDepoisPreview(
                        relatorio.dadosPoco.nivelDinamicoInicial,
                        relatorio.dadosPoco.nivelDinamico
                      ),
                    ],
                    [
                      'Vazão de Operação/Teste',
                      fmtAntesDepoisPreview(
                        relatorio.dadosPoco.vazaoInicial,
                        relatorio.dadosPoco.vazaoTeste
                      ),
                      'Tubo Edutor (Coluna)',
                      valOuPreencher(relatorio.dadosPoco.tuboEdutor),
                    ],
                    [
                      'Eletrodo Superior',
                      fmtAntesDepoisPreview(
                        relatorio.dadosPoco.eletrodoSuperiorInicial,
                        relatorio.dadosPoco.eletrodoSuperior
                      ),
                      'Eletrodo Inferior',
                      fmtAntesDepoisPreview(
                        relatorio.dadosPoco.eletrodoInferiorInicial,
                        relatorio.dadosPoco.eletrodoInferior
                      ),
                    ],
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-2 px-3 py-1.5 ${
                        idx % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'
                      }`}
                    >
                      <div className="flex justify-between pr-4 gap-2">
                        <span className="font-bold uppercase text-[#6B7A8D] text-[7.5pt] shrink-0">
                          {row[0]}
                        </span>
                        <span className="font-mono text-right">{row[1]}</span>
                      </div>
                      <div className="flex justify-between pl-4 gap-2">
                        <span className="font-bold uppercase text-[#6B7A8D] text-[7.5pt] shrink-0">
                          {row[2]}
                        </span>
                        <span className="font-mono text-right">{row[3]}</span>
                      </div>
                    </div>
                  ))}

                  <div className="bg-[#F5F7FA] px-3 py-1.5 flex items-center justify-between gap-4">
                    <span className="font-bold uppercase text-[#6B7A8D] text-[7.5pt] shrink-0">
                      CONJUNTO MOTOBOMBA SUBMERSA
                    </span>
                    <span className="text-right font-medium">
                      {valOuPreencher(relatorio.dadosPoco.especificacaoBomba)} — (
                      {valOuPreencher(relatorio.dadosPoco.motobombaEstado, 'Usado').toUpperCase()})
                    </span>
                  </div>
                  <div className="bg-white px-3 py-1.5 flex items-center justify-between gap-4">
                    <span className="font-bold uppercase text-[#6B7A8D] text-[7.5pt] shrink-0">
                      QUADRO / PAINEL ELÉTRICO
                    </span>
                    <span className="text-right font-medium">
                      {valOuPreencher(relatorio.dadosPoco.painelEletrico)} — (
                      {valOuPreencher(relatorio.dadosPoco.painelEstado, 'Usado').toUpperCase()})
                    </span>
                  </div>
                </div>
              </div>
              );
            })()}
          </div>

          <RodapePadrao relatorio={relatorio} />
        </A4SheetScaled>

        {/* =====================================================================
            PÁGINA 2+: CORPO TÉCNICO DETALHADO (A PARTIR DA SEÇÃO 5)
           ===================================================================== */}
        <A4SheetScaled scale={escalaEfetiva} printBreakBefore>
          <div className="space-y-4">
            {/* Timbre Institucional Padrão */}
            <TimbreHeaderPadrao relatorio={relatorio} />

            {/* 5. DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO */}
            {isSecaoAtiva('desenhoConstrutivo') && (
              <div>
                <SectionBar titulo={`${secNums.desenhoConstrutivo}. DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO`} />
                <div className="border border-[#DDE3EC] bg-[#FAFBFD] px-3 py-2 text-[8.2pt] leading-relaxed whitespace-pre-wrap">
                  {desenhoConstrutivoTexto}
                </div>
              </div>
            )}

            {/* QUADRO DE DIMENSIONAMENTO HIDRÁULICO E ELÉTRICO DA MOTOBOMBA (OPCIONAL) */}
            {relatorio.dadosPoco?.dimensionamentoBomba?.ativo && (() => {
              const resDim = calcularDimensionamentoBomba(relatorio.dadosPoco);
              const cfgDim = relatorio.dadosPoco.dimensionamentoBomba!;
              return (
                <div>
                  <SectionBar titulo="DIMENSIONAMENTO HIDRÁULICO E ELÉTRICO DO CONJUNTO MOTOBOMBA (ABNT NBR 12244)" />
                  <div className="text-[8pt] divide-y divide-slate-100 border border-[#DDE3EC]">
                    {[
                      [
                        'Vazão de Projeto (Q)',
                        `${fmtNumeroSEMA(resDim.vazaoProjetoM3h, 2)} m³/h (${fmtNumeroSEMA(resDim.vazaoProjetoLs, 2)} L/s)`,
                        'Altura Geométrica (ND + Desnível Ext.)',
                        `${fmtNumeroSEMA(resDim.alturaGeometricaTotalM, 2)} m (${fmtNumeroSEMA(resDim.nivelDinamicoM, 1)} m + ${fmtNumeroSEMA(resDim.desnivelExternoM, 1)} m)`,
                      ],
                      [
                        'Perda de Carga no Edutor (ΔH int)',
                        `${fmtNumeroSEMA(resDim.perdaCargaEdutorMca, 2)} m.c.a. (${cfgDim.diametroEdutorPol} ${cfgDim.materialEdutor})`,
                        'Perda Adutora + Singularidades',
                        `${fmtNumeroSEMA(resDim.perdaCargaAdutoraMca + resDim.perdaCargaLocalizadaMca, 2)} m.c.a. + Pres ${fmtNumeroSEMA(resDim.pressaoResidualMca, 1)} m.c.a.`,
                      ],
                      [
                        'Altura Manométrica Total (AMT)',
                        `${fmtNumeroSEMA(resDim.amtTotalMca, 2)} m.c.a.`,
                        'Potência Hidráulica / Motor Recomendado',
                        `Phid = ${fmtNumeroSEMA(resDim.potenciaHidraulicaCV, 2)} CV → Motor: ${fmtNumeroSEMA(resDim.potenciaMotorRecomendadaCV, 1).replace(',0', '')} CV (${fmtNumeroSEMA(resDim.potenciaMotorRecomendadaKW, 2)} kW)`,
                      ],
                      [
                        'Velocidade no Edutor',
                        `v = ${fmtNumeroSEMA(resDim.velocidadeEdutorMs, 2)} m/s`,
                        'Alimentação / Cabo PP Submersível',
                        `${cfgDim.tensaoAlimentacao} (I ≈ ${fmtNumeroSEMA(resDim.correnteEstimadaA, 1)} A) | Cabo 3x${fmtNumeroSEMA(resDim.bitolaCaboRecomendadaMm2, 1).replace(',0', '')} mm² (ΔV = ${fmtNumeroSEMA(resDim.quedaTensaoCalculadaPercent, 2)}%)`,
                      ],
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className={`grid grid-cols-2 px-3 py-1.5 ${
                          idx % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between pr-4 gap-2">
                          <span className="font-bold uppercase text-[#6B7A8D] text-[7.2pt] shrink-0">
                            {row[0]}
                          </span>
                          <span className="font-mono text-right font-semibold">
                            {row[1]}
                          </span>
                        </div>
                        <div className="flex justify-between pl-4 gap-2">
                          <span className="font-bold uppercase text-[#6B7A8D] text-[7.2pt] shrink-0">
                            {row[2]}
                          </span>
                          <span className="font-mono text-right font-semibold">
                            {row[3]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 6. SERVIÇOS TÉCNICOS EXECUTADOS */}
            {isSecaoAtiva('servicosExecutados') && (
              <div>
                <SectionBar titulo={`${secNums.servicosExecutados}. SERVIÇOS TÉCNICOS EXECUTADOS`} />
                <div className="mb-2.5">
                  <span className="block text-[7.5pt] font-bold uppercase text-[#6B7A8D] mb-1">
                    {secNums.servicosExecutados}.1 Memorial Descritivo das Etapas Executadas (ABNT NBR 12212 / NBR 12244)
                  </span>
                  <p className="text-[8.2pt] leading-relaxed whitespace-pre-wrap border border-[#DDE3EC] bg-white p-2.5">
                    {valOuPreencher(relatorio.descricaoServico)}
                  </p>
                </div>

                {servicosValidos.length > 0 && (
                  <div className="mb-2.5">
                    <span className="block text-[7.5pt] font-bold uppercase text-[#6B7A8D] mb-1">
                      {secNums.servicosExecutados}.2 Quadro Quantitativo de Serviços Conduzidos
                    </span>
                    <table className="w-full text-[8pt] border-collapse border border-[#DDE3EC]">
                      <thead>
                        <tr className="bg-[#1B2A3B] text-white text-[7.5pt]">
                          <th className="py-1 px-2 text-left w-8">#</th>
                          <th className="py-1 px-2 text-left">
                            Descrição dos Serviços Conduzidos
                          </th>
                          <th className="py-1 px-2 text-center w-16">Unidade</th>
                          <th className="py-1 px-2 text-center w-14">Qtd</th>
                          <th className="py-1 px-2 text-center w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicosValidos.map((s, i) => (
                          <tr
                            key={s.id}
                            className={i % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'}
                          >
                            <td className="py-1 px-2 font-mono">{i + 1}</td>
                            <td className="py-1 px-2">{valOuPreencher(s.descricao)}</td>
                            <td className="py-1 px-2 text-center font-mono text-[7.5pt]">
                              {valOuPreencher(s.unidade, 'UN')}
                            </td>
                            <td className="py-1 px-2 text-center font-mono">
                              {valOuPreencher(s.quantidade, '1')}
                            </td>
                            <td className="py-1 px-2 text-center font-semibold text-[#27AE60]">
                              {valOuPreencher(s.status, 'Executado')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(equipeValida.length > 0 || materiaisValidos.length > 0) && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {equipeValida.length > 0 && (
                      <div>
                        <span className="block text-[7.5pt] font-bold uppercase text-[#6B7A8D] mb-1">
                          {secNums.servicosExecutados}.3 Equipe Técnica Mobilizada
                        </span>
                        <table className="w-full text-[8pt] border-collapse border border-[#DDE3EC]">
                          <thead>
                            <tr className="bg-[#1B2A3B] text-white text-[7.5pt]">
                              <th className="py-1 px-2 text-left w-8">#</th>
                              <th className="py-1 px-2 text-left">
                                Profissional / Especialista
                              </th>
                              <th className="py-1 px-2 text-left">
                                Função / Atribuição em Campo
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {equipeValida.map((m, i) => (
                              <tr
                                key={m.id}
                                className={i % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'}
                              >
                                <td className="py-1 px-2 font-mono">{i + 1}</td>
                                <td
                                  className={`py-1 px-2 ${
                                    i === 0 ? 'font-bold' : 'font-normal'
                                  }`}
                                >
                                  {valOuPreencher(m.nome)}
                                </td>
                                <td className="py-1 px-2">{valOuPreencher(m.funcao)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {materiaisValidos.length > 0 && (
                      <div>
                        <span className="block text-[7.5pt] font-bold uppercase text-[#6B7A8D] mb-1">
                          {secNums.servicosExecutados}.4 Materiais e Insumos Aplicados no Poço
                        </span>
                        <table className="w-full text-[8pt] border-collapse border border-[#DDE3EC]">
                          <thead>
                            <tr className="bg-[#1B2A3B] text-white text-[7.5pt]">
                              <th className="py-1 px-2 text-left w-8">#</th>
                              <th className="py-1 px-2 text-left">
                                Descrição Técnica do Material
                              </th>
                              <th className="py-1 px-2 text-left w-24">Unidade</th>
                              <th className="py-1 px-2 text-left w-20">Qtd</th>
                              <th className="py-1 px-2 text-left w-24">Situação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materiaisValidos.map((m, i) => (
                              <tr
                                key={m.id}
                                className={i % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'}
                              >
                                <td className="py-1 px-2 font-mono">{i + 1}</td>
                                <td className="py-1 px-2">
                                  {valOuPreencher(m.descricao)}
                                </td>
                                <td className="py-1 px-2">
                                  {valOuPreencher(m.unidade, 'Unidade')}
                                </td>
                                <td className="py-1 px-2 font-mono">
                                  {valOuPreencher(m.quantidade, '1')}
                                </td>
                                <td className="py-1 px-2 font-semibold text-[#1B2A3B]">
                                  {valOuPreencher(m.situacao, 'Aplicado')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 7. PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA DE OPERAÇÃO */}
            {isSecaoAtiva('parecerHidrogeologico') && (
              <div>
                <SectionBar titulo={`${secNums.parecerHidrogeologico}. PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA DE OPERAÇÃO`} />
                <div className="border border-[#DDE3EC] bg-[#FAFBFD] px-3 py-2 text-[8.2pt] leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                  {parecerHidrogeologicoTexto}
                </div>

                {/* Fórmulas Hidrogeológicas em Notação de Livro (Display Math ABNT NBR 14724) */}
                {relatorio.dadosPoco?.testeVazaoSEMA?.ativo && (
                  <div className="mt-2.5 space-y-2">
                    <div className="text-[7.5pt] font-bold uppercase tracking-wide text-[#1B2A3B] px-1">
                      Formulação Matemática Hidrogeológica (Notação Editorial ABNT NBR 14724 / NBR 12244):
                    </div>
                    {equacoesLivro.secao6.map((eq) => (
                      <MathFormulaBlock key={eq.id} spec={eq} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <RodapePadrao relatorio={relatorio} />
        </A4SheetScaled>

        {/* =====================================================================
            PÁGINA 3: CHECKLIST, RECOMENDAÇÕES, REGISTRO FOTOGRÁFICO (1:1) E ASSINATURAS
           ===================================================================== */}
        {(isSecaoAtiva('checklist') ||
          isSecaoAtiva('recomendacoes') ||
          isSecaoAtiva('fotos') ||
          isSecaoAtiva('assinaturas')) && (
          <A4SheetScaled scale={escalaEfetiva} printBreakBefore>
            <div className="space-y-4">
              {/* Timbre Institucional Padrão */}
              <TimbreHeaderPadrao relatorio={relatorio} />

              {/* 8. CHECKLIST DE CONFORMIDADE E SEGURANÇA */}
              {isSecaoAtiva('checklist') && relatorio.checklist && relatorio.checklist.length > 0 && (
                <div>
                  <SectionBar titulo={`${secNums.checklist}. CHECKLIST DE CONFORMIDADE E SEGURANÇA`} />
                  <table className="w-full text-[8pt] border-collapse border border-[#DDE3EC]">
                    <thead>
                      <tr className="bg-[#1B2A3B] text-white text-[7.5pt]">
                        <th className="py-1 px-2 text-left">Item de Verificação Normativa</th>
                        <th className="py-1 px-2 text-center w-24">Data</th>
                        <th className="py-1 px-2 text-left">Observação Técnica</th>
                        <th className="py-1 px-2 text-center w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.checklist.map((chk, idx) => (
                        <tr
                          key={chk.id}
                          className={idx % 2 === 0 ? 'bg-[#F2FAF4]' : 'bg-white'}
                        >
                          <td className="py-1 px-2 font-medium">
                            <span className="text-[#27AE60] font-bold mr-1.5">✓</span>
                            {valOuPreencher(chk.texto)}
                          </td>
                          <td className="py-1 px-2 text-center font-mono text-[7.5pt]">
                            {valOuPreencher(
                              chk.dataVerificacao,
                              formatarDataBR(relatorio.cabecalho.dataExecucao)
                            )}
                          </td>
                          <td className="py-1 px-2 text-[7.5pt] text-slate-600">
                            {valOuPreencher(
                              chk.observacao,
                              'Verificado e aprovado sem ressalvas em campo.'
                            )}
                          </td>
                          <td className="py-1 px-2 text-center font-bold text-[7.5pt] text-[#27AE60]">
                            CONFORME
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 9. RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO */}
              {isSecaoAtiva('recomendacoes') && (
                <div>
                  <SectionBar titulo={`${secNums.recomendacoes}. RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO`} />
                  <div className="space-y-2 text-[8.2pt] border border-[#DDE3EC] bg-white p-3">
                    <div>
                      <span className="block text-[7.5pt] font-bold uppercase text-[#6B7A8D]">
                        {secNums.recomendacoes}.1 Diretrizes de Operação e Manutenção Preventiva
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {valOuPreencher(
                          oc?.recomendacoes,
                          `1. Operar o poço ${tagPocoPreview} dentro da vazão recomendada (${vazaoPreview}).\n2. Realizar monitoramento mensal de Nível Estático (NE: ${nePreview}), Nível Dinâmico (ND: ${ndPreview}), vazão (hidrômetro) e consumo elétrico.\n3. Efetuar análises físico-químicas e bacteriológicas semestrais (Portaria GM/MS nº 888/2021).`
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="block text-[7.5pt] font-bold uppercase text-[#6B7A8D]">
                        {secNums.recomendacoes}.2 Observações Técnicas e Registros de Campo
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {valOuPreencher(
                          oc?.observacoesGerais,
                          `Parâmetros registrados em ${dataExecPreview} para o poço ${tagPocoPreview}: NE = ${nePreview}, ND = ${ndPreview}, Vazão = ${vazaoPreview}.`
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 10. REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS */}
              {isSecaoAtiva('fotos') && (
                <div id="secao-registro-fotografico-preview">
                  <SectionBar titulo={`${secNums.fotos}. REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS`} />
                <div className="photo-evidence-grid grid grid-cols-2 print:grid-cols-2 gap-4 pt-1">
                  {(fotosOrdenadas.length > 0
                    ? fotosOrdenadas
                    : [
                        {
                          id: 'placeholder-foto-1',
                          urlBase64: '',
                          legenda: `[FOTO REAL OBRIGATÓRIA: Evidência #1 — Conj. Motobomba / Cavalete, data ${dataExecPreview}, Poço ${tagPocoPreview}]`,
                          timestamp: 0,
                          ordem: 1,
                        },
                        {
                          id: 'placeholder-foto-2',
                          urlBase64: '',
                          legenda: `[FOTO REAL OBRIGATÓRIA: Evidência #2 — Quadro de Comando / Medição em Campo, data ${dataExecPreview}, Poço ${tagPocoPreview}]`,
                          timestamp: 0,
                          ordem: 2,
                        },
                      ]
                  ).map((foto, index) => {
                    const temImagemReal = Boolean(
                      foto.urlBase64 && foto.urlBase64.trim().startsWith('data:image')
                    );
                    const textoLegenda = valOuPreencher(
                      foto.legenda,
                      `[FOTO REAL OBRIGATÓRIA: Evidência #${index + 1} em campo, data ${dataExecPreview}, Poço ${tagPocoPreview}]`
                    );
                    return (
                      <div
                        key={foto.id}
                        className="photo-evidence-card w-full flex flex-col break-inside-avoid border border-gray-300 bg-white p-2 rounded-xs"
                      >
                        <div className="photo-evidence-square relative w-full aspect-square overflow-hidden bg-slate-100 border border-gray-200">
                          {temImagemReal ? (
                            <img
                              src={foto.urlBase64}
                              alt={textoLegenda}
                              className="w-full h-full object-cover block"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#FFFBEB] border border-dashed border-[#E8A020] p-3 flex flex-col items-center justify-center text-center gap-1.5">
                              <ImageIcon className="w-5 h-5 text-[#E8A020]" />
                              <span className="text-[7.5pt] font-mono font-bold text-[#1B2A3B] uppercase">
                                ESPAÇO RESERVADO PARA FOTOGRAFIA REAL DE CAMPO (1:1)
                              </span>
                              <span className="text-[7.5pt] font-mono text-slate-700 leading-snug">
                                {textoLegenda}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 px-1 text-[8pt] leading-snug text-[#1B2A3B] font-medium break-words">
                          <span className="font-bold text-slate-700">
                            Foto {String(index + 1).padStart(2, '0')}:
                          </span>{' '}
                          {textoLegenda}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ASSINATURAS (numeração dinâmica: 10 sem fotos, 11 com fotos) */}
            {isSecaoAtiva('assinaturas') && (
              <div>
                <SectionBar titulo={`${secNums.assinaturas}. ASSINATURAS`} />
                <div className="border border-[#DDE3EC] bg-[#FAFBFD] p-4 text-[8.5pt] break-inside-avoid">
                  <p className="text-[8pt] text-slate-600 mb-6 text-center">
                    Declaramos que os serviços referentes à{' '}
                    <strong>{valOuPreencher(relatorio.cabecalho.contratoOS)}</strong> no{' '}
                    <strong>Poço {tagPocoPreview}</strong>{' '}
                    foram integralmente executados, comissionados e documentados em conformidade com as
                    normas técnicas <strong>ABNT NBR 12212 e ABNT NBR 12244</strong>.
                  </p>
                  <div className="grid grid-cols-2 gap-10 pt-4">
                    <div className="text-center pt-2 flex flex-col items-center">
                      {relatorio.assinaturaResponsavel?.dataUrl && (
                        <img
                          src={relatorio.assinaturaResponsavel.dataUrl}
                          alt="Assinatura Responsável Técnico"
                          className="h-10 object-contain mb-1"
                        />
                      )}
                      <div className="w-full border-t border-[#1B2A3B] pt-2">
                        <div className="font-bold text-[#1B2A3B]">
                          {respTecnicoFormatado}
                        </div>
                        <div className="text-[7.5pt] text-slate-600 mt-0.5">
                          Responsável Técnico — Engenheiro Geólogo / Hidrogeólogo
                        </div>
                        <div className="text-[7pt] text-slate-500 font-mono">
                          {valOuPreencher(
                            relatorio.cabecalho.razaoSocial,
                            'HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA.'
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-center pt-2 flex flex-col items-center">
                      {relatorio.assinaturaCliente?.dataUrl && (
                        <img
                          src={relatorio.assinaturaCliente.dataUrl}
                          alt="Assinatura Responsável Elaboração"
                          className="h-10 object-contain mb-1"
                        />
                      )}
                      <div className="w-full border-t border-[#1B2A3B] pt-2">
                        <div className="font-bold text-[#1B2A3B]">
                          {nomeRespElaboracao}
                        </div>
                        <div className="text-[7.5pt] text-slate-600 mt-0.5">
                          {cargoRespElaboracao}
                        </div>
                        <div className="text-[7pt] text-slate-500 font-mono">
                          {valOuPreencher(
                            relatorio.cabecalho.razaoSocial,
                            'HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA.'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé Padrão do Documento */}
          <RodapePadrao relatorio={relatorio} />
        </A4SheetScaled>
        )}

        {/* =====================================================================
            ANEXO I — RELATÓRIO ESPECIALIZADO DE TESTE DE BOMBEAMENTO (DEPOIS DE TODO O RELATÓRIO PRINCIPAL)
           ===================================================================== */}
        {isSecaoAtiva('anexos') && relatorio.dadosPoco?.testeVazaoSEMA?.ativo !== false &&
          (() => {
            const testeSEMA = relatorio.dadosPoco?.testeVazaoSEMA || {
              ativo: true,
              tipoEnsaio: 'Contínuo 24h a Vazão Constante',
              etapaLabel: '24H',
              referenciaMedidasM: '0,00',
              responsavelTecnicoNome: nomeRespTecnico,
              responsavelTecnicoCREA: creaRespTecnico,
              responsavelTecnicoCPF: '',
              artNumero: '[DADO A PREENCHER EM CAMPO]',
              dataInicioEnsaio: relatorio.cabecalho.dataExecucao || '2026-03-13',
              horaInicioBombeamento: '11:30:00',
              dataFinalBombeamento: relatorio.cabecalho.dataExecucao || '2026-03-13',
              horaFinalBombeamento: '18:10:00',
              dataInicioRecuperacao: relatorio.cabecalho.dataExecucao || '2026-03-13',
              horaInicioRecuperacao: '18:10:00',
              dataFinalRecuperacao: relatorio.cabecalho.dataExecucao || '2026-03-13',
              horaFinalRecuperacao: '18:45:00',
              tempoRecuperacaoMinutos: '',
              nivelRecuperacaoFinalM: '',
              vazaoOutorgaRecomendadaM3h: '',
              regimeBombeamentoHorasDia: '16',
              etapas: relatorio.dadosPoco?.testeVazaoSEMA?.etapas || [],
            };
            const calcSEMA = calcularParametrosStepDrawdownSEMA(
              relatorio.dadosPoco?.nivelEstatico || '0,00 m',
              testeSEMA
            );

            // Gráfico Semi-Logarítmico CORRETO: t (min) no Eixo Horizontal Logarítmico (X) e s (m) no Eixo Vertical Linear (Y)
            const renderGraficoSemiLogAnexoSVG = (
              tituloEixoY: string,
              labelEixoX: string,
              pontos: { s: number; t: number }[],
              tMaxPiso: number
            ) => {
              const validos = pontos.filter((p) => p.s >= 0 && p.t >= 1);
              const { min: minS, max: maxS, ticks: ticksS } =
                calcularDominioRebaixamentoGrafico(
                  validos.map((p) => p.s),
                  45,
                  false
                );
              const { tMax: tMaxLog, ticks: decadasPrincipais } =
                calcularEscalaTempoLogGrafico(
                  validos.map((p) => p.t),
                  tMaxPiso
                );
              const spanS = Math.max(1, maxS - minS);
              const logMax = Math.log10(tMaxLog);

              const W_SVG = 560;
              const H_SVG = 275;
              const PAD_L = 48;
              const PAD_R = 16;
              const PAD_T = 16;
              const PAD_B = 34;
              const PW = W_SVG - PAD_L - PAD_R;
              const PH = H_SVG - PAD_T - PAD_B;

              const toX = (tVal: number) => {
                const tc = Math.min(tMaxLog, Math.max(1, tVal));
                return PAD_L + (Math.log10(tc) / logMax) * PW;
              };
              const toY = (sVal: number) =>
                PAD_T + PH - ((sVal - minS) / spanS) * PH;

              const pathD = validos
                .map(
                  (pt, i) =>
                    `${i === 0 ? 'M' : 'L'} ${toX(pt.t).toFixed(1)} ${toY(
                      pt.s
                    ).toFixed(1)}`
                )
                .join(' ');

              return (
                <svg
                  viewBox={`0 0 ${W_SVG} ${H_SVG}`}
                  className="w-full h-auto border border-slate-300 bg-white"
                >
                  <rect
                    x={PAD_L}
                    y={PAD_T}
                    width={PW}
                    height={PH}
                    fill="#EBF6F9"
                    stroke="#1B2A3B"
                    strokeWidth="1"
                  />
                  {/* Grade Horizontal Linear: Rebaixamento s (m) */}
                  {ticksS.map((sv) => {
                    const y = toY(sv);
                    return (
                      <g key={sv}>
                        <line
                          x1={PAD_L}
                          y1={y}
                          x2={PAD_L + PW}
                          y2={y}
                          stroke="#B8D8E3"
                          strokeWidth="0.6"
                        />
                        <text
                          x={PAD_L - 6}
                          y={y + 3}
                          fontSize="8"
                          textAnchor="end"
                          fill="#1B2A3B"
                        >
                          {sv}
                        </text>
                      </g>
                    );
                  })}
                  {/* Grade Vertical Logarítmica: Tempo t (min) */}
                  {decadasPrincipais.map((td) => {
                    const x = toX(td);
                    const isMajor = td === 1 || td === 10 || td === 100 || td === 1000;
                    return (
                      <g key={td}>
                        <line
                          x1={x}
                          y1={PAD_T}
                          x2={x}
                          y2={PAD_T + PH}
                          stroke={isMajor ? '#6A9FB2' : '#B8D8E3'}
                          strokeWidth={isMajor ? '0.9' : '0.5'}
                        />
                        <text
                          x={x}
                          y={PAD_T + PH + 12}
                          fontSize="8"
                          fontWeight={isMajor ? 'bold' : 'normal'}
                          textAnchor="middle"
                          fill="#1B2A3B"
                        >
                          {td}
                        </text>
                      </g>
                    );
                  })}
                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#0022CC"
                      strokeWidth="2"
                    />
                  )}
                  {validos.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={toX(pt.t)}
                      cy={toY(pt.s)}
                      r="2.6"
                      fill="#0022CC"
                    />
                  ))}
                  <text
                    x={PAD_L + PW / 2}
                    y={H_SVG - 6}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill="#1B2A3B"
                  >
                    {labelEixoX} — Escala Logarítmica (min)
                  </text>
                  <text
                    x={14}
                    y={PAD_T + PH / 2}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill="#1B2A3B"
                    transform={`rotate(-90, 14, ${PAD_T + PH / 2})`}
                  >
                    {tituloEixoY}
                  </text>
                </svg>
              );
            };

            const leiturasBomb = calcSEMA.leiturasBombeamentoCalc;
            const metadeBomb = Math.ceil(leiturasBomb.length / 2);
            const colEsqBomb = leiturasBomb.slice(0, metadeBomb);
            const colDirBomb = leiturasBomb.slice(metadeBomb);

            return (
              <div className="space-y-6 sm:space-y-8 mt-6 sm:mt-8">
                {/* =========================================================
                    PÁGINA 1 DO ANEXO: PLANILHA DE TESTE EM VAZÃO CONSTANTE + GRÁFICO SEMI-LOG CORRETO
                   ========================================================= */}
                <A4SheetScaled scale={escalaEfetiva} printBreakBefore>
                  <div className="space-y-2.5">
                    <TimbreHeaderPadrao relatorio={relatorio} />
                    <SectionBar
                      titulo={`ANEXO I.1 — PLANILHA DE TESTE EM VAZÃO CONSTANTE (${valOuPreencher(
                        testeSEMA.etapaLabel,
                        '24H'
                      )}) E GRÁFICO SEMI-LOG CORRETO`}
                    />
                    <div className="text-[7pt] font-mono bg-[#F5F7FA] border border-[#DDE3EC] px-2.5 py-1.5 flex flex-wrap justify-between gap-2">
                      <span>
                        <strong>Cliente:</strong>{' '}
                        {valOuPreencher(relatorio.cabecalho.cliente)} |{' '}
                        <strong>O.S.:</strong>{' '}
                        {valOuPreencher(relatorio.cabecalho.contratoOS)}
                      </span>
                      <span>
                        <strong>Poço:</strong>{' '}
                        {tagPocoPreview} |{' '}
                        <strong>N.E.:</strong>{' '}
                        {nePreview} |{' '}
                        <strong>Crivo:</strong>{' '}
                        {crivoPreview}
                      </span>
                      <span>
                        <strong>Data:</strong>{' '}
                        {formatarDataBR(
                          testeSEMA.dataInicioEnsaio ||
                            relatorio.cabecalho.dataExecucao
                        )}{' '}
                        ({valOuPreencher(testeSEMA.horaInicioBombeamento, '11:30:00')} às{' '}
                        {valOuPreencher(testeSEMA.horaFinalBombeamento, '18:10:00')}) |{' '}
                        <strong>{respTecnicoFormatado}</strong>
                      </span>
                    </div>

                    {/* Planilha de Bombeamento em 2 colunas com t(min), log10(t), ND, Q, s */}
                    <div className="grid grid-cols-2 gap-2">
                      {[colEsqBomb, colDirBomb].map((colData, colIdx) => (
                        <table
                          key={colIdx}
                          className="w-full text-[6.3pt] font-mono border border-[#DDE3EC] border-collapse"
                        >
                          <thead>
                            <tr className="bg-[#1B2A3B] text-white uppercase">
                              <th className="py-0.5 px-1 text-left">Hora</th>
                              <th className="py-0.5 px-1 text-center">t(min)</th>
                              <th className="py-0.5 px-1 text-right">log t</th>
                              <th className="py-0.5 px-1 text-right">ND(m)</th>
                              <th className="py-0.5 px-1 text-right">Q(m³/h)</th>
                              <th className="py-0.5 px-1 text-right">s(m)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {colData.map((l, idx) => (
                              <tr
                                key={l.id}
                                className={
                                  idx % 2 === 0 ? 'bg-white' : 'bg-[#F7F9FC]'
                                }
                              >
                                <td className="py-0.5 px-1">
                                  {l.horaFormatada}
                                </td>
                                <td className="py-0.5 px-1 text-center font-bold">
                                  {l.tFormatado}
                                </td>
                                <td className="py-0.5 px-1 text-right text-slate-600">
                                  {Math.log10(Math.max(1, l.tMin))
                                    .toFixed(2)
                                    .replace('.', ',')}
                                </td>
                                <td className="py-0.5 px-1 text-right">
                                  {fmtNumeroSEMA(l.nd, 2)}
                                </td>
                                <td className="py-0.5 px-1 text-right">
                                  {fmtNumeroSEMA(l.vazao, 2)}
                                </td>
                                <td className="py-0.5 px-1 text-right font-bold text-[#002299]">
                                  {fmtNumeroSEMA(l.sMed, 2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ))}
                    </div>

                    {/* Gráfico Semi-Logarítmico de Teste de Vazão na mesma página (t no eixo log X) */}
                    <div>
                      <div className="text-[7.5pt] font-bold uppercase text-[#1B2A3B] mb-1 flex items-center justify-between">
                        <span>
                          GRÁFICO SEMI-LOGARÍTMICO DO TESTE DE VAZÃO (COOPER-JACOB) — s (m) × log t (min)
                        </span>
                        <span className="font-mono text-[6.8pt] text-[#6B7A8D]">
                          Eixo Horizontal Logarítmico: t (min) | Eixo Vertical Linear: Rebaixamento s (m)
                        </span>
                      </div>
                      {renderGraficoSemiLogAnexoSVG(
                        'Rebaixamento s (m)',
                        'Tempo de Bombeamento t (min)',
                        calcSEMA.leiturasBombeamentoCalc
                          .filter((l) => l.sMed !== null)
                          .map((l) => ({ s: l.sMed as number, t: l.tMin })),
                        400
                      )}
                    </div>
                  </div>

                  <RodapePadrao relatorio={relatorio} />
                </A4SheetScaled>

                {/* =========================================================
                    PÁGINA 2 DO ANEXO: PLANILHA DE RECUPERAÇÃO + GRÁFICO SEMI-LOG CORRETO
                   ========================================================= */}
                <A4SheetScaled scale={escalaEfetiva} printBreakBefore>
                  <div className="space-y-3">
                    <TimbreHeaderPadrao relatorio={relatorio} />
                    <SectionBar titulo="ANEXO I.2 — PLANILHA DE RECUPERAÇÃO (t, t', t/t', s') E GRÁFICO SEMI-LOG CORRETO" />
                    <div className="text-[7pt] font-mono bg-[#F5F7FA] border border-[#DDE3EC] px-2.5 py-1.5 flex flex-wrap justify-between gap-2">
                      <span>
                        <strong>Poço:</strong>{' '}
                        {tagPocoPreview} |{' '}
                        <strong>N.E.:</strong>{' '}
                        {fmtNumeroSEMA(calcSEMA.neInicial, 2, ' m')} |{' '}
                        <strong>ND máx.:</strong>{' '}
                        {fmtNumeroSEMA(calcSEMA.ndEstabilizadoFinalM, 2, ' m')} (s máx ={' '}
                        {fmtNumeroSEMA(calcSEMA.rebaixamentoMaximoM, 2, ' m')})
                      </span>
                      <span>
                        <strong>Período Recup.:</strong>{' '}
                        {formatarDataBR(
                          testeSEMA.dataInicioRecuperacao ||
                            testeSEMA.dataInicioEnsaio ||
                            relatorio.cabecalho.dataExecucao
                        )}{' '}
                        ({valOuPreencher(testeSEMA.horaInicioRecuperacao, '18:10:00')} às{' '}
                        {valOuPreencher(testeSEMA.horaFinalRecuperacao, '18:45:00')}) |{' '}
                        <strong className="text-[#27AE60]">
                          Recuperação Real ({testeSEMA.tempoRecuperacaoMinutos || '35'} min):{' '}
                          {fmtNumeroSEMA(calcSEMA.percentualRecuperacao, 1, '%')}
                        </strong>
                      </span>
                    </div>

                    {/* Planilha de Recuperação */}
                    <table className="w-full text-[7pt] font-mono border border-[#DDE3EC] border-collapse">
                      <thead>
                        <tr className="bg-[#1B2A3B] text-white uppercase">
                          <th className="py-1 px-2 text-left">Hora</th>
                          <th className="py-1 px-2 text-center">t total (min)</th>
                          <th className="py-1 px-2 text-center">t&apos; recup. (min)</th>
                          <th className="py-1 px-2 text-right">Relação t/t&apos;</th>
                          <th className="py-1 px-2 text-right">N.A. Recup. (m)</th>
                          <th className="py-1 px-2 text-right">s&apos; residual (m)</th>
                          <th className="py-1 px-2 text-right">s&apos; calc. Theis (m)</th>
                          <th className="py-1 px-2 text-left">Observações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {calcSEMA.leiturasRecuperacaoCalc.map((r, idx) => (
                          <tr
                            key={r.id}
                            className={
                              idx % 2 === 0 ? 'bg-white' : 'bg-[#F7F9FC]'
                            }
                          >
                            <td className="py-0.5 px-2">{r.horaFormatada}</td>
                            <td className="py-0.5 px-2 text-center">
                              {r.tTotalMin}
                            </td>
                            <td className="py-0.5 px-2 text-center font-bold">
                              {r.tFormatado}
                            </td>
                            <td className="py-0.5 px-2 text-right font-semibold">
                              {r.relacaoTT}
                            </td>
                            <td className="py-0.5 px-2 text-right">
                              {fmtNumeroSEMA(r.nd, 2)}
                            </td>
                            <td className="py-0.5 px-2 text-right font-bold text-[#002299]">
                              {fmtNumeroSEMA(r.sMed, 2)}
                            </td>
                            <td className="py-0.5 px-2 text-right text-slate-600">
                              {valOuPreencher(r.sCalc)}
                            </td>
                            <td className="py-0.5 px-2 font-sans">
                              {valOuPreencher(r.observacoes, 'Leitura normal')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="space-y-1.5">
                      <div className="text-[7.3pt] bg-[#F2FAF4] border border-[#27AE60]/40 px-2.5 py-1.5 text-[#1B2A3B]">
                        <strong>Memória do Cálculo da Recuperação Real ({testeSEMA.tempoRecuperacaoMinutos || '35'} min):</strong>{' '}
                        Rebaixamento máximo no bombeamento <span className="font-mono">s = {fmtNumeroSEMA(calcSEMA.rebaixamentoMaximoM, 2)} m</span> | Percentual recuperado:{' '}
                        <span className="font-mono">{fmtNumeroSEMA(calcSEMA.percentualRecuperacao, 1, '%')}</span>.
                      </div>
                      {equacoesLivro.anexoI2.map((eq) => (
                        <MathFormulaBlock key={eq.id} spec={eq} compact />
                      ))}
                    </div>

                    {/* Gráfico Semi-Logarítmico de Recuperação na mesma página (t' no eixo log X) */}
                    <div>
                      <div className="text-[7.5pt] font-bold uppercase text-[#1B2A3B] mb-1 flex items-center justify-between">
                        <span>
                          GRÁFICO SEMI-LOGARÍTMICO DE RECUPERAÇÃO RESIDUAL — s&apos; (m) × log t&apos; (min)
                        </span>
                        <span className="font-mono text-[6.8pt] text-[#6B7A8D]">
                          Eixo Horizontal Logarítmico: t&apos; (min) | Eixo Vertical Linear: Rebaixamento Residual s&apos; (m)
                        </span>
                      </div>
                      {renderGraficoSemiLogAnexoSVG(
                        "Rebaixamento Residual s' (m)",
                        "Tempo após Parada t' (min)",
                        calcSEMA.leiturasRecuperacaoCalc
                          .filter((r) => r.sMed !== null)
                          .map((r) => ({ s: r.sMed as number, t: r.tMin })),
                        50
                      )}
                    </div>
                  </div>

                  <RodapePadrao relatorio={relatorio} />
                </A4SheetScaled>

                {/* =========================================================
                    PÁGINA 3 DO ANEXO: INTERPRETAÇÃO DO TESTE DE BOMBEAMENTO (s = B*Q + C*Q²) — SEM GRÁFICOS SEM ESCALA
                   ========================================================= */}
                <A4SheetScaled scale={escalaEfetiva} printBreakBefore>
                  <div className="space-y-4">
                    <TimbreHeaderPadrao relatorio={relatorio} />
                    <SectionBar titulo="ANEXO I.3 — INTERPRETAÇÃO DO TESTE ESCALONADO E PARÂMETROS HIDRODINÂMICOS" />

                    <div className="text-[8pt] text-slate-700 leading-relaxed">
                      Interpretação analítica pelo método de <strong>Jacob-Rorabaugh (<span className="font-mono">s = B·Q + C·Q²</span>)</strong> com{' '}
                      <strong>3 vazões escalonadas crescentes</strong> e determinação da Transmissividade Hidráulica (<span className="font-mono">T</span>) pelo método de{' '}
                      <strong>Cooper-Jacob</strong> (ABNT NBR 12244).
                    </div>

                    <table className="w-full text-[8pt] font-mono border border-[#DDE3EC] border-collapse">
                      <thead>
                        <tr className="bg-[#1B2A3B] text-white uppercase">
                          <th className="py-1.5 px-2 text-center">Etapa</th>
                          <th className="py-1.5 px-2 text-center">Duração</th>
                          <th className="py-1.5 px-2 text-right">Q (m³/h)</th>
                          <th className="py-1.5 px-2 text-right">N.E. (m)</th>
                          <th className="py-1.5 px-2 text-right">N.D. (m)</th>
                          <th className="py-1.5 px-2 text-right">s med (m)</th>
                          <th className="py-1.5 px-2 text-right">s/Q (m/m³/h)</th>
                          <th className="py-1.5 px-2 text-right">Q/s (m³/h/m)</th>
                          <th className="py-1.5 px-2 text-right">s calc. (m)</th>
                          <th className="py-1.5 px-2 text-right">
                            Eficiência (η)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {calcSEMA.etapasCalculadas.map((et, idx) => (
                          <tr
                            key={et.id}
                            className={idx % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'}
                          >
                            <td className="py-1.5 px-2 text-center font-bold">
                              {et.etapa}ª Etapa
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {et.duracaoMinutos} min
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold">
                              {fmtNumeroSEMA(et.vazao, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {fmtNumeroSEMA(calcSEMA.neInicial, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {fmtNumeroSEMA(et.nd, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-[#002299]">
                              {fmtNumeroSEMA(et.rebaixamento, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {fmtNumeroSEMA(et.rebaixamentoEspecifico, 4)}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {fmtNumeroSEMA(et.capacidadeEspecifica, 4)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-semibold">
                              {fmtNumeroSEMA(et.sCalc, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-[#27AE60]">
                              {fmtNumeroSEMA(et.eficienciaPct, 1, '%')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Memória de Cálculo Completa com Equações em Notação de Livro (Display Math ABNT) */}
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 gap-2">
                        {equacoesLivro.anexoI3Jacob.map((eq) => (
                          <MathFormulaBlock key={eq.id} spec={eq} compact />
                        ))}
                        {equacoesLivro.anexoI3Cooper.map((eq) => (
                          <MathFormulaBlock key={eq.id} spec={eq} compact />
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-[8pt]">
                        <div className="border border-[#1B2A3B] bg-[#F8FAFC] p-3 space-y-1.5">
                          <div className="font-bold uppercase text-[#1B2A3B] border-b border-slate-300 pb-1">
                            1. Parâmetros de Jacob-Rorabaugh (Perdas Laminar e Turbulenta)
                          </div>
                          <div className="font-mono space-y-1 text-[7.6pt]">
                            <div>
                              • Coeficiente de Perda Laminar (Aquífero):{' '}
                              <strong>
                                B = {fmtNumeroSEMA(calcSEMA.coeficienteB, 4)} h/m²
                              </strong>{' '}
                              | B(24h) ={' '}
                              <strong>
                                {fmtNumeroSEMA(calcSEMA.coeficienteB24h, 4)} h/m²
                              </strong>
                            </div>
                            <div>
                              • Coeficiente de Perda Turbulenta (Poço):{' '}
                              <strong>
                                C = {fmtNumeroSEMA(calcSEMA.coeficienteC, 5)} h²/m⁵
                              </strong>
                            </div>
                            <div className="pt-1 border-t border-slate-200">
                              <strong>Verificação na Última Etapa (Q = {fmtNumeroSEMA(calcSEMA.vazaoEstabilizadaFinalM3h, 2)} m³/h):</strong>
                              <br />
                              • Eficiência Hidráulica Calculada:{' '}
                              <strong>{fmtNumeroSEMA(calcSEMA.eficienciaUltimaEtapaPct, 1, '%')}</strong>{' '}
                              | Rebaixamento Máximo: <strong>{fmtNumeroSEMA(calcSEMA.rebaixamentoMaximoM, 2)} m</strong>
                            </div>
                          </div>
                        </div>

                        <div className="border border-[#1B2A3B] bg-[#F8FAFC] p-3 space-y-1.5">
                          <div className="font-bold uppercase text-[#1B2A3B] border-b border-slate-300 pb-1">
                            2. Síntese de Transmissividade (Cooper-Jacob) e Capacidade Específica
                          </div>
                          <div className="font-mono space-y-1 text-[7.6pt]">
                            <div>
                              • Vazão Constante (Q): {fmtNumeroSEMA(calcSEMA.vazaoEstabilizadaFinalM3h, 3)} m³/h ={' '}
                              <strong>
                                {fmtNumeroSEMA((calcSEMA.vazaoEstabilizadaFinalM3h ?? 0) * 24, 3)} m³/dia
                              </strong>
                            </div>
                            <div>
                              • Declividade por ciclo logarítmico (Δs de t=10 a t=100 min):{' '}
                              <strong>Δs = {fmtNumeroSEMA(calcSEMA.deltaSCicloM, 2)} m</strong>
                            </div>
                            <div>
                              • Transmissividade Hidráulica:{' '}
                              <strong className="text-[#002299]">
                                T = {fmtNumeroSEMA(calcSEMA.transmissividadeM2Dia, 2)} m²/dia
                              </strong>
                            </div>
                            <div className="pt-1 border-t border-slate-200">
                              • Capacidade Específica Final (Q/s):{' '}
                              <strong>
                                {fmtNumeroSEMA(calcSEMA.qPorSFinal, 4)} m³/h/m
                              </strong>{' '}
                              | Rebaixamento Específico (s/Q):{' '}
                              <strong>
                                {fmtNumeroSEMA(calcSEMA.sPorQFinal, 4)} m/(m³/h)
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quadro Síntese de Condições de Operação Recomendadas */}
                    <div className="border-2 border-[#1B2A3B] bg-[#F2FAF4] p-3.5 text-[8.2pt]">
                      <div className="font-bold uppercase text-[#1B2A3B] mb-1.5 text-center">
                        CONDIÇÕES DEFINITIVAS E UNIFICADAS DE OPERAÇÃO DO POÇO{' '}
                        {tagPocoPreview}
                      </div>
                      <div className="grid grid-cols-3 gap-3 font-mono text-center">
                        <div className="bg-white border border-[#DDE3EC] p-2">
                          <span className="block text-[7pt] uppercase text-[#6B7A8D]">
                            Vazão Recomendada (Q)
                          </span>
                          <span className="text-[10pt] font-bold text-[#1B2A3B]">
                            {vazaoPreview}
                          </span>
                          <span className="block text-[6.8pt] text-slate-600">
                            Regime até {testeSEMA.regimeBombeamentoHorasDia || '16'} h/dia
                          </span>
                        </div>
                        <div className="bg-white border border-[#DDE3EC] p-2">
                          <span className="block text-[7pt] uppercase text-[#6B7A8D]">
                            Nível Dinâmico Previsto (ND)
                          </span>
                          <span className="text-[10pt] font-bold text-[#1B2A3B]">
                            {ndPreview}
                          </span>
                          <span className="block text-[6.8pt] text-slate-600">
                            NE = {nePreview} | s = {fmtNumeroSEMA(calcSEMA.rebaixamentoMaximoM, 2)} m
                          </span>
                        </div>
                        <div className="bg-white border border-[#DDE3EC] p-2">
                          <span className="block text-[7pt] uppercase text-[#6B7A8D]">
                            Crivo / Posição da Bomba
                          </span>
                          <span className="text-[10pt] font-bold text-[#27AE60]">
                            {crivoPreview}
                          </span>
                          <span className="block text-[6.8pt] text-slate-600">
                            Prof. Total: {profTotalPreview}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <RodapePadrao relatorio={relatorio} />
                </A4SheetScaled>
              </div>
            );
          })()}
      </div>
    </div>
  );
};

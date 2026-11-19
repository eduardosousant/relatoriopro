import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CadastroCliente,
  CadastroPoco,
} from '../types/relatorio';
import {
  LinhaLancamentoHistoricoOS,
  normalizarDataParaISO,
} from './ModalLancamentoRapidoHistorico';
import { OPCOES_ETAPA_DURACAO } from './StepDrawdownSection';
import { DadosExtraidosOSCampo } from './ImportarOSCampoModal';
import { PdfViewerPanel } from './PdfViewerPanel';
import {
  normalizarDecimalVirgula,
  normalizarVazaoParaM3h,
  exportarLoteParaCSV,
  exportarLoteParaXLSX,
} from '../utils/exportacaoLoteOS';
import {
  TIPOS_SERVICO_PADRAO,
  normalizarTipoServico,
} from '../services/relatorioDefaults';
import {
  FileText,
  FolderOpen,
  FileSpreadsheet,
  Download,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Link2,
  Users,
  Table2,
  Columns2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Database,
  Save,
  Plus,
  Building2,
  Droplets,
  Wrench,
  ClipboardList,
  Check,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';

export type StatusConferenciaPDF = 'pendente' | 'extraindo' | 'conferido' | 'erro';

export interface ItemLoteConversorPDF {
  id: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes?: number;
  pdfBlob?: Blob;
  statusConferencia: StatusConferenciaPDF;
  erroExtracao?: string;
  linha: LinhaLancamentoHistoricoOS;
}

interface ConversorLotePDFSectionProps {
  clientes: CadastroCliente[];
  pocos: CadastroPoco[];
  onImportarLoteOS: (linhas: LinhaLancamentoHistoricoOS[]) => Promise<void>;
  showToast: (mensagem: string, tipo?: 'success' | 'error') => void;
}

type AbaBlocoFormulario =
  | 'identificacao'
  | 'medicoes'
  | 'equipamentos'
  | 'equipe_servicos'
  | 'todos';

const DURACOES_PERMITIDAS = OPCOES_ETAPA_DURACAO.filter(
  (o) => o.valor !== 'PERSONALIZADO'
);

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo para extração'));
    reader.readAsDataURL(blob);
  });
}

function criarLinhaEmBrancoParaArquivo(
  nomeArquivo: string,
  clientePadrao?: CadastroCliente,
  pocoPadrao?: CadastroPoco
): LinhaLancamentoHistoricoOS {
  const baseNome = nomeArquivo.replace(/\.[^.]+$/, '');
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    selecionada: true,
    clienteNome: clientePadrao?.razaoSocial || pocoPadrao?.cliente || '',
    clienteCNPJ: clientePadrao?.cnpjCpf || pocoPadrao?.clienteCNPJ || '',
    pocoTag: pocoPadrao?.tag || '',
    nomeLocalPoco:
      pocoPadrao?.enderecoLocal || pocoPadrao?.nomeIdentificacao || '',
    cidadeUF:
      pocoPadrao?.cidadeUF || clientePadrao?.cidadeUF || '',
    numeroOS: baseNome,
    dataExecucaoISO: new Date().toISOString().split('T')[0],
    tipoServico: 'Manutenção Preventiva',
    profundidadeTotal: normalizarDecimalVirgula(pocoPadrao?.profundidadeTotal),
    diametroRevestimento: pocoPadrao?.diametroRevestimento || '6"',
    neAntes: '',
    neDepois: '',
    ndAntes: '',
    ndDepois: '',
    vazaoAntes: '',
    vazaoDepois: '',
    crivoAntes: normalizarDecimalVirgula(pocoPadrao?.crivoPadrao),
    crivoDepois: normalizarDecimalVirgula(pocoPadrao?.crivoPadrao),
    eletrodoSup: normalizarDecimalVirgula(pocoPadrao?.eletrodoSuperiorPadrao),
    eletrodoInf: normalizarDecimalVirgula(pocoPadrao?.eletrodoInferiorPadrao),
    tuboEdutor: pocoPadrao?.tuboEdutorPadrao || '',
    especificacaoBomba: pocoPadrao?.bombaAtual || '',
    painelEletrico: pocoPadrao?.painelAtual || '',
    simularTesteVazao: true,
    duracaoTesteLabel: '24H',
    equipeTexto: '',
    materiaisTexto: '',
    servicosTexto: '',
    observacoesCampo: '',
    origem: 'pdf',
  };
}

function converterExtracaoParaLinhaNormalizada(
  d: DadosExtraidosOSCampo,
  nomeArquivo: string,
  clientePadrao?: CadastroCliente,
  pocoPadrao?: CadastroPoco
): LinhaLancamentoHistoricoOS {
  const baseNome = nomeArquivo.replace(/\.[^.]+$/, '');
  const obsCombinadas = [d.observacoesManuscritas, d.dadosCarimboVersoResumo]
    .filter(Boolean)
    .join(' | ');

  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    selecionada: true,
    clienteNome:
      (d.cliente || '').trim() ||
      clientePadrao?.razaoSocial ||
      pocoPadrao?.cliente ||
      '',
    clienteCNPJ:
      clientePadrao?.cnpjCpf || pocoPadrao?.clienteCNPJ || '',
    pocoTag: (d.pocoTag || '').trim() || pocoPadrao?.tag || '',
    nomeLocalPoco:
      (d.localizacao || '').trim() ||
      pocoPadrao?.enderecoLocal ||
      pocoPadrao?.nomeIdentificacao ||
      '',
    cidadeUF:
      (d.cidadeUF || '').trim() ||
      pocoPadrao?.cidadeUF ||
      clientePadrao?.cidadeUF ||
      '',
    numeroOS: (d.numeroOS || '').trim() || baseNome,
    dataExecucaoISO: normalizarDataParaISO(d.dataExecucaoISO || ''),
    tipoServico: normalizarTipoServico(d.tipoServico, 'Manutenção Preventiva'),
    profundidadeTotal: normalizarDecimalVirgula(
      d.profundidadeTotal || pocoPadrao?.profundidadeTotal
    ),
    diametroRevestimento:
      (d.diametroRevestimento || '').trim() ||
      pocoPadrao?.diametroRevestimento ||
      '6"',
    neAntes: normalizarDecimalVirgula(d.nivelEstaticoInicial || d.nivelEstatico),
    neDepois: normalizarDecimalVirgula(d.nivelEstatico || d.nivelEstaticoInicial),
    ndAntes: normalizarDecimalVirgula(d.nivelDinamicoInicial || d.nivelDinamico),
    ndDepois: normalizarDecimalVirgula(d.nivelDinamico || d.nivelDinamicoInicial),
    vazaoAntes: normalizarVazaoParaM3h(d.vazaoInicial || d.vazaoTeste),
    vazaoDepois: normalizarVazaoParaM3h(d.vazaoTeste || d.vazaoInicial),
    crivoAntes: normalizarDecimalVirgula(
      d.crivoInicial || d.crivo || pocoPadrao?.crivoPadrao
    ),
    crivoDepois: normalizarDecimalVirgula(
      d.crivo || d.crivoInicial || pocoPadrao?.crivoPadrao
    ),
    eletrodoSup: normalizarDecimalVirgula(
      d.eletrodoSuperior ||
        d.eletrodoSuperiorInicial ||
        pocoPadrao?.eletrodoSuperiorPadrao
    ),
    eletrodoInf: normalizarDecimalVirgula(
      d.eletrodoInferior ||
        d.eletrodoInferiorInicial ||
        pocoPadrao?.eletrodoInferiorPadrao
    ),
    tuboEdutor: (d.tuboEdutor || '').trim() || pocoPadrao?.tuboEdutorPadrao || '',
    especificacaoBomba:
      (d.especificacaoBomba || '').trim() || pocoPadrao?.bombaAtual || '',
    painelEletrico:
      (d.painelEletrico || '').trim() || pocoPadrao?.painelAtual || '',
    simularTesteVazao: true,
    duracaoTesteLabel: '24H',
    equipeTexto: (d.equipe || [])
      .map((m) => (m.funcao ? `${m.nome} (${m.funcao})` : m.nome))
      .filter(Boolean)
      .join(' | '),
    materiaisTexto: (d.materiais || [])
      .map((m) =>
        m.quantidade
          ? `${m.descricao} (${m.quantidade}${m.unidade ? ` ${m.unidade}` : ''})`
          : m.descricao
      )
      .filter(Boolean)
      .join(' | '),
    servicosTexto: (d.servicos || [])
      .map((s) => s.descricao)
      .filter(Boolean)
      .join(' | '),
    observacoesCampo: obsCombinadas,
    origem: 'pdf',
  };
}

export const ConversorLotePDFSection: React.FC<
  ConversorLotePDFSectionProps
> = ({ clientes, pocos, onImportarLoteOS, showToast }) => {
  const [itens, setItens] = useState<ItemLoteConversorPDF[]>([]);
  const [itemAtivoId, setItemAtivoId] = useState<string>('');
  const [modoVisao, setModoVisao] = useState<'split' | 'tabela'>('split');
  const [blocoAtivo, setBlocoAtivo] =
    useState<AbaBlocoFormulario>('identificacao');
  const [clientePadraoUuid, setClientePadraoUuid] = useState<string>('');
  const [pocoPadraoUuid, setPocoPadraoUuid] = useState<string>('');

  const [processandoLote, setProcessandoLote] = useState<boolean>(false);
  const [statusProcessamentoTexto, setStatusProcessamentoTexto] =
    useState<string>('');
  const [salvandoSistema, setSalvandoSistema] = useState<boolean>(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState<boolean>(false);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [alvoDropId, setAlvoDropId] = useState<string | null>(null);

  const inputPdfsRef = useRef<HTMLInputElement | null>(null);
  const inputPastaRef = useRef<HTMLInputElement | null>(null);

  const clientePadraoObj = clientes.find((c) => c.uuid === clientePadraoUuid);
  const pocosFiltradosPadrao = clientePadraoObj
    ? pocos.filter(
        (p) =>
          p.clienteUuid === clientePadraoObj.uuid ||
          p.cliente.trim().toLowerCase() ===
            clientePadraoObj.razaoSocial.trim().toLowerCase()
      )
    : pocos;
  const pocoPadraoObj = pocos.find((p) => p.uuid === pocoPadraoUuid);

  const itemAtivo = itens.find((i) => i.id === itemAtivoId) || itens[0];
  const indiceAtivo = itemAtivo
    ? itens.findIndex((i) => i.id === itemAtivo.id)
    : -1;

  // Extrai um único item usando /api/extrair-os-campo
  const extrairDadosDoItem = useCallback(
    async (
      itemId: string,
      blob: Blob,
      nomeArquivo: string,
      mimeType: string
    ) => {
      setItens((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, statusConferencia: 'extraindo', erroExtracao: undefined }
            : it
        )
      );

      try {
        const base64Data = await blobParaDataUrl(blob);
        const resp = await fetch('/api/extrair-os-campo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            mimeType,
            nomeArquivo,
          }),
        });

        const json = await resp.json();
        if (resp.ok && json.sucesso && json.dados) {
          const linhaExtraida = converterExtracaoParaLinhaNormalizada(
            json.dados as DadosExtraidosOSCampo,
            nomeArquivo,
            clientePadraoObj,
            pocoPadraoObj
          );
          setItens((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    statusConferencia: 'pendente',
                    erroExtracao: undefined,
                    linha: {
                      ...linhaExtraida,
                      id: it.linha.id,
                    },
                  }
                : it
            )
          );
        } else {
          setItens((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    statusConferencia: 'erro',
                    erroExtracao:
                      json?.error ||
                      'Não foi possível ler automaticamente. Edite os campos manualmente ao lado do PDF.',
                  }
                : it
            )
          );
        }
      } catch {
        setItens((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  statusConferencia: 'erro',
                  erroExtracao:
                    'Falha na comunicação com o extrator. Preencha manualmente conferindo o PDF ao lado.',
                }
              : it
          )
        );
      }
    },
    [clientePadraoObj, pocoPadraoObj]
  );

  // Recebe múltiplos PDFs ou pasta inteira e inicia a extração sem travar o lote
  const handleAdicionarArquivos = async (filesInput: FileList | File[]) => {
    const todos = Array.from(filesInput);
    const validos = todos.filter(
      (f) =>
        f.type === 'application/pdf' ||
        f.type.startsWith('image/') ||
        /\.(pdf|jpe?g|png|webp)$/i.test(f.name)
    );

    if (validos.length === 0) {
      showToast(
        'Nenhum arquivo PDF ou imagem compatível encontrado na seleção.',
        'error'
      );
      return;
    }

    // Ordena por nome para manter sequência lógica das O.S.
    validos.sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
    );

    const novosItens: ItemLoteConversorPDF[] = validos.map((f, idx) => {
      const ehPdf =
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const mimeType = ehPdf ? 'application/pdf' : f.type || 'image/jpeg';
      return {
        id: `pdf-lote-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        nomeArquivo: f.name,
        mimeType,
        tamanhoBytes: f.size,
        pdfBlob: f,
        statusConferencia: 'pendente',
        linha: criarLinhaEmBrancoParaArquivo(
          f.name,
          clientePadraoObj,
          pocoPadraoObj
        ),
      };
    });

    setItens((prev) => [...prev, ...novosItens]);
    setItemAtivoId((atual) => atual || novosItens[0].id);

    setProcessandoLote(true);
    for (let i = 0; i < novosItens.length; i++) {
      const it = novosItens[i];
      setStatusProcessamentoTexto(
        `Extraindo ${i + 1} de ${novosItens.length}: ${it.nomeArquivo}`
      );
      if (it.pdfBlob) {
        await extrairDadosDoItem(it.id, it.pdfBlob, it.nomeArquivo, it.mimeType);
        if (i < novosItens.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    }
    setProcessandoLote(false);
    setStatusProcessamentoTexto('');
    showToast(
      `${novosItens.length} ${
        novosItens.length === 1
          ? 'arquivo carregado para conferência visual!'
          : 'arquivos carregados para conferência visual!'
      }`,
      'success'
    );
  };

  const handleAtualizarCampoItem = <K extends keyof LinhaLancamentoHistoricoOS>(
    itemId: string,
    campo: K,
    valor: LinhaLancamentoHistoricoOS[K]
  ) => {
    setItens((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              linha: {
                ...it.linha,
                [campo]: valor,
              },
            }
          : it
      )
    );
  };

  const handleMarcarConferidoEProximo = (itemId: string) => {
    const atualizados = itens.map((it) =>
      it.id === itemId
        ? {
            ...it,
            statusConferencia: 'conferido' as const,
            erroExtracao: undefined,
            linha: { ...it.linha, selecionada: true },
          }
        : it
    );

    const idxAtual = atualizados.findIndex((x) => x.id === itemId);
    const proxPendente =
      atualizados
        .slice(idxAtual + 1)
        .find((x) => x.statusConferencia !== 'conferido') ||
      atualizados.find(
        (x, i) => i !== idxAtual && x.statusConferencia !== 'conferido'
      ) ||
      atualizados[idxAtual + 1];

    setItens(atualizados);

    if (proxPendente && proxPendente.id !== itemId) {
      setItemAtivoId(proxPendente.id);
    }
    showToast('O.S. marcada como conferida!', 'success');
  };

  const handleRemoverItem = (itemId: string) => {
    setItens((prev) => {
      const filtrados = prev.filter((it) => it.id !== itemId);
      if (itemAtivoId === itemId) {
        setItemAtivoId(filtrados[0]?.id || '');
      }
      return filtrados;
    });
  };

  const handleMoverItem = (itemId: string, direcao: -1 | 1) => {
    setItens((prev) => {
      const idx = prev.findIndex((it) => it.id === itemId);
      const novoIdx = idx + direcao;
      if (idx < 0 || novoIdx < 0 || novoIdx >= prev.length) return prev;
      const copia = [...prev];
      const [movido] = copia.splice(idx, 1);
      copia.splice(novoIdx, 0, movido);
      return copia;
    });
  };

  const handleMoverItemParaDestino = (origemId: string, destinoId: string) => {
    if (!origemId || !destinoId || origemId === destinoId) return;
    setItens((prev) => {
      const idxOrigem = prev.findIndex((it) => it.id === origemId);
      const idxDestino = prev.findIndex((it) => it.id === destinoId);
      if (idxOrigem < 0 || idxDestino < 0) return prev;
      const copia = [...prev];
      const [movido] = copia.splice(idxOrigem, 1);
      copia.splice(idxDestino, 0, movido);
      return copia;
    });
  };

  const handleOrdenarLote = (
    criterio: 'data_asc' | 'data_desc' | 'os_asc' | 'nome_asc' | 'inverter'
  ) => {
    if (itens.length < 2) return;
    setItens((prev) => {
      const copia = [...prev];
      if (criterio === 'inverter') {
        return copia.reverse();
      }
      if (criterio === 'data_asc') {
        return copia.sort((a, b) =>
          (a.linha.dataExecucaoISO || '9999-99-99').localeCompare(
            b.linha.dataExecucaoISO || '9999-99-99'
          )
        );
      }
      if (criterio === 'data_desc') {
        return copia.sort((a, b) =>
          (b.linha.dataExecucaoISO || '').localeCompare(
            a.linha.dataExecucaoISO || ''
          )
        );
      }
      if (criterio === 'os_asc') {
        return copia.sort((a, b) =>
          (a.linha.numeroOS || a.nomeArquivo).localeCompare(
            b.linha.numeroOS || b.nomeArquivo,
            'pt-BR',
            { numeric: true }
          )
        );
      }
      return copia.sort((a, b) =>
        a.nomeArquivo.localeCompare(b.nomeArquivo, 'pt-BR', { numeric: true })
      );
    });

    const rotulos: Record<typeof criterio, string> = {
      data_asc: 'Ordem alterada: Data (mais antiga → recente).',
      data_desc: 'Ordem alterada: Data (mais recente → antiga).',
      os_asc: 'Ordem alterada: Nº da O.S. (crescente).',
      nome_asc: 'Ordem alterada: Nome do arquivo (A → Z).',
      inverter: 'Ordem dos arquivos invertida.',
    };
    showToast(rotulos[criterio], 'success');
  };

  const handleAdicionarLinhaManual = () => {
    const novo: ItemLoteConversorPDF = {
      id: `manual-${Date.now()}`,
      nomeArquivo: 'Lançamento Manual (Sem PDF)',
      mimeType: 'application/pdf',
      statusConferencia: 'pendente',
      linha: criarLinhaEmBrancoParaArquivo(
        `OS-${itens.length + 1}`,
        clientePadraoObj,
        pocoPadraoObj
      ),
    };
    setItens((prev) => [...prev, novo]);
    setItemAtivoId(novo.id);
  };

  // Aplica Cliente/Poço padrão nos itens selecionados (ou apenas no item atual)
  const handleAplicarClientePocoPadrao = (somenteAtivo: boolean) => {
    if (!clientePadraoObj && !pocoPadraoObj) {
      showToast('Selecione um Cliente ou Poço padrão primeiro.', 'error');
      return;
    }

    setItens((prev) =>
      prev.map((it) => {
        const deveAplicar = somenteAtivo
          ? it.id === itemAtivo?.id
          : it.linha.selecionada;
        if (!deveAplicar) return it;
        return {
          ...it,
          linha: {
            ...it.linha,
            clienteNome:
              clientePadraoObj?.razaoSocial ||
              pocoPadraoObj?.cliente ||
              it.linha.clienteNome,
            clienteCNPJ:
              clientePadraoObj?.cnpjCpf ||
              pocoPadraoObj?.clienteCNPJ ||
              it.linha.clienteCNPJ,
            pocoTag: pocoPadraoObj?.tag || it.linha.pocoTag,
            nomeLocalPoco:
              pocoPadraoObj?.enderecoLocal ||
              pocoPadraoObj?.nomeIdentificacao ||
              it.linha.nomeLocalPoco,
            cidadeUF:
              pocoPadraoObj?.cidadeUF ||
              clientePadraoObj?.cidadeUF ||
              it.linha.cidadeUF,
            profundidadeTotal:
              normalizarDecimalVirgula(pocoPadraoObj?.profundidadeTotal) ||
              it.linha.profundidadeTotal,
            diametroRevestimento:
              pocoPadraoObj?.diametroRevestimento ||
              it.linha.diametroRevestimento,
          },
        };
      })
    );
    showToast(
      somenteAtivo
        ? 'Cliente / Poço padrão aplicado nesta O.S.!'
        : 'Cliente / Poço padrão aplicado a todas as O.S. selecionadas!',
      'success'
    );
  };

  // Ordena cronologicamente por Poço + Data e encadeia Antes <- Depois
  const handleEncadearCronologicamente = () => {
    if (itens.length === 0) return;
    setItens((prev) => {
      const ordenados = [...prev].sort((a, b) => {
        const chA = `${a.linha.clienteNome.toLowerCase()}_${a.linha.pocoTag.toLowerCase()}`;
        const chB = `${b.linha.clienteNome.toLowerCase()}_${b.linha.pocoTag.toLowerCase()}`;
        if (chA !== chB) return chA.localeCompare(chB);
        return (a.linha.dataExecucaoISO || '').localeCompare(
          b.linha.dataExecucaoISO || ''
        );
      });

      const ultimoPorPoco = new Map<string, LinhaLancamentoHistoricoOS>();
      return ordenados.map((item) => {
        const chave = `${item.linha.clienteNome.trim().toLowerCase()}_${item.linha.pocoTag
          .trim()
          .toLowerCase()}`;
        const anterior = ultimoPorPoco.get(chave);
        let novaLinha = item.linha;
        if (anterior) {
          novaLinha = {
            ...item.linha,
            profundidadeTotal:
              item.linha.profundidadeTotal || anterior.profundidadeTotal,
            diametroRevestimento:
              item.linha.diametroRevestimento || anterior.diametroRevestimento,
            neAntes:
              item.linha.neAntes || anterior.neDepois || anterior.neAntes,
            ndAntes:
              item.linha.ndAntes || anterior.ndDepois || anterior.ndAntes,
            vazaoAntes:
              item.linha.vazaoAntes ||
              anterior.vazaoDepois ||
              anterior.vazaoAntes,
            crivoAntes:
              item.linha.crivoAntes ||
              anterior.crivoDepois ||
              anterior.crivoAntes,
            tuboEdutor: item.linha.tuboEdutor || anterior.tuboEdutor,
            especificacaoBomba:
              item.linha.especificacaoBomba || anterior.especificacaoBomba,
            painelEletrico:
              item.linha.painelEletrico || anterior.painelEletrico,
          };
        }
        ultimoPorPoco.set(chave, novaLinha);
        return { ...item, linha: novaLinha };
      });
    });

    showToast(
      'Lote ordenado cronologicamente por Poço e medições "Antes" encadeadas a partir do "Depois" anterior!',
      'success'
    );
  };

  const handleReprocessarPendentes = async () => {
    const alvos = itens.filter(
      (i) => i.pdfBlob && i.statusConferencia !== 'conferido'
    );
    if (alvos.length === 0) {
      showToast('Não há PDFs pendentes para reprocessar.', 'error');
      return;
    }
    setProcessandoLote(true);
    for (let i = 0; i < alvos.length; i++) {
      const it = alvos[i];
      setStatusProcessamentoTexto(
        `Reprocessando ${i + 1} de ${alvos.length}: ${it.nomeArquivo}`
      );
      if (it.pdfBlob) {
        await extrairDadosDoItem(it.id, it.pdfBlob, it.nomeArquivo, it.mimeType);
        if (i < alvos.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    }
    setProcessandoLote(false);
    setStatusProcessamentoTexto('');
    showToast('Reprocessamento concluído!', 'success');
  };

  const itensSelecionados = itens.filter((i) => i.linha.selecionada);
  const qtdConferidos = itens.filter(
    (i) => i.statusConferencia === 'conferido'
  ).length;

  const handleExportarCSV = () => {
    const alvo = itensSelecionados.length > 0 ? itensSelecionados : itens;
    if (alvo.length === 0) {
      showToast('Carregue pelo menos uma O.S. antes de exportar.', 'error');
      return;
    }
    exportarLoteParaCSV(alvo.map((i) => i.linha));
    showToast(
      `CSV UTF-8 (29 colunas) exportado com ${alvo.length} O.S.!`,
      'success'
    );
  };

  const handleExportarXLSX = () => {
    const alvo = itensSelecionados.length > 0 ? itensSelecionados : itens;
    if (alvo.length === 0) {
      showToast('Carregue pelo menos uma O.S. antes de exportar.', 'error');
      return;
    }
    exportarLoteParaXLSX(alvo.map((i) => i.linha));
    showToast(
      `Planilha Excel (.xlsx) com 29 colunas exportada com ${alvo.length} O.S.!`,
      'success'
    );
  };

  const handleSalvarNoRelatorPRO = async () => {
    const alvo = itensSelecionados.length > 0 ? itensSelecionados : itens;
    if (alvo.length === 0) {
      showToast('Nenhuma O.S. selecionada para salvar no sistema.', 'error');
      return;
    }
    setSalvandoSistema(true);
    try {
      await onImportarLoteOS(alvo.map((i) => i.linha));
    } finally {
      setSalvandoSistema(false);
    }
  };

  const handleLimparRascunho = () => {
    if (!confirmarLimpeza) {
      setConfirmarLimpeza(true);
      window.setTimeout(() => setConfirmarLimpeza(false), 4000);
      return;
    }
    setItens([]);
    setItemAtivoId('');
    setConfirmarLimpeza(false);
    showToast('Lista de lote limpa com sucesso.', 'success');
  };

  const inputCls =
    'w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#E8A020]/50 focus:border-[#E8A020]';
  const labelCls =
    'block text-[11px] font-bold text-[#4A5568] dark:text-slate-300 mb-1';

  return (
    <div className="space-y-4">
      {/* Cabeçalho Principal da Seção */}
      <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#E8A020]" />
                <span>Conversor & Conferência de PDFs em Lote</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#E8A020]/15 text-[#B9770E] dark:text-[#E8A020] border border-[#E8A020]/30">
                29 Colunas Padrão · Split View
              </span>
              <span className="text-[11px] text-[#6B7A8D] dark:text-slate-400 flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-500" />
                Salva diretamente no Supabase
              </span>
            </div>
            <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-1">
              Leia fichas/O.S. em PDF em lote, confira visualmente lado a lado
              com o documento original, edite e exporte em{' '}
              <strong>.xlsx</strong> / <strong>.csv</strong> ou salve direto no
              RelatorPRO.
            </p>
          </div>

          {/* Botões de Ação em Lote */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputPdfsRef}
              type="file"
              accept=".pdf,application/pdf,image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) handleAdicionarArquivos(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <input
              ref={inputPastaRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(e) => {
                if (e.target.files) handleAdicionarArquivos(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => inputPdfsRef.current?.click()}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-[#1B2A3B] hover:bg-[#2E4260] text-white transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#E8A020]" />
              <span>Selecionar PDFs</span>
            </button>

            <button
              type="button"
              onClick={() => inputPastaRef.current?.click()}
              className="px-3 py-2 rounded-lg text-xs font-bold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#E8A020] transition-colors flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#E8A020]" />
              <span>Selecionar Pasta</span>
            </button>

            <button
              type="button"
              onClick={handleAdicionarLinhaManual}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#E8A020] transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#E8A020]" />
              <span>Linha Manual</span>
            </button>

            <div className="h-5 w-px bg-[#DDE3EC] dark:bg-slate-700 hidden sm:block" />

            {/* Toggle Split View / Tabela Geral */}
            <div className="inline-flex rounded-lg bg-[#F0F3F7] dark:bg-slate-800 p-0.5 border border-[#DDE3EC] dark:border-slate-700">
              <button
                type="button"
                onClick={() => setModoVisao('split')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  modoVisao === 'split'
                    ? 'bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-[#E8A020] shadow-xs'
                    : 'text-[#6B7A8D] dark:text-slate-400'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Lado a Lado</span>
              </button>
              <button
                type="button"
                onClick={() => setModoVisao('tabela')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  modoVisao === 'tabela'
                    ? 'bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-[#E8A020] shadow-xs'
                    : 'text-[#6B7A8D] dark:text-slate-400'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Tabela Geral ({itens.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Progresso IA + Aceleradores (Cliente/Poço Padrão + Encadear + Exportações) */}
        <div className="pt-3 border-t border-[#DDE3EC] dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Cliente & Poço Padrão + Encadear */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={clientePadraoUuid}
              onChange={(e) => {
                setClientePadraoUuid(e.target.value);
                setPocoPadraoUuid('');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 max-w-[220px]"
            >
              <option value="">Cliente Padrão (Opcional)</option>
              {clientes.map((c) => (
                <option key={c.uuid} value={c.uuid}>
                  {c.razaoSocial}
                </option>
              ))}
            </select>

            <select
              value={pocoPadraoUuid}
              onChange={(e) => setPocoPadraoUuid(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 max-w-[200px]"
            >
              <option value="">Poço Padrão (Opcional)</option>
              {pocosFiltradosPadrao.map((p) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.tag} — {p.enderecoLocal || p.nomeIdentificacao}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleAplicarClientePocoPadrao(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#E8A020]/50 text-[#1B2A3B] dark:text-[#E8A020] bg-[#E8A020]/10 hover:bg-[#E8A020]/20 transition-colors flex items-center gap-1"
              title="Preenche Cliente, CNPJ, TAG, Local, Cidade e dados construtivos nas O.S. marcadas"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Aplicar Cliente/Poço Padrão</span>
            </button>

            <button
              type="button"
              onClick={handleEncadearCronologicamente}
              disabled={itens.length < 2}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 disabled:opacity-45 transition-colors flex items-center gap-1"
              title="Ordena por Poço e Data e preenche o Antes de cada O.S. usando o Depois da O.S. anterior"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Encadear Antes ← Depois</span>
            </button>

            {itens.some((i) => i.pdfBlob && i.statusConferencia !== 'conferido') && (
              <button
                type="button"
                disabled={processandoLote}
                onClick={handleReprocessarPendentes}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] disabled:opacity-50 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#E8A020]" />
                <span>Reprocessar Pendentes (IA)</span>
              </button>
            )}
          </div>

          {/* Botões de Exportação e Gravação Direta */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportarCSV}
              disabled={itens.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 text-emerald-700 dark:text-emerald-400 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV (.csv)</span>
            </button>

            <button
              type="button"
              onClick={handleExportarXLSX}
              disabled={itens.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleSalvarNoRelatorPRO}
              disabled={itens.length === 0 || salvandoSistema}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {salvandoSistema ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5" />
              )}
              <span>
                Salvar no RelatorPRO ({itensSelecionados.length})
              </span>
            </button>

            {itens.length > 0 && (
              <button
                type="button"
                onClick={handleLimparRascunho}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  confirmarLimpeza
                    ? 'bg-red-600 text-white'
                    : 'border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmarLimpeza ? 'Confirmar Limpeza?' : 'Limpar'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner de Extração em Andamento */}
        {processandoLote && (
          <div className="px-3 py-2 rounded-lg bg-[#E8A020]/15 border border-[#E8A020]/40 text-xs font-semibold text-[#1B2A3B] dark:text-amber-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#E8A020] shrink-0" />
            <span>{statusProcessamentoTexto || 'Processando PDFs em lote...'}</span>
          </div>
        )}
      </div>

      {/* CONTEÚDO PRINCIPAL: SPLIT VIEW ou VISÃO EM TABELA GERAL */}
      {modoVisao === 'split' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.05fr)] gap-4 items-start">
          {/* Coluna 1: Fila de PDFs da Pasta/Lote */}
          <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs xl:sticky xl:top-[76px]">
            <div className="px-3.5 py-2.5 bg-[#F7F9FC] dark:bg-slate-950 border-b border-[#DDE3EC] dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100">
                  Arquivos do Lote ({itens.length})
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  {qtdConferidos}/{itens.length} OK
                </span>
              </div>

              {itens.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3 h-3 text-[#6B7A8D] shrink-0" />
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value as
                        | 'data_asc'
                        | 'data_desc'
                        | 'os_asc'
                        | 'nome_asc'
                        | 'inverter'
                        | '';
                      if (val) handleOrdenarLote(val);
                    }}
                    title="Ordenar arquivos do lote automaticamente"
                    className="w-full px-2 py-1 text-[10.5px] font-semibold rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-slate-200 focus:border-[#E8A020] focus:outline-none"
                  >
                    <option value="">Ordenar lote (arraste ou use ↑↓)…</option>
                    <option value="data_asc">Data: Mais antiga → Recente</option>
                    <option value="data_desc">Data: Mais recente → Antiga</option>
                    <option value="os_asc">Nº da O.S. (Crescente)</option>
                    <option value="nome_asc">Nome do Arquivo (A → Z)</option>
                    <option value="inverter">Inverter Ordem Atual</option>
                  </select>
                </div>
              )}
            </div>

            {itens.length === 0 ? (
              <div className="p-5 text-center text-xs text-[#6B7A8D] dark:text-slate-400 space-y-2">
                <p>Nenhum arquivo carregado.</p>
                <p className="text-[11px]">
                  Clique em <strong>Selecionar PDFs</strong> ou{' '}
                  <strong>Selecionar Pasta</strong> para iniciar.
                </p>
              </div>
            ) : (
              <div className="max-h-[320px] xl:max-h-[72vh] overflow-y-auto divide-y divide-[#EEF2F6] dark:divide-slate-800">
                {itens.map((it, idx) => {
                  const ativo = it.id === itemAtivo?.id;
                  const estaArrastando = arrastandoId === it.id;
                  const ehAlvoDrop =
                    alvoDropId === it.id && arrastandoId && arrastandoId !== it.id;
                  return (
                    <div
                      key={it.id}
                      draggable={itens.length > 1}
                      onDragStart={(e) => {
                        setArrastandoId(it.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', it.id);
                      }}
                      onDragOver={(e) => {
                        if (!arrastandoId || arrastandoId === it.id) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (alvoDropId !== it.id) setAlvoDropId(it.id);
                      }}
                      onDragLeave={() => {
                        if (alvoDropId === it.id) setAlvoDropId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const origemId =
                          arrastandoId || e.dataTransfer.getData('text/plain');
                        if (origemId && origemId !== it.id) {
                          handleMoverItemParaDestino(origemId, it.id);
                        }
                        setArrastandoId(null);
                        setAlvoDropId(null);
                      }}
                      onDragEnd={() => {
                        setArrastandoId(null);
                        setAlvoDropId(null);
                      }}
                      onClick={() => setItemAtivoId(it.id)}
                      className={`p-2.5 cursor-pointer transition-colors flex items-start gap-1.5 ${
                        estaArrastando ? 'opacity-45' : ''
                      } ${
                        ehAlvoDrop
                          ? 'ring-2 ring-inset ring-[#E8A020] bg-[#E8A020]/10'
                          : ativo
                            ? 'bg-[#E8A020]/15 border-l-4 border-l-[#E8A020]'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {itens.length > 1 && (
                        <span
                          title="Arraste para reordenar"
                          className="mt-0.5 text-[#94A3B8] hover:text-[#1B2A3B] dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </span>
                      )}

                      <input
                        type="checkbox"
                        checked={it.linha.selecionada}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          handleAtualizarCampoItem(
                            it.id,
                            'selecionada',
                            e.target.checked
                          )
                        }
                        title="Incluir na exportação / importação"
                        className="mt-1 rounded border-slate-300 text-[#E8A020] focus:ring-[#E8A020]"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-[#1B2A3B] dark:text-slate-100 truncate">
                            {idx + 1}. {it.linha.numeroOS || it.nomeArquivo}
                          </span>
                          {it.statusConferencia === 'conferido' ? (
                            <span title="Conferido" className="shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          ) : it.statusConferencia === 'extraindo' ? (
                            <span title="Extraindo com IA..." className="shrink-0">
                              <Loader2 className="w-3.5 h-3.5 text-[#E8A020] animate-spin" />
                            </span>
                          ) : it.statusConferencia === 'erro' ? (
                            <span
                              title={it.erroExtracao || 'Erro na leitura automática'}
                              className="shrink-0"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            </span>
                          ) : (
                            <span title="Pendente de conferência" className="shrink-0">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#6B7A8D] dark:text-slate-400 truncate">
                          {it.nomeArquivo}
                        </p>
                        <div className="flex items-center justify-between mt-1 gap-1">
                          <span className="text-[10px] font-mono text-[#6B7A8D] dark:text-slate-400 truncate">
                            {it.linha.pocoTag || 'Sem TAG'} ·{' '}
                            {it.linha.dataExecucaoISO
                              ? it.linha.dataExecucaoISO.split('-').reverse().join('/')
                              : '—'}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {itens.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoverItem(it.id, -1);
                                  }}
                                  title="Mover para cima"
                                  className="p-0.5 text-[#6B7A8D] hover:text-[#1B2A3B] dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === itens.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoverItem(it.id, 1);
                                  }}
                                  title="Mover para baixo"
                                  className="p-0.5 text-[#6B7A8D] hover:text-[#1B2A3B] dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            {it.pdfBlob && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  extrairDadosDoItem(
                                    it.id,
                                    it.pdfBlob!,
                                    it.nomeArquivo,
                                    it.mimeType
                                  );
                                }}
                                title="Re-extrair dados deste PDF com IA"
                                className="p-0.5 text-[#6B7A8D] hover:text-[#E8A020]"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoverItem(it.id);
                              }}
                              title="Remover da lista"
                              className="p-0.5 text-[#6B7A8D] hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna 2 (Painel Esquerdo): Visualizador de PDF */}
          <div className="xl:sticky xl:top-[76px]">
            <PdfViewerPanel
              blob={itemAtivo?.pdfBlob}
              nomeArquivo={itemAtivo?.nomeArquivo}
              mimeType={itemAtivo?.mimeType}
              onDropArquivos={handleAdicionarArquivos}
              onSelecionarPdfs={() => inputPdfsRef.current?.click()}
            />
          </div>

          {/* Coluna 3 (Painel Direito): Formulário Editável Organizado por Blocos */}
          <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col">
            {!itemAtivo ? (
              <div className="p-10 text-center space-y-2 text-xs text-[#6B7A8D] dark:text-slate-400">
                <ClipboardList className="w-8 h-8 mx-auto text-[#E8A020]" />
                <p className="font-bold text-[#1B2A3B] dark:text-slate-200">
                  Formulário de Conferência Lado a Lado
                </p>
                <p>
                  Selecione os PDFs ou uma pasta para visualizar cada página à
                  esquerda e conferir/corrigir os 29 campos padronizados aqui à
                  direita.
                </p>
              </div>
            ) : (
              <>
                {/* Cabeçalho do Formulário + Abas dos 4 Blocos */}
                <div className="p-3.5 bg-[#F7F9FC] dark:bg-slate-950 border-b border-[#DDE3EC] dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-[#1B2A3B] text-[#E8A020] text-[11px] font-mono font-bold">
                        #{indiceAtivo + 1} / {itens.length}
                      </span>
                      <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100 truncate">
                        O.S. {itemAtivo.linha.numeroOS || 'S/N'}
                      </span>
                      {itemAtivo.statusConferencia === 'conferido' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          Conferido
                        </span>
                      ) : itemAtivo.statusConferencia === 'erro' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400">
                          Edição Manual
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          Pendente
                        </span>
                      )}
                    </div>

                    {(clientePadraoObj || pocoPadraoObj) && (
                      <button
                        type="button"
                        onClick={() => handleAplicarClientePocoPadrao(true)}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-[#E8A020]/15 text-[#B9770E] dark:text-[#E8A020] hover:bg-[#E8A020]/25"
                      >
                        Aplicar Padrão Nesta O.S.
                      </button>
                    )}
                  </div>

                  {itemAtivo.erroExtracao && (
                    <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="break-words">{itemAtivo.erroExtracao}</span>
                      </div>
                      {itemAtivo.pdfBlob && (
                        <button
                          type="button"
                          disabled={itemAtivo.statusConferencia === 'extraindo'}
                          onClick={() =>
                            extrairDadosDoItem(
                              itemAtivo.id,
                              itemAtivo.pdfBlob!,
                              itemAtivo.nomeArquivo,
                              itemAtivo.mimeType
                            )
                          }
                          className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                        >
                          Tentar ler novamente
                        </button>
                      )}
                    </div>
                  )}

                  {/* Abas de Blocos */}
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        {
                          id: 'identificacao',
                          label: 'Identificação & Poço',
                          icon: Building2,
                        },
                        {
                          id: 'medicoes',
                          label: 'Medições Antes/Depois',
                          icon: Droplets,
                        },
                        {
                          id: 'equipamentos',
                          label: 'Equipamentos',
                          icon: Wrench,
                        },
                        {
                          id: 'equipe_servicos',
                          label: 'Equipe, Materiais e Serviços',
                          icon: ClipboardList,
                        },
                        {
                          id: 'todos',
                          label: 'Ver Todos',
                          icon: Check,
                        },
                      ] as const
                    ).map((aba) => {
                      const Icon = aba.icon;
                      const ativo = blocoAtivo === aba.id;
                      return (
                        <button
                          key={aba.id}
                          type="button"
                          onClick={() => setBlocoAtivo(aba.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                            ativo
                              ? 'bg-[#1B2A3B] text-[#E8A020]'
                              : 'bg-white dark:bg-slate-900 text-[#6B7A8D] dark:text-slate-400 border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{aba.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Campos Editáveis */}
                <div className="p-4 space-y-5 max-h-[62vh] overflow-y-auto">
                  {/* BLOCO 1: IDENTIFICAÇÃO & POÇO */}
                  {(blocoAtivo === 'identificacao' || blocoAtivo === 'todos') && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-[#E8A020] border-b border-[#EEF2F6] dark:border-slate-800 pb-1">
                        1. Identificação & Poço
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Cliente</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.clienteNome}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'clienteNome',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Razão social / Entidade"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>CNPJ do Cliente</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.clienteCNPJ}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'clienteCNPJ',
                                e.target.value
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="00.000.000/0001-00"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Poço TAG</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.pocoTag}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'pocoTag',
                                e.target.value
                              )
                            }
                            className={`${inputCls} font-mono font-bold`}
                            placeholder="Ex: PT-01"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Nome / Local do Poço</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.nomeLocalPoco}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'nomeLocalPoco',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Fazenda, Posto Fiscal ou Endereço"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Cidade / UF</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.cidadeUF}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'cidadeUF',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Ex: Cuiabá - MT"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Número da O.S.</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.numeroOS}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'numeroOS',
                                e.target.value
                              )
                            }
                            className={`${inputCls} font-mono font-bold`}
                            placeholder="Ex: 10260 ou 08410/2024"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Data de Execução</label>
                          <input
                            type="date"
                            value={itemAtivo.linha.dataExecucaoISO}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'dataExecucaoISO',
                                e.target.value
                              )
                            }
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Tipo de Serviço</label>
                          <select
                            value={normalizarTipoServico(
                              itemAtivo.linha.tipoServico,
                              ''
                            )}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'tipoServico',
                                e.target.value
                              )
                            }
                            className={inputCls}
                          >
                            <option value="">Selecione…</option>
                            {TIPOS_SERVICO_PADRAO.map((opcao) => (
                              <option key={opcao} value={opcao}>
                                {opcao}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>
                            Profundidade Total (m)
                          </label>
                          <input
                            type="text"
                            value={itemAtivo.linha.profundidadeTotal}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'profundidadeTotal',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'profundidadeTotal',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="Ex: 160,00"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Diâmetro (Pol)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.diametroRevestimento}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'diametroRevestimento',
                                e.target.value
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder='Ex: 6"'
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BLOCO 2: MEDIÇÕES ANTES / DEPOIS */}
                  {(blocoAtivo === 'medicoes' || blocoAtivo === 'todos') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#EEF2F6] dark:border-slate-800 pb-1">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-[#E8A020]">
                          2. Medições Antes / Depois
                        </h4>
                        <span className="text-[10px] text-[#6B7A8D] dark:text-slate-400">
                          Dica: digite em L/h (ex: 4100) e ao sair converte para
                          4,10 m³/h
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>NE Antes (m)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.neAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'neAntes',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'neAntes',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="22,40"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>NE Depois (m)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.neDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'neDepois',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'neDepois',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="22,10"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>ND Antes (m)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.ndAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'ndAntes',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'ndAntes',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="68,50"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>ND Depois (m)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.ndDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'ndDepois',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'ndDepois',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="64,10"
                          />
                        </div>

                        <div>
                          <label className={labelCls}>
                            Vazão Antes (m³/h)
                          </label>
                          <input
                            type="text"
                            value={itemAtivo.linha.vazaoAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'vazaoAntes',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'vazaoAntes',
                                normalizarVazaoParaM3h(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono font-bold`}
                            placeholder="4,00 ou 4000"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Vazão Depois (m³/h)
                          </label>
                          <input
                            type="text"
                            value={itemAtivo.linha.vazaoDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'vazaoDepois',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'vazaoDepois',
                                normalizarVazaoParaM3h(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono font-bold`}
                            placeholder="4,10 ou 4100"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Crivo Antes (m)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.crivoAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'crivoAntes',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'crivoAntes',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="84,00"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Crivo Depois (m)</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.crivoDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'crivoDepois',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'crivoDepois',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="84,00"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className={labelCls}>
                            Eletrodo Superior (m / Cabo)
                          </label>
                          <input
                            type="text"
                            value={itemAtivo.linha.eletrodoSup}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'eletrodoSup',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'eletrodoSup',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="76,00"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>
                            Eletrodo Inferior (m / Cabo)
                          </label>
                          <input
                            type="text"
                            value={itemAtivo.linha.eletrodoInf}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'eletrodoInf',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'eletrodoInf',
                                normalizarDecimalVirgula(e.target.value)
                              )
                            }
                            className={`${inputCls} font-mono`}
                            placeholder="80,00"
                          />
                        </div>
                      </div>

                      {/* Teste de Bombeamento Simulado */}
                      <div className="p-3 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#1B2A3B] dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemAtivo.linha.simularTesteVazao}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'simularTesteVazao',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300 text-[#E8A020] focus:ring-[#E8A020]"
                          />
                          <span>
                            Simular Planilha & Gráficos de Teste de Vazão ao
                            importar
                          </span>
                        </label>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#6B7A8D]">
                            Duração:
                          </span>
                          <select
                            value={itemAtivo.linha.duracaoTesteLabel}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'duracaoTesteLabel',
                                e.target.value
                              )
                            }
                            className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                            {DURACOES_PERMITIDAS.map((op) => (
                              <option key={op.valor} value={op.valor}>
                                {op.valor}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BLOCO 3: EQUIPAMENTOS */}
                  {(blocoAtivo === 'equipamentos' || blocoAtivo === 'todos') && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-[#E8A020] border-b border-[#EEF2F6] dark:border-slate-800 pb-1">
                        3. Equipamentos Instalados
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className={labelCls}>Tubo Edutor</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.tuboEdutor}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'tuboEdutor',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder='Ex: Geomecânico 2" / 1 1/4" Galvanizado'
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Motobomba</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.especificacaoBomba}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'especificacaoBomba',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Ex: Ebara 4BHS-15 7,5 CV Trifásica 380V"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Painel Elétrico</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.painelEletrico}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'painelEletrico',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Ex: Partida Direta 220V 11,4A"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BLOCO 4: EQUIPE, MATERIAIS E SERVIÇOS */}
                  {(blocoAtivo === 'equipe_servicos' ||
                    blocoAtivo === 'todos') && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-[#E8A020] border-b border-[#EEF2F6] dark:border-slate-800 pb-1">
                        4. Equipe, Materiais e Serviços (separados por{' '}
                        <code className="font-mono">|</code>)
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className={labelCls}>Equipe Técnica</label>
                          <input
                            type="text"
                            value={itemAtivo.linha.equipeTexto}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'equipeTexto',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Ex: José Augusto (Líder) | Daniel Diego (Auxiliar)"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Materiais Aplicados
                          </label>
                          <textarea
                            rows={2}
                            value={itemAtivo.linha.materiaisTexto}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'materiaisTexto',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Ex: Ácido Cítrico (10 KG) | Hipoclorito de Sódio (10 L)"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Serviços Executados
                          </label>
                          <textarea
                            rows={2}
                            value={itemAtivo.linha.servicosTexto}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'servicosTexto',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Ex: Limpeza e desenvolvimento | Desinfecção | Teste de vazão"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Observações de Campo / Carimbo Verso
                          </label>
                          <textarea
                            rows={3}
                            value={itemAtivo.linha.observacoesCampo}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                itemAtivo.id,
                                'observacoesCampo',
                                e.target.value
                              )
                            }
                            className={inputCls}
                            placeholder="Anotações manuscritas, aterramento, cavalete, etc."
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé de Conferência Rápida */}
                <div className="px-4 py-3 bg-[#F7F9FC] dark:bg-slate-950 border-t border-[#DDE3EC] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={indiceAtivo <= 0}
                      onClick={() =>
                        indiceAtivo > 0 &&
                        setItemAtivoId(itens[indiceAtivo - 1].id)
                      }
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                    <button
                      type="button"
                      disabled={indiceAtivo < 0 || indiceAtivo >= itens.length - 1}
                      onClick={() =>
                        indiceAtivo < itens.length - 1 &&
                        setItemAtivoId(itens[indiceAtivo + 1].id)
                      }
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 flex items-center gap-1"
                    >
                      <span>Próximo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleMarcarConferidoEProximo(itemAtivo.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Marcar Conferido e Próximo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* VISÃO EM TABELA GERAL DO LOTE (Estilo Planilha) */
        <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          {itens.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B7A8D] dark:text-slate-400">
              Nenhum arquivo carregado no lote ainda. Selecione seus PDFs acima.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full min-w-[2150px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#1B2A3B] text-white text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10">Inc.</th>
                    <th className="py-2.5 px-2 text-left w-28">Status / PDF</th>
                    <th className="py-2.5 px-2 text-left w-48">Cliente</th>
                    <th className="py-2.5 px-2 text-left w-36">CNPJ</th>
                    <th className="py-2.5 px-2 text-left w-28">Poço TAG</th>
                    <th className="py-2.5 px-2 text-left w-44">Nome/Local</th>
                    <th className="py-2.5 px-2 text-left w-32">Cidade/UF</th>
                    <th className="py-2.5 px-2 text-left w-28">Nº O.S.</th>
                    <th className="py-2.5 px-2 text-left w-32">Data Exec.</th>
                    <th className="py-2.5 px-2 text-left w-44">Tipo Serviço</th>
                    <th className="py-2.5 px-2 text-left w-20">Prof.</th>
                    <th className="py-2.5 px-2 text-left w-16">Ø Pol</th>
                    <th className="py-2.5 px-2 text-left w-20">NE Ant</th>
                    <th className="py-2.5 px-2 text-left w-20">NE Dep</th>
                    <th className="py-2.5 px-2 text-left w-20">ND Ant</th>
                    <th className="py-2.5 px-2 text-left w-20">ND Dep</th>
                    <th className="py-2.5 px-2 text-left w-24">Q Ant m³/h</th>
                    <th className="py-2.5 px-2 text-left w-24">Q Dep m³/h</th>
                    <th className="py-2.5 px-2 text-left w-20">Crivo Ant</th>
                    <th className="py-2.5 px-2 text-left w-20">Crivo Dep</th>
                    <th className="py-2.5 px-2 text-left w-24">El. Sup</th>
                    <th className="py-2.5 px-2 text-left w-24">El. Inf</th>
                    <th className="py-2.5 px-2 text-left w-36">Edutor</th>
                    <th className="py-2.5 px-2 text-left w-44">Motobomba</th>
                    <th className="py-2.5 px-2 text-left w-40">Painel</th>
                    <th className="py-2.5 px-2 text-center w-20">Simular</th>
                    <th className="py-2.5 px-2 text-center w-20">Duração</th>
                    <th className="py-2.5 px-2 text-left w-48">Equipe</th>
                    <th className="py-2.5 px-2 text-left w-48">Materiais</th>
                    <th className="py-2.5 px-2 text-left w-52">Serviços</th>
                    <th className="py-2.5 px-2 text-left w-52">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6] dark:divide-slate-800">
                  {itens.map((it, idx) => {
                    const cellInput =
                      'w-full px-1.5 py-1 text-[11px] rounded border border-transparent hover:border-[#DDE3EC] dark:hover:border-slate-700 focus:border-[#E8A020] bg-transparent focus:bg-white dark:focus:bg-slate-950 focus:outline-none';
                    return (
                      <tr
                        key={it.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={it.linha.selecionada}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'selecionada',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300 text-[#E8A020]"
                          />
                        </td>
                        <td className="p-1.5 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono font-bold text-[#6B7A8D] w-5 text-right">
                              #{idx + 1}
                            </span>
                            {itens.length > 1 && (
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoverItem(it.id, -1)}
                                  title="Mover linha para cima"
                                  className="text-[#6B7A8D] hover:text-[#1B2A3B] dark:hover:text-white disabled:opacity-25 leading-none"
                                >
                                  <ArrowUp className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === itens.length - 1}
                                  onClick={() => handleMoverItem(it.id, 1)}
                                  title="Mover linha para baixo"
                                  className="text-[#6B7A8D] hover:text-[#1B2A3B] dark:hover:text-white disabled:opacity-25 leading-none"
                                >
                                  <ArrowDown className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setItemAtivoId(it.id);
                                setModoVisao('split');
                              }}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-[#E8A020]/15 text-[#B9770E] dark:text-[#E8A020] hover:bg-[#E8A020] hover:text-[#1B2A3B] transition-colors flex items-center gap-1"
                              title={`Abrir PDF: ${it.nomeArquivo}`}
                            >
                              {it.statusConferencia === 'conferido' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>Ver PDF</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.clienteNome}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'clienteNome',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.clienteCNPJ}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'clienteCNPJ',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.pocoTag}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'pocoTag',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono font-bold`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.nomeLocalPoco}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'nomeLocalPoco',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.cidadeUF}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'cidadeUF',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.numeroOS}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'numeroOS',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono font-bold`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="date"
                            value={it.linha.dataExecucaoISO}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'dataExecucaoISO',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <select
                            value={normalizarTipoServico(
                              it.linha.tipoServico,
                              ''
                            )}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'tipoServico',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          >
                            <option value="">Selecione…</option>
                            {TIPOS_SERVICO_PADRAO.map((opcao) => (
                              <option key={opcao} value={opcao}>
                                {opcao}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.profundidadeTotal}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'profundidadeTotal',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.diametroRevestimento}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'diametroRevestimento',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.neAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'neAntes',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.neDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'neDepois',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.ndAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'ndAntes',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.ndDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'ndDepois',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.vazaoAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'vazaoAntes',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'vazaoAntes',
                                normalizarVazaoParaM3h(e.target.value)
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.vazaoDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'vazaoDepois',
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'vazaoDepois',
                                normalizarVazaoParaM3h(e.target.value)
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.crivoAntes}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'crivoAntes',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.crivoDepois}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'crivoDepois',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.eletrodoSup}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'eletrodoSup',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.eletrodoInf}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'eletrodoInf',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.tuboEdutor}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'tuboEdutor',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.especificacaoBomba}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'especificacaoBomba',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.painelEletrico}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'painelEletrico',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1 text-center">
                          <input
                            type="checkbox"
                            checked={it.linha.simularTesteVazao}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'simularTesteVazao',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300 text-[#E8A020]"
                          />
                        </td>
                        <td className="p-1">
                          <select
                            value={it.linha.duracaoTesteLabel}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'duracaoTesteLabel',
                                e.target.value
                              )
                            }
                            className={`${cellInput} font-mono`}
                          >
                            {DURACOES_PERMITIDAS.map((op) => (
                              <option key={op.valor} value={op.valor}>
                                {op.valor}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.equipeTexto}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'equipeTexto',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.materiaisTexto}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'materiaisTexto',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.servicosTexto}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'servicosTexto',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={it.linha.observacoesCampo}
                            onChange={(e) =>
                              handleAtualizarCampoItem(
                                it.id,
                                'observacoesCampo',
                                e.target.value
                              )
                            }
                            className={cellInput}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

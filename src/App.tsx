import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RelatorioTecnico,
  FotoRegistro,
  DadosCabecalho,
  DadosPocoArtesiano,
  CadastroPoco,
  CadastroCliente,
  TemplateServico,
  SecaoNavegacao,
  MembroEquipe,
  ItemServicoConduzido,
  ItemMaterialAplicado,
  NarrativasOcorrencias,
  DadosTesteVazaoSEMA,
} from './types/relatorio';
import {
  CABECALHO_INSTITUCIONAL_PADRAO,
  TIPOS_SERVICO_PADRAO,
  normalizarTipoServico,
  TEMPLATES_SERVICO,
  criarRelatorioEmBranco,
  gerarLogoGeoestePadrao,
  gerarUuidV4,
  relatorioTemDadosReais,
  limparBancoLocalLegado,
} from './services/relatorioDefaults';
import {
  exportarRelatorioPDF,
  exportarPDFTesteBombeamentoGeoeste,
} from './services/pdfExportService';
import { isSupabaseConfigured } from './services/supabaseClient';
import {
  listarRelatoriosSupabase,
  salvarRelatorioSupabase,
  excluirRelatorioSupabase,
  listarPocosSupabase,
  salvarPocoSupabase,
  excluirPocoSupabase,
  listarClientesSupabase,
  salvarClienteSupabase,
  excluirClienteSupabase,
  sincronizarClientesComPocosSupabase,
  carregarTodosTemplatesSupabase,
  salvarTemplateSupabase,
  excluirTemplateSupabase,
  zerarDadosOperacionaisSupabase,
  verificarTabelasSupabase,
  SQL_COMPLETO_TABELAS_SUPABASE,
  StatusTabelaSupabase,
} from './services/supabaseService';
import { useAuth } from './services/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { ImageCropModal, ArquivoParaCorte } from './components/ImageCropModal';
import { A4Preview } from './components/A4Preview';
import { ClientesManager } from './components/ClientesManager';
import { PocosManager } from './components/PocosManager';
import { StepDrawdownSection } from './components/StepDrawdownSection';
import { TemplateManagerModal } from './components/TemplateManagerModal';
import { SignatureSection } from './components/SignatureSection';
import {
  ImportarOSCampoModal,
  DadosExtraidosOSCampo,
} from './components/ImportarOSCampoModal';
import {
  ModalLancamentoRapidoHistorico,
  LinhaLancamentoHistoricoOS,
  gerarDadosTesteSimuladoParaHistorico,
} from './components/ModalLancamentoRapidoHistorico';
import { ConversorLotePDFSection } from './components/ConversorLotePDFSection';
import { PocoLocationMap } from './components/PocoLocationMap';
import { DetectorAquiferoCard } from './components/DetectorAquiferoCard';
import { DimensionamentoBombaSection } from './components/DimensionamentoBombaSection';
import { ModalAuditoriaHidrogeologica } from './components/ModalAuditoriaHidrogeologica';
import {
  executarAuditoriaDeterministicaRelatorio,
  montarPayloadParecerHidrogeologico,
  ResultadoAuditoriaRelatorio,
} from './utils/auditoriaRelatorio';
import {
  obterPocosDoCliente,
  pertenceAoCliente,
  normalizarTextoCliente,
} from './utils/clienteMatch';
import {
  Building2,
  Droplets,
  PenTool,
  Wrench,
  Package,
  CheckSquare,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Upload,
  FileDown,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  Check,
  AlertCircle,
  Copy,
  Sparkles,
  Image as ImageIcon,
  FolderOpen,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  Database,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Cloud,
  LogOut,
  FolderCog,
  BookmarkPlus,
  BookmarkCheck,
  ShieldCheck,
  ShieldAlert,
  Users,
  FileSpreadsheet,
} from 'lucide-react';

const SECOES_SIDEBAR: {
  id: SecaoNavegacao;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'cadastro_clientes', label: 'Cadastro de Clientes', icon: Users },
  { id: 'cadastro_pocos', label: 'Cadastro de Poços', icon: Database },
  { id: 'conversor_lote', label: 'Conversor PDF / Lote', icon: FileSpreadsheet },
  { id: 'identificacao', label: 'Identificação', icon: Building2 },
  { id: 'poco', label: 'Dados do Poço', icon: Droplets },
  { id: 'servicos', label: 'Serviços Executados', icon: Wrench },
  { id: 'materiais', label: 'Materiais Aplicados', icon: Package },
  { id: 'checklist', label: 'Checklist de Qualidade', icon: CheckSquare },
  { id: 'fotos', label: 'Registro Fotográfico', icon: ImageIcon },
  { id: 'ocorrencias', label: 'Ocorrências de Campo', icon: AlertTriangle },
  { id: 'assinaturas', label: 'Termo & Assinaturas', icon: PenTool },
  { id: 'preview', label: 'Laudo A4 / PDF', icon: FileText },
];

export default function App() {
  const { estaAutenticado, carregando: authCarregando, logout: authLogout, user: authUser } = useAuth();

  const [modoEscuro, setModoEscuro] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('relatorpro_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (modoEscuro) {
      root.classList.add('dark');
      window.localStorage.setItem('relatorpro_theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('relatorpro_theme', 'light');
    }
  }, [modoEscuro]);

  const [clientesCadastrados, setClientesCadastrados] = useState<
    CadastroCliente[]
  >([]);
  const [pocosCadastrados, setPocosCadastrados] = useState<CadastroPoco[]>([]);
  const [pocoProntuarioSelecionadoUuid, setPocoProntuarioSelecionadoUuid] =
    useState<string>('');
  const [relatoriosSalvos, setRelatoriosSalvos] = useState<RelatorioTecnico[]>(
    []
  );
  const [logoEmpresaSessao, setLogoEmpresaSessao] = useState<string>(() =>
    gerarLogoGeoestePadrao()
  );
  const [relatorioAtivo, setRelatorioAtivo] = useState<RelatorioTecnico>(() =>
    criarRelatorioEmBranco()
  );
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoNavegacao>('identificacao');
  const [modalHistoricoAberto, setModalHistoricoAberto] =
    useState<boolean>(false);
  const [carregandoSupabase, setCarregandoSupabase] = useState<boolean>(false);
  const [modalResetAberto, setModalResetAberto] = useState<boolean>(false);
  const [confirmacaoTextoReset, setConfirmacaoTextoReset] = useState<string>('');
  const [executandoReset, setExecutandoReset] = useState<boolean>(false);
  const [erroReset, setErroReset] = useState<string | null>(null);
  const [statusTabelasSupabase, setStatusTabelasSupabase] = useState<
    StatusTabelaSupabase[]
  >([]);
  const [verificandoTabelas, setVerificandoTabelas] = useState<boolean>(false);
  const [mostrarSqlSupabase, setMostrarSqlSupabase] = useState<boolean>(false);
  const [sqlCopiado, setSqlCopiado] = useState<boolean>(false);
  const [buscaHistorico, setBuscaHistorico] = useState<string>('');
  const [filtroStatusHistorico, setFiltroStatusHistorico] = useState<
    'todos' | 'Concluído' | 'Em andamento' | 'Pendente'
  >('todos');
  const [modalNovoRelatorioAberto, setModalNovoRelatorioAberto] =
    useState<boolean>(false);
  const [editandoTimbreEmpresa, setEditandoTimbreEmpresa] =
    useState<boolean>(false);
  const [novoItemChecklistTexto, setNovoItemChecklistTexto] =
    useState<string>('');
  const [listaTemplates, setListaTemplates] = useState<TemplateServico[]>(
    () => TEMPLATES_SERVICO
  );
  const [modalGerenciarTemplatesAberta, setModalGerenciarTemplatesAberta] =
    useState<boolean>(false);
  const [modalImportarOSAberta, setModalImportarOSAberta] =
    useState<boolean>(false);
  const [modalLancamentoRapidoAberta, setModalLancamentoRapidoAberta] =
    useState<boolean>(false);
  const [filtroLancamentoRapido, setFiltroLancamentoRapido] = useState<{
    clienteUuid?: string;
    pocoUuid?: string;
  }>({});
  const [modalAuditoriaAberta, setModalAuditoriaAberta] =
    useState<boolean>(false);
  const [resultadoAuditoria, setResultadoAuditoria] =
    useState<ResultadoAuditoriaRelatorio | null>(null);
  const [carregandoAuditoriaIA, setCarregandoAuditoriaIA] =
    useState<boolean>(false);
  const [modoBloqueioExportacao, setModoBloqueioExportacao] =
    useState<boolean>(false);
  const [relatorioPendenteExportacao, setRelatorioPendenteExportacao] =
    useState<RelatorioTecnico | null>(null);

  const [erroSistema, setErroSistema] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    mensagem: string;
    tipo: 'success' | 'error';
  } | null>(null);
  const [horarioUltimoSave, setHorarioUltimoSave] = useState<string>('');
  const [salvandoAuto, setSalvandoAuto] = useState<boolean>(false);
  const [exportandoPdf, setExportandoPdf] = useState<boolean>(false);

  const [filaParaCorte, setFilaParaCorte] = useState<ArquivoParaCorte[]>([]);
  const inputFotosRef = useRef<HTMLInputElement | null>(null);
  const inputLogoRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const showToast = useCallback(
    (mensagem: string, tipo: 'success' | 'error' = 'success') => {
      setToast({ mensagem, tipo });
      window.setTimeout(() => {
        setToast((atual) => (atual?.mensagem === mensagem ? null : atual));
      }, 3500);
    },
    []
  );

  // Inicialização Exclusiva via Supabase (Nuvem) — sem banco local (IndexedDB) e sem semear dados de demonstração
  useEffect(() => {
    let ativo = true;
    async function inicializarBanco() {
      try {
        // Remove qualquer resquício do banco IndexedDB legado no navegador
        limparBancoLocalLegado().catch(() => {});

        if (!isSupabaseConfigured) {
          if (ativo) {
            setErroSistema(
              'Conexão com o Supabase não configurada. Verifique as credenciais em supabaseClient.ts.'
            );
            inicializadoRef.current = true;
          }
          return;
        }

        const [clientesNuvem, pocosNuvem, relatoriosNuvem, templatesNuvem] =
          await Promise.all([
            listarClientesSupabase(),
            listarPocosSupabase(),
            listarRelatoriosSupabase(),
            carregarTodosTemplatesSupabase(),
          ]);

        // Vincula poços aos respectivos clientes existentes no Supabase sem criar registros demo
        const { clientes, pocosAtualizados } =
          pocosNuvem.length > 0
            ? await sincronizarClientesComPocosSupabase(
                pocosNuvem,
                clientesNuvem
              )
            : { clientes: clientesNuvem, pocosAtualizados: [] };

        if (!ativo) return;

        setClientesCadastrados(clientes);
        setPocosCadastrados(pocosAtualizados);
        setRelatoriosSalvos(relatoriosNuvem);
        if (templatesNuvem && templatesNuvem.length > 0) {
          setListaTemplates(templatesNuvem);
        }

        if (relatoriosNuvem.length > 0) {
          setRelatorioAtivo(relatoriosNuvem[0]);
          if (relatoriosNuvem[0].cabecalho.logoBase64) {
            setLogoEmpresaSessao(relatoriosNuvem[0].cabecalho.logoBase64);
          }
        } else {
          setRelatorioAtivo(
            criarRelatorioEmBranco({
              ...CABECALHO_INSTITUCIONAL_PADRAO,
              logoBase64: gerarLogoGeoestePadrao(),
            })
          );
          setSecaoAtiva('identificacao');
        }

        inicializadoRef.current = true;
      } catch (err) {
        if (!ativo) return;
        setErroSistema(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar dados do Supabase.'
        );
        inicializadoRef.current = true;
      }
    }

    inicializarBanco();
    return () => {
      ativo = false;
    };
  }, []);

  // Auto-save contínuo direto no Supabase (somente quando o relatório possuir dados reais preenchidos)
  useEffect(() => {
    if (!inicializadoRef.current) return;
    if (!isSupabaseConfigured) return;
    if (!relatorioTemDadosReais(relatorioAtivo)) return;

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    setSalvandoAuto(true);
    autoSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const atualizado: RelatorioTecnico = {
          ...relatorioAtivo,
          atualizadoEm: Date.now(),
        };
        const res = await salvarRelatorioSupabase(atualizado);
        if (res.sucesso) {
          setRelatoriosSalvos((prev) => {
            const semAtual = prev.filter((r) => r.uuid !== atualizado.uuid);
            return [atualizado, ...semAtual].sort(
              (a, b) => b.atualizadoEm - a.atualizadoEm
            );
          });
          setHorarioUltimoSave(new Date().toLocaleTimeString('pt-BR'));
        }
      } catch {
        // Silencioso no auto-save
      } finally {
        setSalvandoAuto(false);
      }
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [relatorioAtivo]);

  // Cálculo de progresso idêntico ao projeto original (5 campos chave)
  const camposObrigatoriosProgresso = [
    relatorioAtivo.cabecalho.contratoOS,
    relatorioAtivo.cabecalho.dataExecucao,
    relatorioAtivo.cabecalho.cliente,
    relatorioAtivo.cabecalho.localizacao,
    relatorioAtivo.descricaoServico,
  ];
  const preenchidosCount = camposObrigatoriosProgresso.filter((v) =>
    Boolean(v && v.trim())
  ).length;
  const progressoPct = Math.round(
    (preenchidosCount / camposObrigatoriosProgresso.length) * 100
  );

  // Persistência manual explícita direto no Supabase
  const handlePersistirManual = async () => {
    if (!relatorioAtivo.cabecalho.contratoOS.trim()) {
      showToast(
        'Defina um Número de O.S. para conseguir salvar o relatório!',
        'error'
      );
      setSecaoAtiva('identificacao');
      return;
    }

    try {
      const atualizado: RelatorioTecnico = {
        ...relatorioAtivo,
        atualizadoEm: Date.now(),
      };
      const resNuvem = await salvarRelatorioSupabase(atualizado);
      if (resNuvem.sucesso) {
        const listaNuvem = await listarRelatoriosSupabase();
        setRelatoriosSalvos(listaNuvem);
        setHorarioUltimoSave(new Date().toLocaleTimeString('pt-BR'));
        showToast('Relatório salvo no Supabase com sucesso!', 'success');
      } else {
        showToast(
          `Erro ao salvar no Supabase: ${resNuvem.erro || 'Falha de comunicação'}`,
          'error'
        );
      }
    } catch {
      showToast('Erro ao salvar relatório no Supabase.', 'error');
    }
  };

  // Operações do Cadastro de Clientes (Exclusivamente Supabase)
  const handleSalvarClienteNoBanco = async (cliente: CadastroCliente) => {
    try {
      const registro: CadastroCliente = {
        ...cliente,
        uuid: cliente.uuid || gerarUuidV4(),
        atualizadoEm: Date.now(),
      };
      const ok = await salvarClienteSupabase(registro);
      if (!ok) {
        showToast('Erro ao salvar cadastro do cliente no Supabase.', 'error');
        return;
      }

      // Atualiza nome/CNPJ nos poços já vinculados a este cliente
      const pocosAtualizar = pocosCadastrados.filter(
        (p) => p.clienteUuid === registro.uuid
      );
      if (pocosAtualizar.length > 0) {
        for (const p of pocosAtualizar) {
          if (
            p.cliente !== registro.razaoSocial ||
            (registro.cnpjCpf && p.clienteCNPJ !== registro.cnpjCpf)
          ) {
            await salvarPocoSupabase({
              ...p,
              cliente: registro.razaoSocial,
              clienteCNPJ: registro.cnpjCpf || p.clienteCNPJ,
              atualizadoEm: Date.now(),
            });
          }
        }
      }

      const [clientesNuvem, pocosNuvem] = await Promise.all([
        listarClientesSupabase(),
        listarPocosSupabase(),
      ]);
      const sincronizado = await sincronizarClientesComPocosSupabase(
        pocosNuvem,
        clientesNuvem
      );
      setClientesCadastrados(sincronizado.clientes);
      setPocosCadastrados(sincronizado.pocosAtualizados);

      showToast(
        `Cliente "${registro.razaoSocial}" salvo no Supabase com sucesso!`,
        'success'
      );
    } catch {
      showToast('Erro ao salvar cadastro do cliente no Supabase.', 'error');
    }
  };

  const handleExcluirClienteDoBanco = async (uuid: string) => {
    try {
      const ok = await excluirClienteSupabase(uuid);
      if (!ok) {
        showToast('Erro ao excluir cliente no Supabase.', 'error');
        return;
      }
      const listaClientes = await listarClientesSupabase();
      setClientesCadastrados(listaClientes);
      showToast('Cliente removido do Supabase.', 'success');
    } catch {
      showToast('Erro ao excluir cliente.', 'error');
    }
  };

  // Operações do Cadastro de Poços (Exclusivamente Supabase)
  const handleSalvarPocoNoBanco = async (poco: CadastroPoco) => {
    try {
      const registro: CadastroPoco = {
        ...poco,
        uuid: poco.uuid || gerarUuidV4(),
        atualizadoEm: Date.now(),
      };
      const ok = await salvarPocoSupabase(registro);
      if (!ok) {
        showToast('Erro ao salvar cadastro do poço no Supabase.', 'error');
        return;
      }
      const [listaAtualizada, listaClientes] = await Promise.all([
        listarPocosSupabase(),
        listarClientesSupabase(),
      ]);
      const sincronizado = await sincronizarClientesComPocosSupabase(
        listaAtualizada,
        listaClientes
      );
      setClientesCadastrados(sincronizado.clientes);
      setPocosCadastrados(sincronizado.pocosAtualizados);
      showToast(
        `Poço ${registro.tag} (${registro.nomeIdentificacao}) salvo no Supabase!`,
        'success'
      );
    } catch {
      showToast('Erro ao salvar cadastro do poço no Supabase.', 'error');
    }
  };

  const handleExcluirPocoDoBanco = async (uuid: string) => {
    try {
      const ok = await excluirPocoSupabase(uuid);
      if (!ok) {
        showToast('Erro ao excluir poço no Supabase.', 'error');
        return;
      }
      const [listaAtualizada, listaClientes] = await Promise.all([
        listarPocosSupabase(),
        listarClientesSupabase(),
      ]);
      const sincronizado = await sincronizarClientesComPocosSupabase(
        listaAtualizada,
        listaClientes
      );
      setPocosCadastrados(sincronizado.pocosAtualizados);
      showToast('Poço removido do Supabase.', 'success');
    } catch {
      showToast('Erro ao excluir poço.', 'error');
    }
  };

  const handleMesclarPocosNoBanco = async (
    pocoOrigemUuid: string,
    pocoDestinoUuid: string
  ) => {
    if (!pocoOrigemUuid || !pocoDestinoUuid || pocoOrigemUuid === pocoDestinoUuid) {
      showToast('Selecione dois poços diferentes para juntar os cadastros.', 'error');
      return;
    }

    const origem = pocosCadastrados.find((p) => p.uuid === pocoOrigemUuid);
    const destino = pocosCadastrados.find((p) => p.uuid === pocoDestinoUuid);
    if (!origem || !destino) {
      showToast('Poço de origem ou destino não encontrado.', 'error');
      return;
    }

    try {
      const ehDoOrigem = (rel: RelatorioTecnico) => {
        if (rel.pocoUuid && rel.pocoUuid === origem.uuid) return true;
        const mesmaTag =
          normalizarTextoCliente(rel.dadosPoco?.pocoId || '') ===
          normalizarTextoCliente(origem.tag);
        const mesmoCliente =
          normalizarTextoCliente(rel.cabecalho.cliente) ===
          normalizarTextoCliente(origem.cliente);
        return !rel.pocoUuid && mesmaTag && mesmoCliente;
      };

      const relatoriosParaMover = relatoriosSalvos.filter(ehDoOrigem);
      let movidos = 0;

      for (const rel of relatoriosParaMover) {
        const atualizado: RelatorioTecnico = {
          ...rel,
          clienteUuid: destino.clienteUuid || rel.clienteUuid,
          pocoUuid: destino.uuid,
          cabecalho: {
            ...rel.cabecalho,
            cliente: destino.cliente || rel.cabecalho.cliente,
            clienteCNPJ: destino.clienteCNPJ || rel.cabecalho.clienteCNPJ,
          },
          dadosPoco: {
            ...rel.dadosPoco,
            pocoId: destino.tag,
          },
          atualizadoEm: Date.now(),
        };
        await salvarRelatorioSupabase(atualizado);
        movidos++;
      }

      const preencherSeVazio = (atual?: string, fallback?: string) => {
        const a = (atual || '').trim();
        if (!a || a.includes('[DADO A PREENCHER')) {
          return (fallback || '').trim() || atual || '';
        }
        return atual || '';
      };

      const obsCombinada =
        destino.observacoesTecnicas &&
        origem.observacoesTecnicas &&
        destino.observacoesTecnicas !== origem.observacoesTecnicas
          ? `${destino.observacoesTecnicas}\n[Mesclado de ${origem.tag}]: ${origem.observacoesTecnicas}`
          : destino.observacoesTecnicas || origem.observacoesTecnicas || '';

      const destinoAtualizado: CadastroPoco = {
        ...destino,
        nomeIdentificacao: preencherSeVazio(
          destino.nomeIdentificacao,
          origem.nomeIdentificacao
        ),
        enderecoLocal: preencherSeVazio(
          destino.enderecoLocal,
          origem.enderecoLocal
        ),
        cidadeUF: preencherSeVazio(destino.cidadeUF, origem.cidadeUF),
        coordenadasUTM: preencherSeVazio(
          destino.coordenadasUTM,
          origem.coordenadasUTM
        ),
        contatoLocal: preencherSeVazio(destino.contatoLocal, origem.contatoLocal),
        telefoneContato: preencherSeVazio(
          destino.telefoneContato,
          origem.telefoneContato
        ),
        profundidadeTotal: preencherSeVazio(
          destino.profundidadeTotal,
          origem.profundidadeTotal
        ),
        diametroRevestimento: preencherSeVazio(
          destino.diametroRevestimento,
          origem.diametroRevestimento
        ),
        dataPerfuracao: destino.dataPerfuracao || origem.dataPerfuracao,
        numeroOutorga: preencherSeVazio(
          destino.numeroOutorga,
          origem.numeroOutorga
        ),
        aquiferoLitologia: preencherSeVazio(
          destino.aquiferoLitologia,
          origem.aquiferoLitologia
        ),
        crivoPadrao: preencherSeVazio(destino.crivoPadrao, origem.crivoPadrao),
        tuboEdutorPadrao: preencherSeVazio(
          destino.tuboEdutorPadrao,
          origem.tuboEdutorPadrao
        ),
        eletrodoSuperiorPadrao: preencherSeVazio(
          destino.eletrodoSuperiorPadrao,
          origem.eletrodoSuperiorPadrao
        ),
        eletrodoInferiorPadrao: preencherSeVazio(
          destino.eletrodoInferiorPadrao,
          origem.eletrodoInferiorPadrao
        ),
        bombaAtual: preencherSeVazio(destino.bombaAtual, origem.bombaAtual),
        painelAtual: preencherSeVazio(destino.painelAtual, origem.painelAtual),
        observacoesTecnicas: obsCombinada,
        atualizadoEm: Date.now(),
      };

      await salvarPocoSupabase(destinoAtualizado);
      await excluirPocoSupabase(origem.uuid);

      const [listaPocos, listaRelatorios, listaClientes] = await Promise.all([
        listarPocosSupabase(),
        listarRelatoriosSupabase(),
        listarClientesSupabase(),
      ]);
      const sincronizado = await sincronizarClientesComPocosSupabase(
        listaPocos,
        listaClientes
      );
      setClientesCadastrados(sincronizado.clientes);
      setPocosCadastrados(sincronizado.pocosAtualizados);
      setRelatoriosSalvos(listaRelatorios);
      setPocoProntuarioSelecionadoUuid(destino.uuid);

      setRelatorioAtivo((prev) => {
        if (!ehDoOrigem(prev)) return prev;
        return {
          ...prev,
          clienteUuid: destino.clienteUuid || prev.clienteUuid,
          pocoUuid: destino.uuid,
          cabecalho: {
            ...prev.cabecalho,
            cliente: destino.cliente || prev.cabecalho.cliente,
            clienteCNPJ: destino.clienteCNPJ || prev.cabecalho.clienteCNPJ,
          },
          dadosPoco: {
            ...prev.dadosPoco,
            pocoId: destino.tag,
          },
        };
      });

      showToast(
        `Cadastros unidos! "${origem.tag}" foi mesclado em "${destino.tag}" com ${movidos} O.S. transferida(s).`,
        'success'
      );
    } catch {
      showToast('Erro ao mesclar os cadastros de poços.', 'error');
    }
  };

  // Seleciona cliente na etapa Identificação e filtra os poços exibidos exclusivamente para ele
  const handleSelecionarClienteNaIdentificacao = (clienteUuid: string) => {
    if (!clienteUuid) {
      setRelatorioAtivo((prev) => ({
        ...prev,
        clienteUuid: undefined,
      }));
      return;
    }

    const cli = clientesCadastrados.find((c) => c.uuid === clienteUuid);
    if (!cli) return;

    setRelatorioAtivo((prev) => {
      const pocoAtual = pocosCadastrados.find((p) => p.uuid === prev.pocoUuid);
      const pocoPertence = pocoAtual ? pertenceAoCliente(pocoAtual, cli) : false;

      return {
        ...prev,
        clienteUuid: cli.uuid,
        pocoUuid: pocoPertence ? prev.pocoUuid : undefined,
        cabecalho: {
          ...prev.cabecalho,
          cliente: cli.razaoSocial,
          clienteCNPJ: cli.cnpjCpf || prev.cabecalho.clienteCNPJ,
          cidadeUF: cli.cidadeUF || prev.cabecalho.cidadeUF,
          contatoLocal: cli.contatoPrincipal || prev.cabecalho.contatoLocal,
          telefoneContato: cli.telefone || prev.cabecalho.telefoneContato,
        },
      };
    });

    const qtdPocos = obterPocosDoCliente(pocosCadastrados, cli).length;
    showToast(
      `Cliente "${cli.razaoSocial}" selecionado (${qtdPocos} ${
        qtdPocos === 1 ? 'poço cadastrado' : 'poços cadastrados'
      }).`,
      'success'
    );
  };

  // Vincula um poço cadastrado ao relatório atual (preenche dados fixos e mantém NE/ND/Vazão editáveis para a visita)
  const handleVincularPocoAoRelatorioAtivo = (pocoUuid: string) => {
    if (!pocoUuid) {
      setRelatorioAtivo((prev) => ({
        ...prev,
        pocoUuid: undefined,
      }));
      return;
    }

    const poco = pocosCadastrados.find((p) => p.uuid === pocoUuid);
    if (!poco) return;

    const clienteDoPoco =
      clientesCadastrados.find((c) => c.uuid === poco.clienteUuid) ||
      clientesCadastrados.find(
        (c) =>
          normalizarTextoCliente(c.razaoSocial) ===
          normalizarTextoCliente(poco.cliente)
      );

    setRelatorioAtivo((prev) => ({
      ...prev,
      clienteUuid: clienteDoPoco?.uuid || poco.clienteUuid || prev.clienteUuid,
      pocoUuid: poco.uuid,
      cabecalho: {
        ...prev.cabecalho,
        cliente: poco.cliente || prev.cabecalho.cliente,
        clienteCNPJ: poco.clienteCNPJ || prev.cabecalho.clienteCNPJ,
        localizacao: poco.enderecoLocal || prev.cabecalho.localizacao,
        cidadeUF: poco.cidadeUF || prev.cabecalho.cidadeUF,
        contatoLocal: poco.contatoLocal || prev.cabecalho.contatoLocal,
        telefoneContato: poco.telefoneContato || prev.cabecalho.telefoneContato,
      },
      dadosPoco: {
        ...prev.dadosPoco,
        incluirNoRelatorio: true,
        pocoId: poco.tag,
        profundidadeTotal:
          poco.profundidadeTotal || prev.dadosPoco.profundidadeTotal,
        diametroRevestimento:
          poco.diametroRevestimento || prev.dadosPoco.diametroRevestimento,
        crivo: poco.crivoPadrao || prev.dadosPoco.crivo,
        tuboEdutor: poco.tuboEdutorPadrao || prev.dadosPoco.tuboEdutor,
        eletrodoSuperior:
          poco.eletrodoSuperiorPadrao || prev.dadosPoco.eletrodoSuperior,
        eletrodoInferior:
          poco.eletrodoInferiorPadrao || prev.dadosPoco.eletrodoInferior,
        coordenadasUTM: poco.coordenadasUTM || prev.dadosPoco.coordenadasUTM,
        aquiferoLitologia:
          poco.aquiferoLitologia || prev.dadosPoco.aquiferoLitologia,
        especificacaoBomba:
          poco.bombaAtual || prev.dadosPoco.especificacaoBomba,
        painelEletrico: poco.painelAtual || prev.dadosPoco.painelEletrico,
      },
    }));

    showToast(
      `Poço ${poco.tag} vinculado! Dados construtivos e de cliente preenchidos. Informe NE, ND e Vazão desta visita.`,
      'success'
    );
  };

  // Inicia uma nova O.S. diretamente a partir da tela de Cadastro de Poços
  const handleIniciarNovaOSNoPoco = async (poco: CadastroPoco) => {
    try {
      const novo = criarRelatorioEmBranco(
        {
          razaoSocial: relatorioAtivo.cabecalho.razaoSocial,
          cnpj: relatorioAtivo.cabecalho.cnpj,
          enderecoEmpresa: relatorioAtivo.cabecalho.enderecoEmpresa,
          cidadeContatoEmpresa: relatorioAtivo.cabecalho.cidadeContatoEmpresa,
          emailEmpresa: relatorioAtivo.cabecalho.emailEmpresa,
          logoBase64: logoEmpresaSessao || relatorioAtivo.cabecalho.logoBase64,
        },
        poco
      );
      setRelatorioAtivo(novo);
      setSecaoAtiva('identificacao');
      showToast(
        `Nova O.S. iniciada para o poço ${poco.tag} (${poco.cliente})!`,
        'success'
      );
    } catch {
      showToast('Erro ao criar nova O.S. para este poço.', 'error');
    }
  };

  // Salva ou atualiza os dados do relatório atual diretamente no Cadastro de Poços
  const handleSalvarDadosAtuaisNoCadastroPoco = async () => {
    const tag = relatorioAtivo.dadosPoco.pocoId.trim();
    const cliente = relatorioAtivo.cabecalho.cliente.trim();

    if (!tag || !cliente) {
      showToast(
        'Preencha ao menos a TAG do Poço (ex: PT01) e o Cliente antes de salvar no Cadastro de Poços.',
        'error'
      );
      return;
    }

    const clienteMatch =
      clientesCadastrados.find((c) => c.uuid === relatorioAtivo.clienteUuid) ||
      clientesCadastrados.find(
        (c) =>
          normalizarTextoCliente(c.razaoSocial) ===
          normalizarTextoCliente(cliente)
      );

    const existente = pocosCadastrados.find(
      (p) =>
        p.uuid === relatorioAtivo.pocoUuid ||
        (p.tag.trim().toLowerCase() === tag.toLowerCase() &&
          normalizarTextoCliente(p.cliente) === normalizarTextoCliente(cliente))
    );

    const agora = Date.now();
    const registroPoco: CadastroPoco = {
      uuid:
        existente?.uuid ||
        `poco-${agora}-${Math.random().toString(36).slice(2, 7)}`,
      clienteUuid: clienteMatch?.uuid || existente?.clienteUuid || '',
      tag,
      nomeIdentificacao:
        existente?.nomeIdentificacao || `Poço ${tag} — ${cliente}`,
      cliente,
      clienteCNPJ:
        relatorioAtivo.cabecalho.clienteCNPJ || existente?.clienteCNPJ || '',
      enderecoLocal:
        relatorioAtivo.cabecalho.localizacao || existente?.enderecoLocal || '',
      cidadeUF:
        relatorioAtivo.cabecalho.cidadeUF ||
        existente?.cidadeUF ||
        'Sorriso - MT',
      coordenadasUTM:
        relatorioAtivo.dadosPoco.coordenadasUTM ||
        existente?.coordenadasUTM ||
        '',
      contatoLocal:
        relatorioAtivo.cabecalho.contatoLocal || existente?.contatoLocal || '',
      telefoneContato:
        relatorioAtivo.cabecalho.telefoneContato ||
        existente?.telefoneContato ||
        '',
      profundidadeTotal:
        relatorioAtivo.dadosPoco.profundidadeTotal ||
        existente?.profundidadeTotal ||
        '',
      diametroRevestimento:
        relatorioAtivo.dadosPoco.diametroRevestimento ||
        existente?.diametroRevestimento ||
        '',
      dataPerfuracao: existente?.dataPerfuracao || '',
      numeroOutorga: existente?.numeroOutorga || '',
      aquiferoLitologia:
        relatorioAtivo.dadosPoco.aquiferoLitologia ||
        existente?.aquiferoLitologia ||
        '',
      crivoPadrao:
        relatorioAtivo.dadosPoco.crivo || existente?.crivoPadrao || '',
      tuboEdutorPadrao:
        relatorioAtivo.dadosPoco.tuboEdutor ||
        existente?.tuboEdutorPadrao ||
        '',
      eletrodoSuperiorPadrao:
        relatorioAtivo.dadosPoco.eletrodoSuperior ||
        existente?.eletrodoSuperiorPadrao ||
        '',
      eletrodoInferiorPadrao:
        relatorioAtivo.dadosPoco.eletrodoInferior ||
        existente?.eletrodoInferiorPadrao ||
        '',
      bombaAtual:
        relatorioAtivo.dadosPoco.especificacaoBomba ||
        existente?.bombaAtual ||
        '',
      painelAtual:
        relatorioAtivo.dadosPoco.painelEletrico || existente?.painelAtual || '',
      observacoesTecnicas: existente?.observacoesTecnicas || '',
      criadoEm: existente?.criadoEm || agora,
      atualizadoEm: agora,
    };

    try {
      const ok = await salvarPocoSupabase(registroPoco);
      if (!ok) {
        showToast('Erro ao salvar poço no Supabase.', 'error');
        return;
      }
      const [lista, listaClientes] = await Promise.all([
        listarPocosSupabase(),
        listarClientesSupabase(),
      ]);
      const sincronizado = await sincronizarClientesComPocosSupabase(
        lista,
        listaClientes
      );
      setClientesCadastrados(sincronizado.clientes);
      setPocosCadastrados(sincronizado.pocosAtualizados);
      const pocoSincronizado = sincronizado.pocosAtualizados.find(
        (p) => p.uuid === registroPoco.uuid
      );
      setRelatorioAtivo((prev) => ({
        ...prev,
        clienteUuid: pocoSincronizado?.clienteUuid || prev.clienteUuid,
        pocoUuid: registroPoco.uuid,
      }));
      showToast(
        existente
          ? `Ficha cadastral do poço ${registroPoco.tag} atualizada no Supabase!`
          : `Poço ${registroPoco.tag} cadastrado no Supabase e vinculado a este relatório!`,
        'success'
      );
    } catch {
      showToast('Erro ao salvar poço no Supabase.', 'error');
    }
  };

  // Atualizadores de estado
  const atualizarCabecalho = <K extends keyof DadosCabecalho>(
    campo: K,
    valor: DadosCabecalho[K]
  ) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      cabecalho: {
        ...prev.cabecalho,
        [campo]: valor,
      },
    }));
  };

  const atualizarDadosPoco = <K extends keyof DadosPocoArtesiano>(
    campo: K,
    valor: DadosPocoArtesiano[K]
  ) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      dadosPoco: {
        ...prev.dadosPoco,
        [campo]: valor,
      },
    }));
  };

  const atualizarOcorrencias = <K extends keyof NarrativasOcorrencias>(
    campo: K,
    valor: NarrativasOcorrencias[K]
  ) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      ocorrenciasCampo: {
        ...prev.ocorrenciasCampo,
        [campo]: valor,
      },
    }));
  };

  // Upload de Logotipo
  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const maxW = 566;
        const maxH = 160;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          setLogoEmpresaSessao(dataUrl);
          atualizarCabecalho('logoBase64', dataUrl);
          showToast(
            'Logotipo institucional atualizado com sucesso!',
            'success'
          );
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Tabelas Dinâmicas: Equipe, Serviços Conduzidos, Materiais Aplicados
  const adicionarMembroEquipe = () => {
    const novo: MembroEquipe = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: '',
      funcao: '',
    };
    setRelatorioAtivo((prev) => ({
      ...prev,
      equipe: [...prev.equipe, novo],
    }));
  };

  const atualizarMembroEquipe = (
    id: string,
    campo: 'nome' | 'funcao',
    valor: string
  ) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      equipe: prev.equipe.map((m) =>
        m.id === id ? { ...m, [campo]: valor } : m
      ),
    }));
  };

  const removerMembroEquipe = (id: string) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      equipe: prev.equipe.filter((m) => m.id !== id),
    }));
  };

  const adicionarServicoRow = () => {
    const novo: ItemServicoConduzido = {
      id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      descricao: '',
      unidade: 'UN',
      quantidade: '1',
      status: 'Executado',
    };
    setRelatorioAtivo((prev) => ({
      ...prev,
      servicosConduzidos: [...prev.servicosConduzidos, novo],
    }));
  };

  const atualizarServicoRow = <K extends keyof ItemServicoConduzido>(
    id: string,
    campo: K,
    valor: ItemServicoConduzido[K]
  ) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      servicosConduzidos: prev.servicosConduzidos.map((s) =>
        s.id === id ? { ...s, [campo]: valor } : s
      ),
    }));
  };

  const removerServicoRow = (id: string) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      servicosConduzidos: prev.servicosConduzidos.filter((s) => s.id !== id),
    }));
  };

  const adicionarMaterialRow = () => {
    const novo: ItemMaterialAplicado = {
      id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      descricao: '',
      unidade: 'Metro',
      quantidade: '1',
      situacao: 'Aplicado',
    };
    setRelatorioAtivo((prev) => ({
      ...prev,
      materiaisAplicados: [...prev.materiaisAplicados, novo],
    }));
  };

  const atualizarMaterialRow = <K extends keyof ItemMaterialAplicado>(
    id: string,
    campo: K,
    valor: ItemMaterialAplicado[K]
  ) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      materiaisAplicados: prev.materiaisAplicados.map((m) =>
        m.id === id ? { ...m, [campo]: valor } : m
      ),
    }));
  };

  const removerMaterialRow = (id: string) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      materiaisAplicados: prev.materiaisAplicados.filter((m) => m.id !== id),
    }));
  };

  // Checklist de Conformidade
  const alternarItemChecklist = (id: string) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id ? { ...item, concluido: !item.concluido } : item
      ),
    }));
  };

  const adicionarItemChecklistCustom = () => {
    const texto = novoItemChecklistTexto.trim();
    if (!texto) return;
    setRelatorioAtivo((prev) => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        {
          id: `chk_custom_${Date.now()}`,
          texto,
          concluido: true,
        },
      ],
    }));
    setNovoItemChecklistTexto('');
  };

  // Templates de Memorial Descritivo
  const aplicarTemplateDescricao = (tpl: TemplateServico) => {
    setRelatorioAtivo((prev) => {
      const atual = prev.descricaoServico.trim();
      return {
        ...prev,
        descricaoServico: atual ? `${atual}\n\n${tpl.conteudo}` : tpl.conteudo,
      };
    });
    showToast(`Template "${tpl.titulo}" inserido no Memorial Descritivo!`);
  };

  const handleSalvarTemplateCustom = async (dados: {
    id?: string;
    titulo: string;
    categoria: string;
    conteudo: string;
  }) => {
    const template: TemplateServico = {
      id:
        dados.id ||
        `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      titulo: dados.titulo.trim() || 'Template Sem Título',
      categoria: dados.categoria.trim() || 'Personalizado',
      conteudo: dados.conteudo.trim(),
      isCustom: true,
      criadoEm: Date.now(),
    };
    const ok = await salvarTemplateSupabase(template);
    if (!ok) {
      showToast('Erro ao salvar template no Supabase.', 'error');
    }
    const atualizados = await carregarTodosTemplatesSupabase();
    setListaTemplates(atualizados);
  };

  const handleExcluirTemplateCustom = async (id: string) => {
    const ok = await excluirTemplateSupabase(id);
    if (!ok) {
      showToast('Erro ao excluir template no Supabase.', 'error');
    }
    const atualizados = await carregarTodosTemplatesSupabase();
    setListaTemplates(atualizados);
  };

  // Aplica os dados extraídos de um PDF ou Foto de Ordem de Serviço Manuscrita
  const handleAplicarDadosOSCampo = async (
    dados: DadosExtraidosOSCampo,
    modo: 'atual' | 'novo'
  ) => {
    const base =
      modo === 'novo'
        ? criarRelatorioEmBranco(relatorioAtivo.cabecalho)
        : relatorioAtivo;

    const templatePreventiva = listaTemplates.find(
      (t) => t.id === 'manutencao-preventiva-completa'
    );

    const mudouCidadeOuOS =
      modo === 'novo' ||
      (Boolean(dados.cidadeUF) &&
        dados.cidadeUF !== base.cabecalho.cidadeUF);
    const coordsBaseLimpa =
      mudouCidadeOuOS &&
      base.dadosPoco.coordenadasGeograficas?.includes('-21.1767')
        ? ''
        : base.dadosPoco.coordenadasGeograficas;
    const coordsCabecalhoLimpas =
      mudouCidadeOuOS &&
      base.cabecalho.coordenadasGeograficas?.includes('-21.1767')
        ? ''
        : base.cabecalho.coordenadasGeograficas;

    const novoRelatorio: RelatorioTecnico = {
      ...base,
      atualizadoEm: Date.now(),
      cabecalho: {
        ...base.cabecalho,
        contratoOS: dados.numeroOS || base.cabecalho.contratoOS,
        contratoRef: dados.contratoRef || base.cabecalho.contratoRef,
        tipoServico: normalizarTipoServico(
          dados.tipoServico || base.cabecalho.tipoServico,
          'Manutenção Preventiva'
        ),
        statusOS: 'Concluído',
        cliente: dados.cliente || base.cabecalho.cliente,
        contatoLocal:
          dados.contatoLocal ||
          dados.nomeRepresentanteCliente ||
          base.cabecalho.contatoLocal,
        telefoneContato:
          dados.telefoneContato || base.cabecalho.telefoneContato,
        localizacao: dados.localizacao || base.cabecalho.localizacao,
        cidadeUF: dados.cidadeUF || base.cabecalho.cidadeUF,
        coordenadasGeograficas: coordsCabecalhoLimpas,
        dataExecucao: dados.dataExecucaoISO || base.cabecalho.dataExecucao,
      },
      dadosPoco: {
        ...base.dadosPoco,
        incluirNoRelatorio: true,
        pocoId: dados.pocoTag || base.dadosPoco.pocoId || 'PT-01',
        profundidadeTotal:
          dados.profundidadeTotal || base.dadosPoco.profundidadeTotal,
        diametroRevestimento:
          dados.diametroRevestimento || base.dadosPoco.diametroRevestimento,
        nivelEstaticoInicial:
          dados.nivelEstaticoInicial ||
          dados.nivelEstatico ||
          base.dadosPoco.nivelEstaticoInicial,
        nivelEstatico: dados.nivelEstatico || base.dadosPoco.nivelEstatico,
        nivelDinamicoInicial:
          dados.nivelDinamicoInicial ||
          dados.nivelDinamico ||
          base.dadosPoco.nivelDinamicoInicial,
        nivelDinamico: dados.nivelDinamico || base.dadosPoco.nivelDinamico,
        vazaoInicial:
          dados.vazaoInicial || dados.vazaoTeste || base.dadosPoco.vazaoInicial,
        vazaoTeste: dados.vazaoTeste || base.dadosPoco.vazaoTeste,
        crivoInicial:
          dados.crivoInicial || dados.crivo || base.dadosPoco.crivoInicial,
        crivo: dados.crivo || base.dadosPoco.crivo,
        profundidadeBomba: '',
        eletrodoSuperiorInicial:
          dados.eletrodoSuperiorInicial ||
          dados.eletrodoSuperior ||
          base.dadosPoco.eletrodoSuperiorInicial,
        eletrodoSuperior:
          dados.eletrodoSuperior || base.dadosPoco.eletrodoSuperior,
        eletrodoInferiorInicial:
          dados.eletrodoInferiorInicial ||
          dados.eletrodoInferior ||
          base.dadosPoco.eletrodoInferiorInicial,
        eletrodoInferior:
          dados.eletrodoInferior || base.dadosPoco.eletrodoInferior,
        tuboEdutor: dados.tuboEdutor || base.dadosPoco.tuboEdutor,
        coordenadasGeograficas: coordsBaseLimpa,
        coordenadasUTM: mudouCidadeOuOS ? '' : base.dadosPoco.coordenadasUTM,
        desenhoConstrutivo: mudouCidadeOuOS
          ? ''
          : base.dadosPoco.desenhoConstrutivo,
        parecerHidrogeologico: mudouCidadeOuOS
          ? ''
          : base.dadosPoco.parecerHidrogeologico,
        especificacaoBomba:
          dados.especificacaoBomba || base.dadosPoco.especificacaoBomba,
        motobombaEstado: dados.motobombaEstado
          ?.toLowerCase()
          .includes('novo')
          ? 'Novo'
          : 'Usado',
        painelEletrico:
          dados.painelEletrico || base.dadosPoco.painelEletrico,
        testeVazaoSEMA:
          mudouCidadeOuOS &&
          base.dadosPoco.testeVazaoSEMA &&
          (base.dadosPoco.testeVazaoSEMA.etapas?.[2]?.vazaoM3h === '10,29' ||
            base.dadosPoco.testeVazaoSEMA.artNumero === 'MT-2026-0098412')
            ? {
                ...base.dadosPoco.testeVazaoSEMA,
                ativo: false,
                etapas: [],
                vazaoOutorgaRecomendadaM3h: '',
                nivelRecuperacaoFinalM: '',
              }
            : base.dadosPoco.testeVazaoSEMA,
      },
      descricaoServico:
        base.descricaoServico.trim() ||
        templatePreventiva?.conteudo ||
        '',
      equipe:
        dados.equipe && dados.equipe.length > 0
          ? dados.equipe.map((m, idx) => ({
              id: `eq_os_${Date.now()}_${idx}`,
              nome: m.nome,
              funcao: m.funcao || 'Técnico de Campo',
            }))
          : base.equipe,
      servicosConduzidos:
        dados.servicos && dados.servicos.length > 0
          ? dados.servicos.map((s, idx) => ({
              id: `srv_os_${Date.now()}_${idx}`,
              descricao: s.descricao,
              unidade: s.unidade || 'UN',
              quantidade: s.quantidade || '1',
              status:
                s.status === 'Pendente' || s.status === 'Cancelado'
                  ? s.status
                  : 'Executado',
            }))
          : base.servicosConduzidos,
      materiaisAplicados:
        dados.materiais && dados.materiais.length > 0
          ? dados.materiais.map((m, idx) => ({
              id: `mat_os_${Date.now()}_${idx}`,
              descricao: m.descricao,
              unidade: m.unidade || 'UN',
              quantidade: m.quantidade || '1,00',
              situacao: 'Aplicado',
            }))
          : base.materiaisAplicados,
      ocorrenciasCampo: {
        ...base.ocorrenciasCampo,
        recomendacoes:
          dados.observacoesManuscritas ||
          base.ocorrenciasCampo.recomendacoes,
        observacoesGerais:
          dados.dadosCarimboVersoResumo ||
          base.ocorrenciasCampo.observacoesGerais,
      },
      assinaturaCliente: dados.nomeRepresentanteCliente
        ? {
            dataUrl: base.assinaturaCliente?.dataUrl || '',
            nomeSignatario: dados.nomeRepresentanteCliente,
            funcao: 'Representante / Recebedor no Local',
            dataRegistro:
              dados.dataExecucaoISO ||
              new Date().toISOString().split('T')[0],
          }
        : base.assinaturaCliente,
    };

    setRelatorioAtivo(novoRelatorio);
    setSecaoAtiva('preview');

    try {
      const resNuvem = await salvarRelatorioSupabase(novoRelatorio);
      if (resNuvem.sucesso) {
        const listaNuvem = await listarRelatoriosSupabase();
        setRelatoriosSalvos(listaNuvem);
        setHorarioUltimoSave(new Date().toLocaleTimeString('pt-BR'));
        showToast(
          `Ordem de Serviço ${dados.numeroOS || ''} importada e salva no Supabase!`,
          'success'
        );
      } else {
        showToast(
          `Dados preenchidos, mas houve falha ao salvar no Supabase: ${resNuvem.erro || ''}`,
          'error'
        );
      }
    } catch {
      showToast(
        'Dados da O.S. preenchidos no relatório!',
        'success'
      );
    }
  };

  const handleAbrirLancamentoRapido = (
    clienteUuid?: string,
    pocoUuid?: string
  ) => {
    setFiltroLancamentoRapido({ clienteUuid, pocoUuid });
    setModalLancamentoRapidoAberta(true);
  };

  // Processa a importação em lote de múltiplas O.S. históricas (2024 -> presente), criando Clientes e Poços automaticamente se necessário
  const handleImportarLoteOS = async (
    linhas: LinhaLancamentoHistoricoOS[]
  ) => {
    if (linhas.length === 0) return;

    try {
      let listaClientesAtual = await listarClientesSupabase();
      let listaPocosAtual = await listarPocosSupabase();
      const relatoriosCriados: RelatorioTecnico[] = [];

      // Ordena cronologicamente para que o cadastro do poço fique atualizado com os equipamentos mais recentes
      const linhasOrdenadas = [...linhas].sort((a, b) =>
        (a.dataExecucaoISO || '').localeCompare(b.dataExecucaoISO || '')
      );

      for (let i = 0; i < linhasOrdenadas.length; i++) {
        const l = linhasOrdenadas[i];
        const agora = Date.now() + i;
        const nomeCliLimpo = (
          l.clienteNome || 'CLIENTE NÃO IDENTIFICADO'
        ).trim();
        const normCli = normalizarTextoCliente(nomeCliLimpo);

        // 1. Localiza ou cria o Cliente diretamente no Supabase
        let clienteObj = listaClientesAtual.find(
          (c) =>
            normalizarTextoCliente(c.razaoSocial) === normCli ||
            (l.clienteCNPJ &&
              c.cnpjCpf &&
              normalizarTextoCliente(c.cnpjCpf) ===
                normalizarTextoCliente(l.clienteCNPJ))
        );

        if (!clienteObj) {
          const novoCliente: CadastroCliente = {
            uuid: gerarUuidV4(),
            razaoSocial: nomeCliLimpo,
            nomeFantasia: '',
            cnpjCpf: l.clienteCNPJ || '',
            enderecoSede: l.nomeLocalPoco || '',
            cidadeUF: l.cidadeUF || 'Cuiabá - MT',
            contatoPrincipal: '',
            telefone: '',
            email: '',
            observacoes:
              'Cadastrado automaticamente via Lançamento Rápido de Histórico.',
            criadoEm: agora,
            atualizadoEm: agora,
          };
          await salvarClienteSupabase(novoCliente);
          clienteObj = novoCliente;
          listaClientesAtual = [...listaClientesAtual, clienteObj];
        }

        // 2. Localiza ou cria/atualiza o Poço vinculado a este Cliente diretamente no Supabase
        const tagLimpa = (l.pocoTag || 'PT-01').trim().toUpperCase();
        let pocoObj = listaPocosAtual.find(
          (p) =>
            p.tag.trim().toUpperCase() === tagLimpa &&
            (p.clienteUuid === clienteObj!.uuid ||
              normalizarTextoCliente(p.cliente) === normCli)
        );

        if (!pocoObj) {
          const novoPoco: CadastroPoco = {
            uuid: gerarUuidV4(),
            clienteUuid: clienteObj.uuid,
            tag: tagLimpa,
            nomeIdentificacao:
              l.nomeLocalPoco || `Poço ${tagLimpa} — ${clienteObj.razaoSocial}`,
            cliente: clienteObj.razaoSocial,
            clienteCNPJ: l.clienteCNPJ || clienteObj.cnpjCpf || '',
            enderecoLocal:
              l.nomeLocalPoco || clienteObj.enderecoSede || l.cidadeUF || '',
            cidadeUF: l.cidadeUF || clienteObj.cidadeUF || 'Cuiabá - MT',
            coordenadasUTM: '',
            contatoLocal: clienteObj.contatoPrincipal || '',
            telefoneContato: clienteObj.telefone || '',
            profundidadeTotal: l.profundidadeTotal || '150,00 m',
            diametroRevestimento: l.diametroRevestimento || '6"',
            dataPerfuracao: '',
            numeroOutorga: '',
            aquiferoLitologia: 'Sistema Aquífero Parecis',
            crivoPadrao: l.crivoDepois || l.crivoAntes || '',
            tuboEdutorPadrao: l.tuboEdutor || 'Geomecânico',
            eletrodoSuperiorPadrao: l.eletrodoSup || '',
            eletrodoInferiorPadrao: l.eletrodoInf || '',
            bombaAtual: l.especificacaoBomba || '',
            painelAtual: l.painelEletrico || '',
            observacoesTecnicas: l.observacoesCampo || '',
            criadoEm: agora,
            atualizadoEm: agora,
          };
          await salvarPocoSupabase(novoPoco);
          pocoObj = novoPoco;
          listaPocosAtual = [...listaPocosAtual, pocoObj];
        } else {
          // Atualiza os equipamentos atuais do poço com os dados desta O.S. mais recente
          const pocoAtualizado: CadastroPoco = {
            ...pocoObj,
            clienteUuid: clienteObj.uuid,
            profundidadeTotal:
              l.profundidadeTotal || pocoObj.profundidadeTotal,
            diametroRevestimento:
              l.diametroRevestimento || pocoObj.diametroRevestimento,
            crivoPadrao:
              l.crivoDepois || l.crivoAntes || pocoObj.crivoPadrao,
            tuboEdutorPadrao: l.tuboEdutor || pocoObj.tuboEdutorPadrao,
            eletrodoSuperiorPadrao:
              l.eletrodoSup || pocoObj.eletrodoSuperiorPadrao,
            eletrodoInferiorPadrao:
              l.eletrodoInf || pocoObj.eletrodoInferiorPadrao,
            bombaAtual: l.especificacaoBomba || pocoObj.bombaAtual,
            painelAtual: l.painelEletrico || pocoObj.painelAtual,
            atualizadoEm: agora,
          };
          await salvarPocoSupabase(pocoAtualizado);
          pocoObj = pocoAtualizado;
          listaPocosAtual = listaPocosAtual.map((p) =>
            p.uuid === pocoObj!.uuid ? pocoObj! : p
          );
        }

        // 3. Monta o Relatório Técnico (Ordem de Serviço)
        const baseBranco = criarRelatorioEmBranco(
          {
            razaoSocial: relatorioAtivo.cabecalho.razaoSocial,
            cnpj: relatorioAtivo.cabecalho.cnpj,
            enderecoEmpresa: relatorioAtivo.cabecalho.enderecoEmpresa,
            cidadeContatoEmpresa: relatorioAtivo.cabecalho.cidadeContatoEmpresa,
            emailEmpresa: relatorioAtivo.cabecalho.emailEmpresa,
            logoBase64: logoEmpresaSessao || relatorioAtivo.cabecalho.logoBase64,
          },
          pocoObj
        );

        const fmtComUnidade = (v: string, sufixo: string) => {
          const limpo = (v || '').trim();
          if (!limpo) return '';
          if (
            limpo.toLowerCase().includes(sufixo.toLowerCase().trim()) ||
            /[a-zA-Z]/.test(limpo)
          ) {
            return limpo;
          }
          return `${limpo}${sufixo}`;
        };

        const neAntesFmt = fmtComUnidade(l.neAntes || l.neDepois, ' m');
        const neDepoisFmt = fmtComUnidade(l.neDepois || l.neAntes, ' m');
        const ndAntesFmt = fmtComUnidade(l.ndAntes || l.ndDepois, ' m');
        const ndDepoisFmt = fmtComUnidade(l.ndDepois || l.ndAntes, ' m');
        const qAntesFmt = fmtComUnidade(l.vazaoAntes || l.vazaoDepois, ' m³/h');
        const qDepoisFmt = fmtComUnidade(l.vazaoDepois || l.vazaoAntes, ' m³/h');
        const crivoAntesFmt = fmtComUnidade(l.crivoAntes || l.crivoDepois, ' m');
        const crivoDepoisFmt = fmtComUnidade(
          l.crivoDepois || l.crivoAntes,
          ' m'
        );

        const testeSimulado = l.simularTesteVazao
          ? gerarDadosTesteSimuladoParaHistorico(
              l.neDepois || l.neAntes,
              l.ndDepois || l.ndAntes,
              l.vazaoDepois || l.vazaoAntes,
              l.duracaoTesteLabel,
              l.dataExecucaoISO,
              relatorioAtivo.cabecalho.responsavelTecnicoNome,
              relatorioAtivo.cabecalho.responsavelTecnicoCREA
            )
          : undefined;

        const equipeLista: MembroEquipe[] = l.equipeTexto
          ? l.equipeTexto
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((str, idx) => {
                const m = str.match(/^(.+?)\s*\((.+)\)$/);
                return {
                  id: `eq-lote-${agora}-${idx}`,
                  nome: m ? m[1].trim() : str,
                  funcao: m ? m[2].trim() : 'Técnico de Campo',
                };
              })
          : baseBranco.equipe;

        const servicosLista: ItemServicoConduzido[] = l.servicosTexto
          ? l.servicosTexto
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((desc, idx) => ({
                id: `srv-lote-${agora}-${idx}`,
                descricao: desc,
                unidade: 'UN',
                quantidade: '1,00',
                status: 'Executado',
              }))
          : baseBranco.servicosConduzidos;

        const materiaisLista: ItemMaterialAplicado[] = l.materiaisTexto
          ? l.materiaisTexto
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((str, idx) => {
                const m = str.match(/^(.+?)\s*\(([\d.,]+)\s*([a-zA-Z]+)\)$/);
                return {
                  id: `mat-lote-${agora}-${idx}`,
                  descricao: m ? m[1].trim() : str,
                  quantidade: m ? m[2].trim() : '1,00',
                  unidade: m ? m[3].toUpperCase() : 'UN',
                  situacao: 'Aplicado',
                };
              })
          : [];

        const timestampExec = l.dataExecucaoISO
          ? new Date(`${l.dataExecucaoISO}T12:00:00`).getTime() || agora
          : agora;

        const relatorioMontado: RelatorioTecnico = {
          ...baseBranco,
          uuid: `rel-hist-${agora}-${Math.random().toString(36).slice(2, 6)}`,
          clienteUuid: clienteObj.uuid,
          pocoUuid: pocoObj.uuid,
          status: 'finalizado',
          cabecalho: {
            ...baseBranco.cabecalho,
            cliente: clienteObj.razaoSocial,
            clienteCNPJ: l.clienteCNPJ || clienteObj.cnpjCpf || '',
            contratoOS: l.numeroOS || `OS-${i + 1}`,
            tipoServico: normalizarTipoServico(
              l.tipoServico,
              'Manutenção Preventiva'
            ),
            statusOS: 'Concluído',
            localizacao:
              l.nomeLocalPoco || pocoObj.enderecoLocal || l.cidadeUF || '',
            cidadeUF: l.cidadeUF || pocoObj.cidadeUF || 'Cuiabá - MT',
            dataExecucao:
              l.dataExecucaoISO || new Date().toISOString().split('T')[0],
          },
          dadosPoco: {
            ...baseBranco.dadosPoco,
            incluirNoRelatorio: true,
            pocoId: pocoObj.tag,
            profundidadeTotal: fmtComUnidade(
              l.profundidadeTotal || pocoObj.profundidadeTotal,
              ' m'
            ),
            diametroRevestimento:
              l.diametroRevestimento || pocoObj.diametroRevestimento || '6"',
            nivelEstaticoInicial: neAntesFmt,
            nivelEstatico: neDepoisFmt,
            nivelDinamicoInicial: ndAntesFmt,
            nivelDinamico: ndDepoisFmt,
            vazaoInicial: qAntesFmt,
            vazaoTeste: qDepoisFmt,
            crivoInicial: crivoAntesFmt,
            crivo: crivoDepoisFmt,
            eletrodoSuperiorInicial: l.eletrodoSup || '',
            eletrodoSuperior: l.eletrodoSup || '',
            eletrodoInferiorInicial: l.eletrodoInf || '',
            eletrodoInferior: l.eletrodoInf || '',
            tuboEdutor: l.tuboEdutor || pocoObj.tuboEdutorPadrao || '',
            especificacaoBomba:
              l.especificacaoBomba || pocoObj.bombaAtual || '',
            motobombaEstado: 'Usado',
            painelEletrico: l.painelEletrico || pocoObj.painelAtual || '',
            painelEstado: 'Usado',
            testeVazaoSEMA: testeSimulado || {
              ...(baseBranco.dadosPoco.testeVazaoSEMA as DadosTesteVazaoSEMA),
              ativo: false,
            },
          },
          descricaoServico:
            l.servicosTexto
              ? `Serviços executados referente à O.S. ${l.numeroOS}: ${l.servicosTexto.replace(
                  /\s*\|\s*/g,
                  '; '
                )}.`
              : baseBranco.descricaoServico,
          equipe: equipeLista,
          servicosConduzidos: servicosLista,
          materiaisAplicados: materiaisLista,
          ocorrenciasCampo: {
            ...baseBranco.ocorrenciasCampo,
            recomendacoes: l.observacoesCampo || '',
            observacoesGerais: l.observacoesCampo || '',
          },
          criadoEm: timestampExec,
          atualizadoEm: timestampExec,
        };

        await salvarRelatorioSupabase(relatorioMontado);
        relatoriosCriados.push(relatorioMontado);
      }

      const [todosClientes, todosPocos, todosRelatorios] = await Promise.all([
        listarClientesSupabase(),
        listarPocosSupabase(),
        listarRelatoriosSupabase(),
      ]);
      const sincronizado = await sincronizarClientesComPocosSupabase(
        todosPocos,
        todosClientes
      );

      setClientesCadastrados(sincronizado.clientes);
      setPocosCadastrados(sincronizado.pocosAtualizados);
      setRelatoriosSalvos(todosRelatorios);

      if (relatoriosCriados.length > 0) {
        setRelatorioAtivo(relatoriosCriados[relatoriosCriados.length - 1]);
      }

      showToast(
        `${relatoriosCriados.length} ${
          relatoriosCriados.length === 1
            ? 'Ordem de Serviço salva'
            : 'Ordens de Serviço salvas'
        } no Supabase com Clientes e Poços vinculados!`,
        'success'
      );
    } catch {
      showToast('Erro ao processar o lote de Ordens de Serviço.', 'error');
    }
  };

  // Fotos 1:1
  const processarArquivosFotos = (files: FileList | File[]) => {
    const listaArquivos: File[] = Array.from(files);
    if (listaArquivos.length === 0) return;

    const lidos: ArquivoParaCorte[] = [];
    let processados = 0;
    let ignorados = 0;

    const ehArquivoImagem = (arquivo: File) => {
      if (arquivo.type && arquivo.type.startsWith('image/')) return true;
      return /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|svg)$/i.test(
        arquivo.name || ''
      );
    };

    const finalizarLote = () => {
      if (processados === listaArquivos.length) {
        if (lidos.length > 0) {
          setFilaParaCorte(lidos);
        } else if (ignorados > 0) {
          showToast(
            'Formato de arquivo não suportado. Selecione uma foto em JPG, PNG ou WebP.',
            'error'
          );
        }
      }
    };

    listaArquivos.forEach((arquivo, idx) => {
      if (!ehArquivoImagem(arquivo)) {
        processados++;
        ignorados++;
        finalizarLote();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        let dataUrl = String(reader.result || '');
        if (dataUrl.startsWith('data:application/octet-stream')) {
          dataUrl = dataUrl.replace(
            'data:application/octet-stream',
            'data:image/jpeg'
          );
        }
        lidos.push({
          id: `crop-${Date.now()}-${idx}`,
          nomeArquivo: arquivo.name || `foto-${idx + 1}.jpg`,
          dataUrlOriginal: dataUrl,
        });
        processados++;
        finalizarLote();
      };
      reader.onerror = () => {
        processados++;
        ignorados++;
        finalizarLote();
      };
      reader.readAsDataURL(arquivo);
    });
  };

  const handleSelecionarFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processarArquivosFotos(files);
    e.target.value = '';
  };

  const adicionarFotoCortada = (urlBase64: string, legenda: string) => {
    setRelatorioAtivo((prev) => {
      const novaOrdem = prev.fotos.length + 1;
      const novaFoto: FotoRegistro = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        urlBase64,
        legenda,
        timestamp: Date.now(),
        ordem: novaOrdem,
      };
      return {
        ...prev,
        fotos: [...prev.fotos, novaFoto],
        secoesVisiveis: prev.secoesVisiveis
          ? { ...prev.secoesVisiveis, fotos: true }
          : undefined,
      };
    });
    showToast('Evidência fotográfica 1:1 adicionada com sucesso!', 'success');
  };

  const atualizarLegendaFoto = (idFoto: string, novaLegenda: string) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      fotos: prev.fotos.map((f) =>
        f.id === idFoto ? { ...f, legenda: novaLegenda } : f
      ),
    }));
  };

  const moverOrdemFoto = (indexAtual: number, direcao: 'cima' | 'baixo') => {
    setRelatorioAtivo((prev) => {
      const ordenadas = [...prev.fotos].sort((a, b) => a.ordem - b.ordem);
      const indexAlvo = direcao === 'cima' ? indexAtual - 1 : indexAtual + 1;
      if (indexAlvo < 0 || indexAlvo >= ordenadas.length) return prev;

      const temp = ordenadas[indexAtual];
      ordenadas[indexAtual] = ordenadas[indexAlvo];
      ordenadas[indexAlvo] = temp;

      return {
        ...prev,
        fotos: ordenadas.map((item, idx) => ({ ...item, ordem: idx + 1 })),
      };
    });
  };

  const removerFoto = (idFoto: string) => {
    setRelatorioAtivo((prev) => ({
      ...prev,
      fotos: prev.fotos
        .filter((f) => f.id !== idFoto)
        .sort((a, b) => a.ordem - b.ordem)
        .map((item, idx) => ({ ...item, ordem: idx + 1 })),
    }));
    showToast('Evidência fotográfica removida.', 'success');
  };

  // Novo Relatório / Clonar / Excluir / Reset Total Protegido
  const handleConfirmarNovoRelatorio = () => {
    const novo = criarRelatorioEmBranco({
      razaoSocial: relatorioAtivo.cabecalho.razaoSocial,
      cnpj: relatorioAtivo.cabecalho.cnpj,
      enderecoEmpresa: relatorioAtivo.cabecalho.enderecoEmpresa,
      cidadeContatoEmpresa: relatorioAtivo.cabecalho.cidadeContatoEmpresa,
      emailEmpresa: relatorioAtivo.cabecalho.emailEmpresa,
      logoBase64: logoEmpresaSessao || relatorioAtivo.cabecalho.logoBase64,
    });
    setRelatorioAtivo(novo);
    setSecaoAtiva('identificacao');
    setModalNovoRelatorioAberto(false);
    showToast('Formulário limpo! Novo relatório iniciado.', 'success');
  };

  const handleBuscarRelatoriosSupabase = async () => {
    setCarregandoSupabase(true);
    try {
      const lista = await listarRelatoriosSupabase();
      setRelatoriosSalvos(lista);
    } catch (err) {
      console.warn('Erro ao carregar do Supabase:', err);
    } finally {
      setCarregandoSupabase(false);
    }
  };

  const handleVerificarTabelasSupabase = async () => {
    setVerificandoTabelas(true);
    try {
      const resultado = await verificarTabelasSupabase();
      setStatusTabelasSupabase(resultado);
      const existeAlgumaAusente = resultado.some((t) => !t.existe);
      if (existeAlgumaAusente) {
        setMostrarSqlSupabase(true);
      }
    } finally {
      setVerificandoTabelas(false);
    }
  };

  const handleCopiarSqlSupabase = async () => {
    try {
      await navigator.clipboard.writeText(SQL_COMPLETO_TABELAS_SUPABASE);
      setSqlCopiado(true);
      showToast(
        'SQL completo copiado! Cole no SQL Editor do Supabase e clique em Run.',
        'success'
      );
      window.setTimeout(() => setSqlCopiado(false), 3000);
    } catch {
      showToast(
        'Não foi possível copiar automaticamente. Selecione o texto do SQL abaixo.',
        'error'
      );
    }
  };

  const handleAbrirModalReset = () => {
    setConfirmacaoTextoReset('');
    setErroReset(null);
    setSqlCopiado(false);
    setMostrarSqlSupabase(false);
    setModalResetAberto(true);
    handleVerificarTabelasSupabase();
  };

  const handleConfirmarResetTotal = async () => {
    if (confirmacaoTextoReset.trim().toUpperCase() !== 'ZERAR') {
      setErroReset('Digite a palavra ZERAR exatamente como indicado para confirmar.');
      return;
    }

    setExecutandoReset(true);
    setErroReset(null);

    try {
      const res = await zerarDadosOperacionaisSupabase();
      if (!res.sucesso) {
        setErroReset(
          res.erros.join(' | ') ||
            'Não foi possível concluir o reset completo no Supabase. Verifique permissões (RLS) das tabelas.'
        );
        setMostrarSqlSupabase(true);
        return;
      }

      const logoPadrao = gerarLogoGeoestePadrao();
      setLogoEmpresaSessao(logoPadrao);
      setClientesCadastrados([]);
      setPocosCadastrados([]);
      setRelatoriosSalvos([]);
      setPocoProntuarioSelecionadoUuid('');
      setRelatorioAtivo(
        criarRelatorioEmBranco({
          ...CABECALHO_INSTITUCIONAL_PADRAO,
          logoBase64: logoPadrao,
        })
      );
      setHorarioUltimoSave('');
      setSecaoAtiva('identificacao');
      setModalResetAberto(false);
      setModalHistoricoAberto(false);
      setConfirmacaoTextoReset('');

      const avisoAusentes =
        res.tabelasAusentes.length > 0
          ? ` (Nota: tabela(s) ainda não criada(s) no Supabase: ${res.tabelasAusentes.join(', ')}).`
          : '';

      showToast(
        `Sistema zerado no Supabase! Removidos: ${res.relatoriosRemovidos} relatório(s), ${res.pocosRemovidos} poço(s) e ${res.clientesRemovidos} cliente(s). Templates preservados!${avisoAusentes}`,
        'success'
      );
    } catch (err: any) {
      setErroReset(
        err?.message || 'Erro inesperado ao zerar os dados no Supabase.'
      );
    } finally {
      setExecutandoReset(false);
    }
  };

  const handleCarregarDoHistorico = async (
    relatorioEscolhido: RelatorioTecnico,
    clonar = false,
    irParaPreview = false
  ) => {
    if (clonar) {
      const agora = Date.now();
      const copia: RelatorioTecnico = {
        ...relatorioEscolhido,
        id: agora,
        uuid: gerarUuidV4(),
        status: 'rascunho',
        cabecalho: {
          ...relatorioEscolhido.cabecalho,
          contratoOS: '',
        },
        criadoEm: agora,
        atualizadoEm: agora,
      };
      setRelatorioAtivo(copia);
      setSecaoAtiva('identificacao');
      setModalHistoricoAberto(false);
      showToast(
        'Dados copiados! Defina um NOVO Número de O.S. e altere o que precisar.',
        'success'
      );
    } else {
      setRelatorioAtivo(relatorioEscolhido);
      setModalHistoricoAberto(false);
      if (irParaPreview) {
        setSecaoAtiva('preview');
      } else if (
        secaoAtiva === 'cadastro_pocos' ||
        secaoAtiva === 'cadastro_clientes'
      ) {
        setSecaoAtiva('identificacao');
      }
      showToast('Relatório carregado com sucesso!', 'success');
    }
  };

  const handleExcluirDoHistorico = async (uuid: string) => {
    try {
      const ok = await excluirRelatorioSupabase(uuid);
      if (!ok) {
        showToast('Erro ao excluir relatório no Supabase.', 'error');
        return;
      }
      const restantes = relatoriosSalvos.filter((r) => r.uuid !== uuid);
      setRelatoriosSalvos(restantes);
      if (relatorioAtivo.uuid === uuid) {
        if (restantes.length > 0) {
          setRelatorioAtivo(restantes[0]);
        } else {
          setRelatorioAtivo(
            criarRelatorioEmBranco({
              ...CABECALHO_INSTITUCIONAL_PADRAO,
              logoBase64: logoEmpresaSessao,
            })
          );
        }
      }
      showToast('Relatório removido do Supabase.', 'success');
    } catch {
      showToast('Erro ao excluir relatório.', 'error');
    }
  };

  // Abre o modal de Auditoria Hidrogeológica / Parecer Normativo
  const handleAbrirAuditoriaHidrogeologica = (
    relatorioAlvo?: RelatorioTecnico,
    bloquearExport = false
  ) => {
    const alvo = relatorioAlvo || relatorioAtivo;
    const auditoriaLocal = executarAuditoriaDeterministicaRelatorio(alvo);
    setResultadoAuditoria(auditoriaLocal);
    setModoBloqueioExportacao(bloquearExport);
    setRelatorioPendenteExportacao(alvo);
    setModalAuditoriaAberta(true);
  };

  // Chama a rota POST /api/gerar-parecer-hidrogeologico com os coeficientes B e C pré-calculados
  const handleExecutarAuditoriaParecerIA = async () => {
    const alvo = relatorioPendenteExportacao || relatorioAtivo;
    setCarregandoAuditoriaIA(true);
    try {
      const payload = montarPayloadParecerHidrogeologico(alvo);
      const response = await fetch('/api/gerar-parecer-hidrogeologico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.sucesso) {
        throw new Error(
          json.error || 'Não foi possível gerar o parecer hidrogeológico.'
        );
      }

      const resultadoIA: ResultadoAuditoriaRelatorio = {
        ...json.resultado,
        coeficientesCalculados:
          payload.auditoriaLocalPrevia.coeficientesCalculados,
      };
      setResultadoAuditoria(resultadoIA);
      showToast(
        resultadoIA.statusAuditoria === 'APROVADO'
          ? 'Auditoria aprovada! Parecer hidrogeológico estruturado gerado.'
          : 'Auditoria concluída com alertas normativos.',
        resultadoIA.statusAuditoria === 'APROVADO' ? 'success' : 'error'
      );
    } catch (err: any) {
      showToast(
        err?.message || 'Erro ao consultar o auditor hidrogeológico.',
        'error'
      );
    } finally {
      setCarregandoAuditoriaIA(false);
    }
  };

  // Aplica os textos estruturados gerados (Geometria, Metodologia, Jacob-Rorabaugh s = B·Q + C·Q², Parecer e Checklist) no relatório ativo
  const handleAplicarSecoesAuditoriaNoRelatorio = (
    res: ResultadoAuditoriaRelatorio
  ) => {
    const sec = res.relatorioSecoes;
    if (!sec) return;

    setRelatorioAtivo((prev) => {
      const parecerCombinado = [
        sec['5_testeVazaoMetodologia'],
        sec['6_interpretacaoHidrogeologicaJacobRorabaugh'],
        sec['7_parecerVazaoRecomendada'],
      ]
        .filter((t) => t && t.trim())
        .join('\n\n');

      const checklistSincronizado =
        Array.isArray(sec['8_checklistConformidadeSeguranca']) &&
        sec['8_checklistConformidadeSeguranca'].length > 0
          ? prev.checklist.map((chk, idx) => {
              const itemIA = sec['8_checklistConformidadeSeguranca'][idx];
              if (!itemIA) return chk;
              return {
                ...chk,
                concluido: itemIA.status === 'CONFORME',
                observacao: itemIA.observacao || chk.observacao,
              };
            })
          : prev.checklist;

      return {
        ...prev,
        descricaoServico:
          sec['4_servicosManutencaoExecutados']?.trim() ||
          prev.descricaoServico,
        checklist: checklistSincronizado,
        dadosPoco: {
          ...prev.dadosPoco,
          desenhoConstrutivo:
            sec['3_geometriaConstrutivaPoco']?.trim() ||
            prev.dadosPoco.desenhoConstrutivo,
          parecerHidrogeologico:
            parecerCombinado || prev.dadosPoco.parecerHidrogeologico,
        },
      };
    });

    showToast(
      'Geometria, Interpretação Jacob-Rorabaugh (s = B·Q + C·Q²) e Parecer aplicados ao relatório!',
      'success'
    );
  };

  // Exportação PDF via jsPDF com trava de auditoria técnica pré-emissão
  const executarExportacaoPDFDireta = async (alvo: RelatorioTecnico) => {
    try {
      setExportandoPdf(true);
      setModalAuditoriaAberta(false);
      const nomeArquivo = await exportarRelatorioPDF(alvo);
      const atualizado: RelatorioTecnico = {
        ...alvo,
        status: 'exportado',
        atualizadoEm: Date.now(),
      };
      if (alvo.uuid === relatorioAtivo.uuid) {
        setRelatorioAtivo(atualizado);
      }
      await salvarRelatorioSupabase(atualizado);
      setRelatoriosSalvos((prev) => {
        const existe = prev.some((r) => r.uuid === atualizado.uuid);
        return existe
          ? prev.map((r) => (r.uuid === atualizado.uuid ? atualizado : r))
          : [atualizado, ...prev];
      });
      showToast(`PDF exportado com sucesso: ${nomeArquivo}`, 'success');
    } catch {
      showToast('Erro ao exportar o arquivo PDF.', 'error');
    } finally {
      setExportandoPdf(false);
    }
  };

  const handleExportarPDF = async (
    relatorioAlvo?: RelatorioTecnico,
    ignorarTravaAuditoria = false
  ) => {
    const alvo = relatorioAlvo || relatorioAtivo;
    if (!ignorarTravaAuditoria) {
      const auditoria = executarAuditoriaDeterministicaRelatorio(alvo);
      if (auditoria.statusAuditoria !== 'APROVADO') {
        setResultadoAuditoria(auditoria);
        setModoBloqueioExportacao(true);
        setRelatorioPendenteExportacao(alvo);
        setModalAuditoriaAberta(true);
        return;
      }
    }
    await executarExportacaoPDFDireta(alvo);
  };

  const [sidebarRetraida, setSidebarRetraida] = useState<boolean>(false);
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState<boolean>(false);

  // Avançar Fluxo Sequencial ("Próxima Seção ➔")
  const indiceSecaoAtual = SECOES_SIDEBAR.findIndex(
    (s) => s.id === secaoAtiva
  );
  const naPrimeiraSecao = indiceSecaoAtual <= 0;
  const naUltimaSecao = indiceSecaoAtual === SECOES_SIDEBAR.length - 1;

  const voltarFluxo = () => {
    if (indiceSecaoAtual > 0) {
      setSecaoAtiva(SECOES_SIDEBAR[indiceSecaoAtual - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const avancarFluxo = () => {
    const proximoIndice = (indiceSecaoAtual + 1) % SECOES_SIDEBAR.length;
    setSecaoAtiva(SECOES_SIDEBAR[proximoIndice].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fotosOrdenadas = [...relatorioAtivo.fotos].sort(
    (a, b) => a.ordem - b.ordem
  );

  // Cliente atualmente vinculado ao relatório ativo (por clienteUuid ou razão social)
  const clienteVinculadoAtivo =
    clientesCadastrados.find((c) => c.uuid === relatorioAtivo.clienteUuid) ||
    clientesCadastrados.find(
      (c) =>
        relatorioAtivo.cabecalho.cliente &&
        normalizarTextoCliente(c.razaoSocial) ===
          normalizarTextoCliente(relatorioAtivo.cabecalho.cliente)
    );

  // Poços disponíveis no seletor: se houver cliente vinculado, mostra SOMENTE os poços desse cliente
  const pocosFiltradosParaIdentificacao = clienteVinculadoAtivo
    ? obterPocosDoCliente(pocosCadastrados, clienteVinculadoAtivo)
    : pocosCadastrados;

  // Poço atualmente vinculado ao relatório ativo (por uuid ou TAG)
  const pocoVinculadoAtivo = pocosCadastrados.find(
    (p) =>
      p.uuid === relatorioAtivo.pocoUuid ||
      (relatorioAtivo.dadosPoco.pocoId &&
        p.tag.trim().toLowerCase() ===
          relatorioAtivo.dadosPoco.pocoId.trim().toLowerCase())
  );

  const handleLogout = async () => {
    await authLogout();
    showToast('Sessão encerrada com sucesso.', 'success');
  };

  if (authCarregando) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0F172A] text-white gap-3">
        <div className="w-8 h-8 border-3 border-[#E8A020] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Verificando sessão segura...</span>
      </div>
    );
  }

  if (!estaAutenticado) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F0F3F7] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-100">
      {/* HEADER PRINCIPAL (Top Bar 3-Zone Contract com cores Navy #1B2A3B e Amber #E8A020) */}
      <header className="sticky top-0 z-40 h-14 sm:h-[60px] bg-[#1B2A3B] px-3 sm:px-5 xl:px-7 flex items-center justify-between gap-2 sm:gap-4 shadow-md print:hidden">
        {/* Zone 1: Sidebar Toggle + Brand Title + Progress */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768) {
                setSidebarMobileAberta((prev) => !prev);
              } else {
                setSidebarRetraida((prev) => !prev);
              }
            }}
            title={
              sidebarRetraida
                ? 'Expandir menu lateral de seções'
                : 'Recolher ou abrir menu lateral de seções'
            }
            className="inline-flex items-center justify-center p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 hover:text-[#E8A020] transition-colors shrink-0"
          >
            {sidebarRetraida ? (
              <PanelLeftOpen className="w-4 h-4 text-[#E8A020]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-[#E8A020]" />
            )}
          </button>

          <a
            href="#identificacao"
            onClick={(e) => {
              e.preventDefault();
              setSecaoAtiva('identificacao');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Relator<span className="text-[#E8A020]">PRO</span>
          </a>

          <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono font-bold text-[#E8A020]">
            O.S. {progressoPct}%
          </span>

          <span
            title={
              isSupabaseConfigured
                ? 'Conectado exclusivamente ao Supabase (Banco em Nuvem Ativo)'
                : 'Supabase não configurado'
            }
            className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
              isSupabaseConfigured
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-200 border border-red-400/40'
            }`}
          >
            <Cloud className="w-3 h-3 shrink-0" />
            <span>{isSupabaseConfigured ? 'Supabase Nuvem' : 'Sem Conexão'}</span>
          </span>
        </div>

        {/* Zone 2: Nav Links (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-4 xl:gap-6 text-xs font-semibold text-white/85 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSecaoAtiva('cadastro_clientes')}
            className={`px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              secaoAtiva === 'cadastro_clientes'
                ? 'bg-white/10 text-[#E8A020]'
                : ''
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>Clientes ({clientesCadastrados.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSecaoAtiva('cadastro_pocos')}
            className={`px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              secaoAtiva === 'cadastro_pocos'
                ? 'bg-white/10 text-[#E8A020]'
                : ''
            }`}
          >
            <Database className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>Poços ({pocosCadastrados.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setModalHistoricoAberto(true);
              handleBuscarRelatoriosSupabase();
            }}
            className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>Histórico ({relatoriosSalvos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setModalNovoRelatorioAberto(true)}
            className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>Novo</span>
          </button>
          <button
            type="button"
            onClick={() => setModalImportarOSAberta(true)}
            className="px-2.5 py-1.5 rounded-lg bg-[#E8A020]/15 border border-[#E8A020]/40 text-[#E8A020] hover:bg-[#E8A020] hover:text-[#1B2A3B] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 font-bold"
            title="Importar Ficha de Campo / Ordem de Serviço Manuscrita em PDF ou Foto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Importar O.S.</span>
          </button>
          <button
            type="button"
            onClick={() => setSecaoAtiva('conversor_lote')}
            className={`px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 font-bold ${
              secaoAtiva === 'conversor_lote'
                ? 'bg-[#E8A020] border-[#E8A020] text-[#1B2A3B]'
                : 'bg-sky-500/15 border-sky-400/40 text-sky-300 hover:bg-sky-400 hover:text-slate-950'
            }`}
            title="Conversor & Conferência Lado a Lado de PDFs em Lote (Exportação Excel .xlsx / CSV 29 Colunas)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Conversor PDF</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleAbrirLancamentoRapido(
                clienteVinculadoAtivo?.uuid,
                pocoVinculadoAtivo?.uuid
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white/90 hover:bg-white/20 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 font-semibold"
            title="Central Rápida de Planilha Excel/CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>Lote / Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePersistirManual}
            className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            title="Salvar alterações diretamente no banco de dados Supabase"
          >
            <Save className="w-3.5 h-3.5 text-[#E8A020]" />
            <span className="hidden xl:inline">Salvar no Supabase</span>
            <span className="xl:hidden">Salvar</span>
          </button>
          <button
            type="button"
            onClick={() => handleAbrirAuditoriaHidrogeologica(relatorioAtivo, false)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 font-bold"
            title="Executar Auditoria Técnica Normativa (NBR 12.212 / NBR 12.244) e Gerar Parecer Hidrogeológico (Jacob-Rorabaugh)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auditar / Parecer</span>
          </button>
          <button
            type="button"
            onClick={() => setSecaoAtiva('preview')}
            className={`px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              secaoAtiva === 'preview' ? 'bg-white/10 text-[#E8A020]' : ''
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#E8A020]" />
            <span>A4</span>
          </button>
        </nav>

        {/* Zone 3: Quick Actions + Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setModalHistoricoAberto(true);
              handleBuscarRelatoriosSupabase();
            }}
            title="Histórico de Relatórios (Nuvem Supabase)"
            className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center gap-1 text-xs font-semibold"
          >
            <FolderOpen className="w-4 h-4 text-[#E8A020]" />
          </button>
          <button
            type="button"
            onClick={() => setModalImportarOSAberta(true)}
            title="Importar O.S. Manuscrita (PDF/Foto)"
            className="md:hidden p-2 rounded-lg bg-[#E8A020]/20 hover:bg-[#E8A020]/30 text-[#E8A020] flex items-center justify-center"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setModalNovoRelatorioAberto(true)}
            title="Novo Relatório"
            className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
          >
            <Plus className="w-4 h-4 text-[#E8A020]" />
          </button>
          <button
            type="button"
            onClick={handlePersistirManual}
            title="Salvar"
            className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
          >
            <Save className="w-4 h-4 text-[#E8A020]" />
          </button>
          <button
            type="button"
            onClick={() => setModoEscuro((prev) => !prev)}
            title={modoEscuro ? 'Tema Claro' : 'Tema Escuro'}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
          >
            {modoEscuro ? (
              <Sun className="w-4 h-4 text-[#E8A020]" />
            ) : (
              <Moon className="w-4 h-4 text-[#E8A020]" />
            )}
          </button>
          <button
            type="button"
            disabled={exportandoPdf}
            onClick={() => handleExportarPDF()}
            className="px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileDown className="w-4 h-4 shrink-0" />
            <span>{exportandoPdf ? 'Exportando...' : 'PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair do Sistema (adm)"
            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white transition-colors flex items-center justify-center shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* LAYOUT PRINCIPAL (Sidebar Lateral Fixa a partir de md: 768px + Gaveta Lateral & Barra Rápida no Mobile) */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-60px)]">
        {/* BACKDROP DO MENU LATERAL NO MOBILE (< 768px) */}
        {sidebarMobileAberta && (
          <div
            onClick={() => setSidebarMobileAberta(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden print:hidden"
          />
        )}

        {/* GAVETA VERTICAL DO MENU LATERAL NO MOBILE (< 768px) */}
        {sidebarMobileAberta && (
          <aside className="fixed top-14 sm:top-[60px] left-0 bottom-0 z-50 w-[250px] bg-[#243447] text-white py-4 flex flex-col justify-between overflow-y-auto shadow-2xl md:hidden print:hidden">
            <div>
              <div className="px-3.5 pb-4 border-b border-white/10">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/50 px-2 pb-2.5">
                  <span>Módulos & Seções</span>
                  <button
                    type="button"
                    onClick={() => setSidebarMobileAberta(false)}
                    className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
                    title="Fechar menu lateral"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {SECOES_SIDEBAR.map((item) => {
                    const Icon = item.icon;
                    const ativo = secaoAtiva === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSecaoAtiva(item.id);
                          setSidebarMobileAberta(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          ativo
                            ? 'bg-[#E8A020] text-[#1B2A3B] shadow-xs'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-3.5 py-3 border-b border-white/10 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalHistoricoAberto(true);
                    handleBuscarRelatoriosSupabase();
                    setSidebarMobileAberta(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                  <span className="truncate">
                    Histórico ({relatoriosSalvos.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePersistirManual();
                    setSidebarMobileAberta(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                  <span className="truncate">Salvar no Supabase</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarMobileAberta(false);
                    handleAbrirModalReset();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 flex items-center gap-2 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-red-300 shrink-0" />
                  <span className="truncate">Zerar Banco (Reset)</span>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-white/70">
                <span>Preenchimento O.S.</span>
                <span className="font-mono font-bold text-[#E8A020]">
                  {progressoPct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#E8A020] transition-all duration-300"
                  style={{ width: `${progressoPct}%` }}
                />
              </div>
            </div>
          </aside>
        )}

        {/* SIDEBAR DE SEÇÕES DO TRABALHO (Vertical Lateral a partir de md: 768px | Barra Rápida no Mobile) */}
        <aside
          className={`sticky top-14 sm:top-[60px] z-30 bg-[#243447] text-white py-2 px-3 md:py-4 md:px-0 md:h-[calc(100vh-60px)] md:shrink-0 border-b border-white/10 md:border-b-0 md:border-r flex flex-col justify-between overflow-x-auto md:overflow-x-hidden md:overflow-y-auto print:hidden shadow-xs md:shadow-none transition-all duration-200 ${
            sidebarRetraida ? 'md:w-[68px]' : 'md:w-[235px]'
          }`}
        >
          <div>
            <div
              className={`${
                sidebarRetraida ? 'md:px-2' : 'md:px-3.5'
              } md:pb-4 md:border-b md:border-white/10`}
            >
              {!sidebarRetraida && (
                <div className="hidden md:flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/40 px-2 pb-2.5">
                  <span>Módulos & Seções</span>
                </div>
              )}
              <div className="flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar">
                {SECOES_SIDEBAR.map((item) => {
                  const Icon = item.icon;
                  const ativo = secaoAtiva === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => {
                        setSecaoAtiva(item.id);
                        if (window.innerWidth < 768) {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`md:w-full flex items-center ${
                        sidebarRetraida
                          ? 'md:justify-center md:px-2'
                          : 'gap-2 md:gap-2.5 px-3'
                      } py-2 md:py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                        ativo
                          ? 'bg-[#E8A020] text-[#1B2A3B] shadow-xs'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={sidebarRetraida ? 'md:hidden' : ''}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ações rápidas (Desktop/Tablet Sidebar) */}
            {!sidebarRetraida && (
              <div className="hidden md:flex px-3.5 py-3 border-b border-white/10 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalHistoricoAberto(true);
                    handleBuscarRelatoriosSupabase();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                  <span className="truncate">
                    Histórico ({relatoriosSalvos.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handlePersistirManual}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                  <span className="truncate">Salvar no Supabase</span>
                </button>
                <button
                  type="button"
                  onClick={handleAbrirModalReset}
                  className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 flex items-center gap-2 whitespace-nowrap transition-colors"
                  title="Zerar Poços, Clientes e Relatórios no Supabase (mantém Templates intactos)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-red-300 shrink-0" />
                  <span className="truncate">Zerar Banco (Reset)</span>
                </button>
              </div>
            )}
          </div>

          {/* Barra de Progresso do Relatório (Desktop/Tablet Sidebar) */}
          {!sidebarRetraida ? (
            <div className="hidden md:block p-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-white/70">
                <span>Preenchimento O.S.</span>
                <span className="font-mono font-bold text-[#E8A020]">
                  {progressoPct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#E8A020] transition-all duration-300"
                  style={{ width: `${progressoPct}%` }}
                />
              </div>
              <p className="text-[10px] text-white/45 font-mono truncate">
                {salvandoAuto
                  ? 'Salvando no Supabase...'
                  : horarioUltimoSave
                  ? `Supabase: ${horarioUltimoSave}`
                  : 'Supabase Conectado'}
              </p>
            </div>
          ) : (
            <div className="hidden md:flex flex-col items-center p-2 pb-4 gap-1">
              <span className="text-[10px] font-mono font-bold text-[#E8A020]">
                {progressoPct}%
              </span>
            </div>
          )}
        </aside>

        {/* ÁREA PRINCIPAL DO SISTEMA (Fluida até 1680px para aproveitar toda a largura da tela) */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 xl:p-8 max-w-[1680px] w-full mx-auto">
          {erroSistema && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{erroSistema}</span>
              </div>
              <button
                type="button"
                onClick={() => setErroSistema(null)}
                className="font-bold underline"
              >
                Fechar
              </button>
            </div>
          )}

          {/* MÓDULO: CADASTRO DE CLIENTES & POÇOS POR CLIENTE */}
          {secaoAtiva === 'cadastro_clientes' && (
            <ClientesManager
              clientes={clientesCadastrados}
              pocos={pocosCadastrados}
              relatorios={relatoriosSalvos}
              onSalvarCliente={handleSalvarClienteNoBanco}
              onExcluirCliente={handleExcluirClienteDoBanco}
              onSalvarPoco={handleSalvarPocoNoBanco}
              onIniciarNovaOSNoPoco={handleIniciarNovaOSNoPoco}
              onAbrirProntuarioPoco={(poco) => {
                setPocoProntuarioSelecionadoUuid(poco.uuid);
                setSecaoAtiva('cadastro_pocos');
              }}
              onAbrirLancamentoRapido={handleAbrirLancamentoRapido}
            />
          )}

          {/* MÓDULO: CADASTRO DE POÇOS & HISTÓRICO POR POÇO */}
          {secaoAtiva === 'cadastro_pocos' && (
            <PocosManager
              pocos={pocosCadastrados}
              clientes={clientesCadastrados}
              pocoInicialSelecionadoUuid={pocoProntuarioSelecionadoUuid}
              relatorios={relatoriosSalvos}
              onSalvarPoco={handleSalvarPocoNoBanco}
              onExcluirPoco={handleExcluirPocoDoBanco}
              onMesclarPocos={handleMesclarPocosNoBanco}
              onIniciarNovaOSNoPoco={handleIniciarNovaOSNoPoco}
              onAbrirRelatorio={(rel, preview) =>
                handleCarregarDoHistorico(rel, false, preview)
              }
              onExportarPDFRelatorio={(rel) => handleExportarPDF(rel)}
              onAbrirLancamentoRapido={handleAbrirLancamentoRapido}
            />
          )}

          {/* MÓDULO: CONVERSOR & CONFERÊNCIA LADO A LADO DE PDFs EM LOTE */}
          {secaoAtiva === 'conversor_lote' && (
            <ConversorLotePDFSection
              clientes={clientesCadastrados}
              pocos={pocosCadastrados}
              onImportarLoteOS={handleImportarLoteOS}
              showToast={showToast}
            />
          )}

          {/* TIMBRE NA INTERFACE DO FORMULÁRIO (Parecis Perfuração de Poços e Sondagens Ltda) */}
          {secaoAtiva !== 'preview' &&
            secaoAtiva !== 'cadastro_pocos' &&
            secaoAtiva !== 'cadastro_clientes' &&
            secaoAtiva !== 'conversor_lote' && (
            <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 mb-5 sm:mb-6 overflow-hidden shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-[290px_1fr] items-center">
                {/* Coluna do Logo */}
                <div className="p-4 bg-[#F7F9FC] dark:bg-slate-950/60 border-b md:border-b-0 md:border-r border-[#DDE3EC] dark:border-slate-800 flex flex-col items-center justify-center gap-2">
                  {relatorioAtivo.cabecalho.logoBase64 ? (
                    <img
                      src={relatorioAtivo.cabecalho.logoBase64}
                      alt="Grupo Geoeste"
                      className="w-full max-w-[240px] h-auto max-h-[76px] object-contain"
                    />
                  ) : (
                    <div className="text-lg font-extrabold text-[#1B2A3B] dark:text-slate-200">
                      GRUPO GEOESTE
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputLogoRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogo}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => inputLogoRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded border border-[#DDE3EC] dark:border-slate-700 text-[#6B7A8D] dark:text-slate-300 hover:border-[#E8A020] hover:text-[#1B2A3B] dark:hover:text-white transition-colors flex items-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3" />
                      Trocar Logo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditandoTimbreEmpresa((prev) => !prev)
                      }
                      className="px-2.5 py-1 text-[11px] font-semibold rounded border border-[#DDE3EC] dark:border-slate-700 text-[#6B7A8D] dark:text-slate-300 hover:border-[#E8A020] transition-colors"
                    >
                      {editandoTimbreEmpresa ? 'Concluir Edição' : 'Editar Timbre'}
                    </button>
                  </div>
                </div>

                {/* Coluna dos Dados da Empresa */}
                <div className="p-4 md:pl-6">
                  {editandoTimbreEmpresa ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <input
                        type="text"
                        value={relatorioAtivo.cabecalho.razaoSocial}
                        onChange={(e) =>
                          atualizarCabecalho('razaoSocial', e.target.value)
                        }
                        placeholder="Razão Social da Empresa"
                        className="sm:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                      />
                      <input
                        type="text"
                        value={relatorioAtivo.cabecalho.cnpj}
                        onChange={(e) =>
                          atualizarCabecalho('cnpj', e.target.value)
                        }
                        placeholder="CNPJ"
                        className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                      <input
                        type="text"
                        value={relatorioAtivo.cabecalho.emailEmpresa || ''}
                        onChange={(e) =>
                          atualizarCabecalho('emailEmpresa', e.target.value)
                        }
                        placeholder="E-mail"
                        className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={relatorioAtivo.cabecalho.enderecoEmpresa || ''}
                        onChange={(e) =>
                          atualizarCabecalho('enderecoEmpresa', e.target.value)
                        }
                        placeholder="Endereço"
                        className="sm:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                      <input
                        type="text"
                        value={
                          relatorioAtivo.cabecalho.cidadeContatoEmpresa || ''
                        }
                        onChange={(e) =>
                          atualizarCabecalho(
                            'cidadeContatoEmpresa',
                            e.target.value
                          )
                        }
                        placeholder="Cidade / CEP / Telefones"
                        className="sm:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-[15px] font-extrabold uppercase tracking-wide text-[#000080] dark:text-sky-400 mb-1">
                        {relatorioAtivo.cabecalho.razaoSocial ||
                          'Parecis Perfuração de Poços e Sondagens Ltda'}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        CNPJ:{' '}
                        <span className="font-mono">
                          {relatorioAtivo.cabecalho.cnpj ||
                            '31.386.206/0001-25'}
                        </span>
                        <br />
                        {relatorioAtivo.cabecalho.enderecoEmpresa ||
                          'End. Av. Los Angeles, 269 – Bairro Jardim Califórnia'}
                        <br />
                        {relatorioAtivo.cabecalho.cidadeContatoEmpresa ||
                          'Sorriso-MT / CEP 78894-183 / Fone: (65) 3624-1389 Celular: (65) 99972-3112'}
                        <br />
                        E-mail:{' '}
                        {relatorioAtivo.cabecalho.emailEmpresa ||
                          'diretoria.geo@geoeste.com.br'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO 1: IDENTIFICAÇÃO DO SERVIÇO */}
          {secaoAtiva === 'identificacao' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                  Identificação do Serviço
                </h1>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSecaoAtiva('cadastro_clientes')}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-[#E8A020]" />
                    <span>Clientes ({clientesCadastrados.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecaoAtiva('cadastro_pocos')}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5 text-[#E8A020]" />
                    <span>Gerenciar Cadastro & Histórico por Poço</span>
                  </button>
                </div>
              </div>

              {/* Barra Rápida: Selecionar Cliente -> Vincular Somente aos Poços daquele Cliente */}
              <div className="rounded-xl border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Droplets className="w-5 h-5 text-[#E8A020] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100">
                      Vincular Cliente & Poço Cadastrado
                    </div>
                    <p className="text-[11px] text-[#6B7A8D] dark:text-slate-400">
                      {clienteVinculadoAtivo
                        ? `Exibindo somente os ${pocosFiltradosParaIdentificacao.length} poço(s) cadastrados para ${clienteVinculadoAtivo.razaoSocial}.`
                        : 'Selecione um cliente para filtrar apenas os poços dele, ou escolha diretamente um poço.'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] mb-1">
                      1. Cliente Cadastrado (Filtra os Poços)
                    </label>
                    <select
                      value={clienteVinculadoAtivo?.uuid || ''}
                      onChange={(e) =>
                        handleSelecionarClienteNaIdentificacao(e.target.value)
                      }
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                    >
                      <option value="">
                        — Todos os clientes ({clientesCadastrados.length}) —
                      </option>
                      {clientesCadastrados.map((c) => (
                        <option key={c.uuid} value={c.uuid}>
                          {c.razaoSocial}
                          {c.cnpjCpf ? ` (${c.cnpjCpf})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] mb-1">
                      2. Poço do Cliente ({pocosFiltradosParaIdentificacao.length})
                    </label>
                    <select
                      value={pocoVinculadoAtivo?.uuid || ''}
                      onChange={(e) =>
                        handleVincularPocoAoRelatorioAtivo(e.target.value)
                      }
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                    >
                      <option value="">
                        — Selecionar poço{' '}
                        {clienteVinculadoAtivo
                          ? `de ${clienteVinculadoAtivo.razaoSocial}`
                          : 'cadastrado'}{' '}
                        —
                      </option>
                      {pocosFiltradosParaIdentificacao.map((p) => (
                        <option key={p.uuid} value={p.uuid}>
                          {p.tag} — {p.nomeIdentificacao} ({p.cliente})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Card: Ordem de Serviço */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Ordem de Serviço</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Nº OS <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.contratoOS}
                      onChange={(e) =>
                        atualizarCabecalho('contratoOS', e.target.value)
                      }
                      placeholder="OS-2026-0001"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Data de Execução <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={relatorioAtivo.cabecalho.dataExecucao}
                      onChange={(e) =>
                        atualizarCabecalho('dataExecucao', e.target.value)
                      }
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Tipo de Serviço
                    </label>
                    <select
                      value={normalizarTipoServico(
                        relatorioAtivo.cabecalho.tipoServico,
                        ''
                      )}
                      onChange={(e) =>
                        atualizarCabecalho('tipoServico', e.target.value)
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
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
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Status Final
                    </label>
                    <select
                      value={relatorioAtivo.cabecalho.statusOS || 'Concluído'}
                      onChange={(e) =>
                        atualizarCabecalho(
                          'statusOS',
                          e.target.value as DadosCabecalho['statusOS']
                        )
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    >
                      <option value="Concluído">Concluído</option>
                      <option value="Em andamento">Em andamento</option>
                      <option value="Pendente">Pendente</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Contrato / Ref
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.contratoRef || ''}
                      onChange={(e) =>
                        atualizarCabecalho('contratoRef', e.target.value)
                      }
                      placeholder="Ex: CONT-2026-009"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Card: Dados do Cliente / Local do Poço */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Dados do Cliente / Local do Poço</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Razão Social / Cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.cliente}
                      onChange={(e) =>
                        atualizarCabecalho('cliente', e.target.value)
                      }
                      placeholder="Razão social completa"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      CNPJ / CPF do Cliente
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.clienteCNPJ || ''}
                      onChange={(e) =>
                        atualizarCabecalho('clienteCNPJ', e.target.value)
                      }
                      placeholder="00.000.000/0000-00"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Endereço do Poço <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.localizacao}
                      onChange={(e) =>
                        atualizarCabecalho('localizacao', e.target.value)
                      }
                      placeholder="Rua, número, bairro ou rodovia/fazenda"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Cidade / UF
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.cidadeUF || ''}
                      onChange={(e) =>
                        atualizarCabecalho('cidadeUF', e.target.value)
                      }
                      placeholder="Sorriso - MT"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Contato Local
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.contatoLocal || ''}
                      onChange={(e) =>
                        atualizarCabecalho('contatoLocal', e.target.value)
                      }
                      placeholder="Responsável no local"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.cabecalho.telefoneContato || ''}
                      onChange={(e) =>
                        atualizarCabecalho('telefoneContato', e.target.value)
                      }
                      placeholder="(65) 99999-0000"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Coordenadas Geográficas (Latitude / Longitude)
                    </label>
                    <input
                      type="text"
                      value={
                        relatorioAtivo.dadosPoco.coordenadasGeograficas ||
                        relatorioAtivo.cabecalho.coordenadasGeograficas ||
                        ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        atualizarDadosPoco('coordenadasGeograficas', val);
                        atualizarCabecalho('coordenadasGeograficas', val);
                      }}
                      placeholder="Ex: LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Coordenadas UTM
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.coordenadasUTM}
                      onChange={(e) =>
                        atualizarDadosPoco('coordenadasUTM', e.target.value)
                      }
                      placeholder="Ex: Zona 23K | E = 207.184 m | N = 7.656.112 m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mapa Automático por Coordenadas Geográficas (Latitude/Longitude) */}
                <PocoLocationMap
                  coordenadasGeograficas={
                    relatorioAtivo.dadosPoco.coordenadasGeograficas ||
                    relatorioAtivo.cabecalho.coordenadasGeograficas
                  }
                  coordenadasUTM={relatorioAtivo.dadosPoco.coordenadasUTM}
                  pocoTag={relatorioAtivo.dadosPoco.pocoId}
                  cliente={relatorioAtivo.cabecalho.cliente}
                  localizacao={relatorioAtivo.cabecalho.localizacao}
                  cidadeUF={relatorioAtivo.cabecalho.cidadeUF}
                  onChangeCoordenadas={({
                    coordenadasGeograficas,
                    coordenadasUTM,
                  }) => {
                    atualizarDadosPoco(
                      'coordenadasGeograficas',
                      coordenadasGeograficas
                    );
                    atualizarCabecalho(
                      'coordenadasGeograficas',
                      coordenadasGeograficas
                    );
                    atualizarDadosPoco('coordenadasUTM', coordenadasUTM);
                  }}
                />
              </div>

              {/* Card: Responsabilidade Técnica e Elaboração do Relatório */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Responsabilidade Técnica e Elaboração do Relatório</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloco 1: Responsável Técnico */}
                  <div className="p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC]/70 dark:bg-slate-950/40 space-y-3">
                    <div className="text-xs font-bold uppercase text-[#1B2A3B] dark:text-slate-200 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E8A020]" />
                      <span>Responsável Técnico (Engenharia / Geologia)</span>
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-semibold text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                        Nome do Responsável Técnico
                      </label>
                      <input
                        type="text"
                        value={
                          relatorioAtivo.cabecalho.responsavelTecnicoNome ??
                          relatorioAtivo.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoNome ??
                          relatorioAtivo.assinaturaResponsavel?.nomeSignatario ??
                          'José Roberto Ribeiro'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          atualizarCabecalho('responsavelTecnicoNome', val);
                          setRelatorioAtivo((prev) => ({
                            ...prev,
                            dadosPoco: {
                              ...prev.dadosPoco,
                              testeVazaoSEMA: prev.dadosPoco?.testeVazaoSEMA
                                ? { ...prev.dadosPoco.testeVazaoSEMA, responsavelTecnicoNome: val }
                                : undefined,
                            },
                            assinaturaResponsavel: {
                              dataUrl: prev.assinaturaResponsavel?.dataUrl || '',
                              nomeSignatario: val,
                              documento:
                                prev.cabecalho.responsavelTecnicoCREA ||
                                prev.assinaturaResponsavel?.documento ||
                                'CREA [DADO A PREENCHER EM CAMPO]',
                              funcao: 'Responsável Técnico — Engenheiro Geólogo / Hidrogeólogo',
                              dataRegistro:
                                prev.assinaturaResponsavel?.dataRegistro ||
                                new Date().toLocaleString('pt-BR'),
                            },
                          }));
                        }}
                        placeholder="Ex: Eng. Geólogo José Roberto Ribeiro"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-semibold text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                        Registro Profissional (CREA / CAU)
                      </label>
                      <input
                        type="text"
                        value={
                          relatorioAtivo.cabecalho.responsavelTecnicoCREA ??
                          relatorioAtivo.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoCREA ??
                          relatorioAtivo.assinaturaResponsavel?.documento ??
                          'CREA [DADO A PREENCHER EM CAMPO]'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          atualizarCabecalho('responsavelTecnicoCREA', val);
                          setRelatorioAtivo((prev) => ({
                            ...prev,
                            dadosPoco: {
                              ...prev.dadosPoco,
                              testeVazaoSEMA: prev.dadosPoco?.testeVazaoSEMA
                                ? { ...prev.dadosPoco.testeVazaoSEMA, responsavelTecnicoCREA: val }
                                : undefined,
                            },
                            assinaturaResponsavel: {
                              dataUrl: prev.assinaturaResponsavel?.dataUrl || '',
                              nomeSignatario:
                                prev.cabecalho.responsavelTecnicoNome ||
                                prev.assinaturaResponsavel?.nomeSignatario ||
                                'José Roberto Ribeiro',
                              documento: val,
                              funcao: 'Responsável Técnico — Engenheiro Geólogo / Hidrogeólogo',
                              dataRegistro:
                                prev.assinaturaResponsavel?.dataRegistro ||
                                new Date().toLocaleString('pt-BR'),
                            },
                          }));
                        }}
                        placeholder="Ex: CREA-SP 5068912410 / CREA-MT"
                        className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Bloco 2: Responsável pela Elaboração do Relatório */}
                  <div className="p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC]/70 dark:bg-slate-950/40 space-y-3">
                    <div className="text-xs font-bold uppercase text-[#1B2A3B] dark:text-slate-200 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <span>Responsável pela Elaboração do Relatório</span>
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-semibold text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                        Nome / Departamento Elaborador
                      </label>
                      <input
                        type="text"
                        value={
                          relatorioAtivo.cabecalho.responsavelElaboracaoNome ??
                          relatorioAtivo.assinaturaCliente?.nomeSignatario ??
                          'Departamento Técnico de Hidrogeologia'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          atualizarCabecalho('responsavelElaboracaoNome', val);
                          setRelatorioAtivo((prev) => ({
                            ...prev,
                            assinaturaCliente: {
                              dataUrl: prev.assinaturaCliente?.dataUrl || '',
                              nomeSignatario: val,
                              funcao:
                                prev.cabecalho.responsavelElaboracaoCargo ||
                                prev.assinaturaCliente?.funcao ||
                                'Responsável pela Elaboração do Relatório Técnico',
                              dataRegistro:
                                prev.assinaturaCliente?.dataRegistro ||
                                new Date().toLocaleString('pt-BR'),
                            },
                          }));
                        }}
                        placeholder="Ex: Departamento Técnico de Hidrogeologia ou Geól. Ana Paula"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-semibold text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                        Cargo / Título no Documento
                      </label>
                      <input
                        type="text"
                        value={
                          relatorioAtivo.cabecalho.responsavelElaboracaoCargo ??
                          relatorioAtivo.assinaturaCliente?.funcao ??
                          'Responsável pela Elaboração do Relatório Técnico'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          atualizarCabecalho('responsavelElaboracaoCargo', val);
                          setRelatorioAtivo((prev) => ({
                            ...prev,
                            assinaturaCliente: {
                              dataUrl: prev.assinaturaCliente?.dataUrl || '',
                              nomeSignatario:
                                prev.cabecalho.responsavelElaboracaoNome ||
                                prev.assinaturaCliente?.nomeSignatario ||
                                'Departamento Técnico de Hidrogeologia',
                              funcao: val,
                              dataRegistro:
                                prev.assinaturaCliente?.dataRegistro ||
                                new Date().toLocaleString('pt-BR'),
                            },
                          }));
                        }}
                        placeholder="Responsável pela Elaboração do Relatório Técnico"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO 2: INFORMAÇÕES ESTRUTURAIS DO POÇO */}
          {secaoAtiva === 'poco' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                    Informações do Poço
                  </h1>
                  <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-0.5">
                    Dados fixos vêm do Cadastro do Poço; Nível Estático (NE), Nível Dinâmico (ND) e Vazão registram a medição desta O.S.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSalvarDadosAtuaisNoCadastroPoco}
                    className="px-3 py-2 text-xs font-bold rounded-lg bg-[#2E4260] text-white hover:bg-[#1B2A3B] flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5 text-[#E8A020]" />
                    <span>Salvar/Atualizar Poço</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecaoAtiva('cadastro_pocos')}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#E8A020]" />
                    <span>Ver Evolução</span>
                  </button>
                </div>
              </div>

              {/* Card: Dados do Poço */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Dados Construtivos & Parâmetros Hidrodinâmicos da Visita</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Poço (TAG)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.pocoId}
                      onChange={(e) =>
                        atualizarDadosPoco('pocoId', e.target.value)
                      }
                      placeholder="Ex: PT01"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Profundidade Total (Fixo)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.profundidadeTotal}
                      onChange={(e) =>
                        atualizarDadosPoco('profundidadeTotal', e.target.value)
                      }
                      placeholder="Ex: 150m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Revestimento / Diâmetro (Fixo)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.diametroRevestimento}
                      onChange={(e) =>
                        atualizarDadosPoco(
                          'diametroRevestimento',
                          e.target.value
                        )
                      }
                      placeholder="Ex: 6 polegadas"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Tubo Edutor
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.tuboEdutor}
                      onChange={(e) =>
                        atualizarDadosPoco('tuboEdutor', e.target.value)
                      }
                      placeholder="Ex: Geomecânico / CRI 1 1/2&quot;"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Coordenadas Geográficas (Latitude / Longitude)
                    </label>
                    <input
                      type="text"
                      value={
                        relatorioAtivo.dadosPoco.coordenadasGeograficas ||
                        relatorioAtivo.cabecalho.coordenadasGeograficas ||
                        ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        atualizarDadosPoco('coordenadasGeograficas', val);
                        atualizarCabecalho('coordenadasGeograficas', val);
                      }}
                      placeholder="Ex: LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Coordenadas UTM
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.coordenadasUTM}
                      onChange={(e) =>
                        atualizarDadosPoco('coordenadasUTM', e.target.value)
                      }
                      placeholder="Ex: X=241500, Y=8624000"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-1">
                    <DetectorAquiferoCard
                      value={relatorioAtivo.dadosPoco.aquiferoLitologia || ''}
                      onChange={(novoValor) =>
                        atualizarDadosPoco('aquiferoLitologia', novoValor)
                      }
                      coordenadasGeograficas={
                        relatorioAtivo.dadosPoco.coordenadasGeograficas ||
                        relatorioAtivo.cabecalho.coordenadasGeograficas
                      }
                      coordenadasUTM={relatorioAtivo.dadosPoco.coordenadasUTM}
                      cidadeUF={relatorioAtivo.cabecalho.cidadeUF}
                      endereco={relatorioAtivo.cabecalho.localizacao}
                      pocosSupabase={pocosCadastrados}
                      relatoriosSupabase={relatoriosSalvos}
                      pocoIgnorarUuid={relatorioAtivo.pocoUuid}
                      onNotificar={(msg, tipo) =>
                        showToast(msg, tipo === 'error' ? 'error' : 'success')
                      }
                    />
                  </div>
                </div>

                {/* Quadro Comparativo do Carimbo de Campo: INICIAL (Antes) vs FINAL (Depois da Manutenção) */}
                <div className="rounded-xl border-2 border-[#E8A020]/45 bg-[#FFFDF7] dark:bg-slate-950/80 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8A020]/30 pb-3">
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#E8A020]" />
                        Medições do Carimbo de Campo: Inicial (Antes) vs. Final (Pós-Manutenção)
                      </div>
                      <p className="text-[11.5px] text-[#6B7A8D] dark:text-slate-400 mt-0.5">
                        Registre os valores iniciais (frente da O.S. / coluna ANTES do carimbo) e os valores finais aferidos após a finalização da manutenção (coluna DEPOIS).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRelatorioAtivo((prev) => ({
                          ...prev,
                          dadosPoco: {
                            ...prev.dadosPoco,
                            nivelEstatico:
                              prev.dadosPoco.nivelEstatico ||
                              prev.dadosPoco.nivelEstaticoInicial ||
                              '',
                            nivelDinamico:
                              prev.dadosPoco.nivelDinamico ||
                              prev.dadosPoco.nivelDinamicoInicial ||
                              '',
                            vazaoTeste:
                              prev.dadosPoco.vazaoTeste ||
                              prev.dadosPoco.vazaoInicial ||
                              '',
                            crivo:
                              prev.dadosPoco.crivo ||
                              prev.dadosPoco.crivoInicial ||
                              '',
                            eletrodoSuperior:
                              prev.dadosPoco.eletrodoSuperior ||
                              prev.dadosPoco.eletrodoSuperiorInicial ||
                              '',
                            eletrodoInferior:
                              prev.dadosPoco.eletrodoInferior ||
                              prev.dadosPoco.eletrodoInferiorInicial ||
                              '',
                            nivelEstaticoInicial:
                              prev.dadosPoco.nivelEstaticoInicial ||
                              prev.dadosPoco.nivelEstatico ||
                              '',
                            nivelDinamicoInicial:
                              prev.dadosPoco.nivelDinamicoInicial ||
                              prev.dadosPoco.nivelDinamico ||
                              '',
                            vazaoInicial:
                              prev.dadosPoco.vazaoInicial ||
                              prev.dadosPoco.vazaoTeste ||
                              '',
                            crivoInicial:
                              prev.dadosPoco.crivoInicial ||
                              prev.dadosPoco.crivo ||
                              '',
                            eletrodoSuperiorInicial:
                              prev.dadosPoco.eletrodoSuperiorInicial ||
                              prev.dadosPoco.eletrodoSuperior ||
                              '',
                            eletrodoInferiorInicial:
                              prev.dadosPoco.eletrodoInferiorInicial ||
                              prev.dadosPoco.eletrodoInferior ||
                              '',
                          },
                        }));
                        showToast(
                          'Valores sincronizados entre Inicial (Antes) e Final (Depois)!',
                          'success'
                        );
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-[#E8A020] bg-white dark:bg-slate-900 text-[#B86E00] dark:text-[#E8A020] hover:bg-[#E8A020]/15 transition-colors shrink-0 self-start sm:self-auto"
                      title="Preenche automaticamente os campos em branco copiando entre Inicial e Final"
                    >
                      Sincronizar Inicial ↔ Final
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 1. Nível Estático (NE) */}
                    <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#B86E00] dark:text-[#E8A020]">
                        1. Nível Estático — NE (m)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
                            Inicial / Antes da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.nivelEstaticoInicial || ''}
                            onChange={(e) =>
                              atualizarDadosPoco(
                                'nivelEstaticoInicial',
                                e.target.value
                              )
                            }
                            placeholder="Ex: 24,50 m (Antes)"
                            className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase text-[#B86E00] dark:text-[#E8A020] mb-1">
                            Final / Depois da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.nivelEstatico}
                            onChange={(e) =>
                              atualizarDadosPoco('nivelEstatico', e.target.value)
                            }
                            placeholder="Ex: 22,40 m (Depois)"
                            className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[#E8A020]/70 bg-[#FFFDF7] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Nível Dinâmico (ND) */}
                    <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#B86E00] dark:text-[#E8A020]">
                        2. Nível Dinâmico — ND (m)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
                            Inicial / Antes da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.nivelDinamicoInicial || ''}
                            onChange={(e) =>
                              atualizarDadosPoco(
                                'nivelDinamicoInicial',
                                e.target.value
                              )
                            }
                            placeholder="Ex: 68,00 m (Antes)"
                            className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase text-[#B86E00] dark:text-[#E8A020] mb-1">
                            Final / Depois da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.nivelDinamico}
                            onChange={(e) =>
                              atualizarDadosPoco('nivelDinamico', e.target.value)
                            }
                            placeholder="Ex: 64,10 m (Depois)"
                            className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[#E8A020]/70 bg-[#FFFDF7] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Vazão Mensurada (Q) */}
                    <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#27AE60]">
                        3. Vazão Mensurada — Q (m³/h ou L/h)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
                            Inicial / Antes da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.vazaoInicial || ''}
                            onChange={(e) =>
                              atualizarDadosPoco('vazaoInicial', e.target.value)
                            }
                            placeholder="Ex: 8,50 m³/h (Antes)"
                            className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#27AE60] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase text-[#27AE60] mb-1">
                            Final / Depois da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.vazaoTeste}
                            onChange={(e) =>
                              atualizarDadosPoco('vazaoTeste', e.target.value)
                            }
                            placeholder="Ex: 10,29 m³/h (Depois)"
                            className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[#27AE60]/60 bg-[#F4FBF7] dark:bg-slate-950 focus:bg-white focus:border-[#27AE60] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. Crivo / Posição do Filtro */}
                    <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                        4. Crivo / Posição da Bomba (m)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
                            Inicial / Antes da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.crivoInicial || ''}
                            onChange={(e) =>
                              atualizarDadosPoco('crivoInicial', e.target.value)
                            }
                            placeholder="Ex: 120,00 m (Antes)"
                            className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase text-[#1B2A3B] dark:text-slate-200 mb-1">
                            Final / Depois da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.crivo}
                            onChange={(e) =>
                              atualizarDadosPoco('crivo', e.target.value)
                            }
                            placeholder="Ex: 120,00 m (Depois)"
                            className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 5. Eletrodo Superior (ES) */}
                    <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                        5. Eletrodo Superior — ES
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
                            Inicial / Antes da Manutenção
                          </label>
                          <input
                            type="text"
                            value={
                              relatorioAtivo.dadosPoco.eletrodoSuperiorInicial ||
                              ''
                            }
                            onChange={(e) =>
                              atualizarDadosPoco(
                                'eletrodoSuperiorInicial',
                                e.target.value
                              )
                            }
                            placeholder="Ex: 45,00 m (Antes)"
                            className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase text-[#1B2A3B] dark:text-slate-200 mb-1">
                            Final / Depois da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.eletrodoSuperior}
                            onChange={(e) =>
                              atualizarDadosPoco(
                                'eletrodoSuperior',
                                e.target.value
                              )
                            }
                            placeholder="Ex: 45,00 m (Depois)"
                            className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 6. Eletrodo Inferior (EI) */}
                    <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                        6. Eletrodo Inferior — EI
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
                            Inicial / Antes da Manutenção
                          </label>
                          <input
                            type="text"
                            value={
                              relatorioAtivo.dadosPoco.eletrodoInferiorInicial ||
                              ''
                            }
                            onChange={(e) =>
                              atualizarDadosPoco(
                                'eletrodoInferiorInicial',
                                e.target.value
                              )
                            }
                            placeholder="Ex: 50,00 m (Antes)"
                            className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase text-[#1B2A3B] dark:text-slate-200 mb-1">
                            Final / Depois da Manutenção
                          </label>
                          <input
                            type="text"
                            value={relatorioAtivo.dadosPoco.eletrodoInferior}
                            onChange={(e) =>
                              atualizarDadosPoco(
                                'eletrodoInferior',
                                e.target.value
                              )
                            }
                            placeholder="Ex: 50,00 m (Depois)"
                            className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mapa Automático na Aba de Dados do Poço */}
                <PocoLocationMap
                  coordenadasGeograficas={
                    relatorioAtivo.dadosPoco.coordenadasGeograficas ||
                    relatorioAtivo.cabecalho.coordenadasGeograficas
                  }
                  coordenadasUTM={relatorioAtivo.dadosPoco.coordenadasUTM}
                  pocoTag={relatorioAtivo.dadosPoco.pocoId}
                  cliente={relatorioAtivo.cabecalho.cliente}
                  localizacao={relatorioAtivo.cabecalho.localizacao}
                  cidadeUF={relatorioAtivo.cabecalho.cidadeUF}
                  onChangeCoordenadas={({
                    coordenadasGeograficas,
                    coordenadasUTM,
                  }) => {
                    atualizarDadosPoco(
                      'coordenadasGeograficas',
                      coordenadasGeograficas
                    );
                    atualizarCabecalho(
                      'coordenadasGeograficas',
                      coordenadasGeograficas
                    );
                    atualizarDadosPoco('coordenadasUTM', coordenadasUTM);
                  }}
                />
              </div>

              {/* Card: Equipamentos Hidromecânicos */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Equipamentos Hidromecânicos</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Conjunto Moto-Bomba (Modelo / Especificação)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.especificacaoBomba}
                      onChange={(e) =>
                        atualizarDadosPoco('especificacaoBomba', e.target.value)
                      }
                      placeholder="Ex: Submersa Ebara 5HP"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                    <div className="flex items-center gap-5 mt-2.5">
                      {(['Usado', 'Novo'] as const).map((estado) => (
                        <label
                          key={estado}
                          className="inline-flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="motobombaEstado"
                            checked={
                              relatorioAtivo.dadosPoco.motobombaEstado ===
                              estado
                            }
                            onChange={() =>
                              atualizarDadosPoco('motobombaEstado', estado)
                            }
                            className="w-4 h-4 accent-[#E8A020]"
                          />
                          <span>{estado}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Painel Elétrico (Especificação Técnica)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.painelEletrico}
                      onChange={(e) =>
                        atualizarDadosPoco('painelEletrico', e.target.value)
                      }
                      placeholder="Ex: Partida direta com disjuntor-motor"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                    <div className="flex items-center gap-5 mt-2.5">
                      {(['Usado', 'Novo'] as const).map((estado) => (
                        <label
                          key={estado}
                          className="inline-flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="painelEstado"
                            checked={
                              relatorioAtivo.dadosPoco.painelEstado === estado
                            }
                            onChange={() =>
                              atualizarDadosPoco('painelEstado', estado)
                            }
                            className="w-4 h-4 accent-[#E8A020]"
                          />
                          <span>{estado}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: Dimensionamento Hidráulico e Elétrico da Motobomba + Banco de Modelos */}
              <DimensionamentoBombaSection
                dadosPoco={relatorioAtivo.dadosPoco}
                onChangeDimensionamento={(novoDim) =>
                  atualizarDadosPoco('dimensionamentoBomba', novoDim)
                }
                onAplicarBombaSelecionada={({
                  especificacaoBomba,
                  painelEletrico,
                  tuboEdutor,
                  modeloId,
                }) => {
                  setRelatorioAtivo((prev) => ({
                    ...prev,
                    dadosPoco: {
                      ...prev.dadosPoco,
                      especificacaoBomba,
                      painelEletrico,
                      tuboEdutor: tuboEdutor || prev.dadosPoco.tuboEdutor,
                      dimensionamentoBomba: {
                        ...(prev.dadosPoco.dimensionamentoBomba || {
                          ativo: true,
                          diametroEdutorPol: '1.1/2"',
                          materialEdutor: 'Galvanizado (C=120)',
                          desnivelExternoM: '15,00',
                          distanciaAdutoraM: '50,00',
                          diametroAdutoraMm: '50',
                          materialAdutora: 'PEAD / PVC (C=140)',
                          pressaoResidualMca: '3,00',
                          perdasLocalizadasPercent: '8',
                          rendimentoBombaPercent: '58',
                          tensaoAlimentacao: '220V Trifásico',
                          distanciaQuadroBocaM: '10,00',
                          quedaTensaoMaxPercent: '3,5',
                        }),
                        ativo: true,
                        modeloSelecionadoId: modeloId,
                      },
                    },
                  }));
                  showToast(
                    'Conjunto motobomba, quadro de comando e cabo PP aplicados ao relatório!',
                    'success'
                  );
                }}
                showToast={showToast}
              />

              {/* Card: Teste de Vazão Padrão SEMA (Step-Drawdown Test & Grupo Geoeste) */}
              <StepDrawdownSection
                dadosPoco={relatorioAtivo.dadosPoco}
                relatoriosAnteriores={relatoriosSalvos}
                onChangeTesteSEMA={(novoTeste) =>
                  atualizarDadosPoco('testeVazaoSEMA', novoTeste)
                }
                onSincronizarComDadosPoco={(ndFinal, vazaoFinal) => {
                  setRelatorioAtivo((prev) => ({
                    ...prev,
                    dadosPoco: {
                      ...prev.dadosPoco,
                      nivelDinamico: ndFinal,
                      vazaoTeste: vazaoFinal,
                    },
                  }));
                  showToast(
                    `Nível Dinâmico (${ndFinal}) e Vazão (${vazaoFinal}) sincronizados com a última etapa do Teste SEMA!`,
                    'success'
                  );
                }}
                onExportarPDFTesteBombeamento={() => {
                  try {
                    exportarPDFTesteBombeamentoGeoeste(relatorioAtivo);
                    showToast(
                      'PDF do Anexo de Teste de Bombeamento (3 Páginas) gerado com sucesso!',
                      'success'
                    );
                  } catch {
                    showToast(
                      'Erro ao gerar o PDF do Teste de Bombeamento.',
                      'error'
                    );
                  }
                }}
              />
            </div>
          )}

          {/* SEÇÃO 3: SERVIÇOS TÉCNICOS REALIZADOS + EQUIPE + LISTA DE SERVIÇOS */}
          {secaoAtiva === 'servicos' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                  Serviços Técnicos Realizados
                </h1>
              </div>

              {/* Card: Memorial Descritivo */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-[#DDE3EC] dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100">
                    <FileText className="w-4 h-4 text-[#E8A020]" />
                    <span>Memorial Descritivo das Atividades</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {relatorioAtivo.descricaoServico.trim() && (
                      <button
                        type="button"
                        onClick={() => setModalGerenciarTemplatesAberta(true)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#E8A020] bg-[#E8A020]/10 text-[#1B2A3B] dark:text-[#E8A020] hover:bg-[#E8A020]/20 transition-colors flex items-center gap-1.5 shadow-2xs"
                        title="Salvar o texto atual como um novo modelo reutilizável"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-[#E8A020]" />
                        <span>Salvar como Novo Template</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalGerenciarTemplatesAberta(true)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-colors flex items-center gap-1.5 shadow-2xs"
                      title="Criar, editar e organizar templates de memorial descritivo"
                    >
                      <FolderCog className="w-3.5 h-3.5 text-[#E8A020]" />
                      <span>Gerenciar / Criar Templates</span>
                    </button>
                  </div>
                </div>

                {/* Templates rápidos */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Clique em um modelo para preencher o memorial:</span>
                    <span className="text-[10px] text-slate-400">{listaTemplates.length} modelos disponíveis</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {listaTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => aplicarTemplateDescricao(tpl)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs ${
                          tpl.isCustom
                            ? 'border-[#E8A020] bg-[#E8A020]/10 text-[#1B2A3B] dark:text-[#E8A020] hover:bg-[#E8A020]/20'
                            : 'border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020]'
                        }`}
                        title={tpl.isCustom ? 'Modelo personalizado criado por você' : 'Modelo padrão do sistema'}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                        <span>{tpl.titulo}</span>
                        {tpl.isCustom && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#E8A020]/30 text-[#B87000] dark:text-[#E8A020]">
                            Meu
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                    Memorial Descritivo das Atividades{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={relatorioAtivo.descricaoServico}
                    onChange={(e) =>
                      setRelatorioAtivo((prev) => ({
                        ...prev,
                        descricaoServico: e.target.value,
                      }))
                    }
                    placeholder="Descreva a metodologia e desenvolvimento das atividades técnicas..."
                    className="w-full p-3.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>
              </div>

              {/* Card: Equipe de Execução */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Equipe de Execução</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F7F9FC] dark:bg-slate-950 border-b-2 border-[#DDE3EC] dark:border-slate-800 text-[11px] font-bold uppercase text-[#6B7A8D]">
                        <th className="py-2.5 px-3 text-left w-10">#</th>
                        <th className="py-2.5 px-3 text-left">
                          Nome do Colaborador
                        </th>
                        <th className="py-2.5 px-3 text-left">
                          Função / Cargo
                        </th>
                        <th className="py-2.5 px-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                      {relatorioAtivo.equipe.map((membro, idx) => (
                        <tr key={membro.id}>
                          <td className="py-2.5 px-3 font-mono text-xs text-[#6B7A8D]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={membro.nome}
                              onChange={(e) =>
                                atualizarMembroEquipe(
                                  membro.id,
                                  'nome',
                                  e.target.value
                                )
                              }
                              placeholder="Nome do Colaborador"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={membro.funcao}
                              onChange={(e) =>
                                atualizarMembroEquipe(
                                  membro.id,
                                  'funcao',
                                  e.target.value
                                )
                              }
                              placeholder="Ex: Técnico de Campo / Auxiliar"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => removerMembroEquipe(membro.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={adicionarMembroEquipe}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-[#E8A020] text-[#E8A020] font-bold text-xs hover:bg-[#E8A020]/5 transition-colors"
                >
                  ＋ Adicionar Colaborador
                </button>
              </div>

              {/* Card: Lista de Serviços Conduzidos */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Lista de Serviços Conduzidos</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F7F9FC] dark:bg-slate-950 border-b-2 border-[#DDE3EC] dark:border-slate-800 text-[11px] font-bold uppercase text-[#6B7A8D]">
                        <th className="py-2.5 px-3 text-left w-10">#</th>
                        <th className="py-2.5 px-3 text-left">
                          Descrição dos Serviços Conduzidos
                        </th>
                        <th className="py-2.5 px-3 text-left w-32">Unidade</th>
                        <th className="py-2.5 px-3 text-left w-24">Qtd</th>
                        <th className="py-2.5 px-3 text-left w-36">Status</th>
                        <th className="py-2.5 px-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                      {relatorioAtivo.servicosConduzidos.map((srv, idx) => (
                        <tr key={srv.id}>
                          <td className="py-2.5 px-3 font-mono text-xs text-[#6B7A8D]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={srv.descricao}
                              onChange={(e) =>
                                atualizarServicoRow(
                                  srv.id,
                                  'descricao',
                                  e.target.value
                                )
                              }
                              placeholder="Ex: Substituição de motobomba e cabos elétricos"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={srv.unidade ?? 'UN'}
                              onChange={(e) =>
                                atualizarServicoRow(
                                  srv.id,
                                  'unidade',
                                  e.target.value
                                )
                              }
                              placeholder="Ex: UN, h, m, sv"
                              className="w-full px-2.5 py-2 text-sm font-medium rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={srv.quantidade}
                              onChange={(e) =>
                                atualizarServicoRow(
                                  srv.id,
                                  'quantidade',
                                  e.target.value
                                )
                              }
                              placeholder="1"
                              className="w-20 px-2.5 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={srv.status}
                              onChange={(e) =>
                                atualizarServicoRow(
                                  srv.id,
                                  'status',
                                  e.target.value as ItemServicoConduzido['status']
                                )
                              }
                              className="w-full px-2.5 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            >
                              <option value="Executado">Executado</option>
                              <option value="Pendente">Pendente</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => removerServicoRow(srv.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={adicionarServicoRow}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-[#E8A020] text-[#E8A020] font-bold text-xs hover:bg-[#E8A020]/5 transition-colors"
                >
                  ＋ Adicionar Serviço
                </button>
              </div>
            </div>
          )}

          {/* SEÇÃO 4: MATERIAIS E INSUMOS APLICADOS */}
          {secaoAtiva === 'materiais' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                  Materiais e Insumos Aplicados
                </h1>
              </div>

              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F7F9FC] dark:bg-slate-950 border-b-2 border-[#DDE3EC] dark:border-slate-800 text-[11px] font-bold uppercase text-[#6B7A8D]">
                        <th className="py-2.5 px-3 text-left w-10">#</th>
                        <th className="py-2.5 px-3 text-left">
                          Descrição do Material
                        </th>
                        <th className="py-2.5 px-3 text-left w-32">Unidade</th>
                        <th className="py-2.5 px-3 text-left w-24">Qtd</th>
                        <th className="py-2.5 px-3 text-left w-36">Situação</th>
                        <th className="py-2.5 px-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                      {relatorioAtivo.materiaisAplicados.map((mat, idx) => (
                        <tr key={mat.id}>
                          <td className="py-2.5 px-3 font-mono text-xs text-[#6B7A8D]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={mat.descricao}
                              onChange={(e) =>
                                atualizarMaterialRow(
                                  mat.id,
                                  'descricao',
                                  e.target.value
                                )
                              }
                              placeholder="Ex: Cabo Flexível Submersível 6mm"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={mat.unidade}
                              onChange={(e) =>
                                atualizarMaterialRow(
                                  mat.id,
                                  'unidade',
                                  e.target.value
                                )
                              }
                              placeholder="Ex: Metro"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={mat.quantidade}
                              onChange={(e) =>
                                atualizarMaterialRow(
                                  mat.id,
                                  'quantidade',
                                  e.target.value
                                )
                              }
                              className="w-20 px-2.5 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={mat.situacao}
                              onChange={(e) =>
                                atualizarMaterialRow(
                                  mat.id,
                                  'situacao',
                                  e.target.value as ItemMaterialAplicado['situacao']
                                )
                              }
                              className="w-full px-2.5 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                            >
                              <option value="Aplicado">Aplicado</option>
                              <option value="Pendente">Pendente</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => removerMaterialRow(mat.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={adicionarMaterialRow}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-[#E8A020] text-[#E8A020] font-bold text-xs hover:bg-[#E8A020]/5 transition-colors"
                >
                  ＋ Adicionar Material
                </button>
              </div>
            </div>
          )}

          {/* SEÇÃO 5: CHECKLIST DE CONFORMIDADE */}
          {secaoAtiva === 'checklist' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                  Checklist de Conformidade
                </h1>
              </div>

              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                  <span>Avaliação Técnica Preventiva</span>
                  <div className="flex-1 h-px bg-[#DDE3EC] dark:bg-slate-800" />
                </div>

                <div className="space-y-2.5">
                  {relatorioAtivo.checklist.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-lg border-2 cursor-pointer transition-colors ${
                        item.concluido
                          ? 'border-[#a7e6c4] bg-[#f0fbf5] dark:bg-emerald-950/30 dark:border-emerald-800'
                          : 'border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        onChange={() => alternarItemChecklist(item.id)}
                        className="w-4 h-4 accent-[#27AE60] shrink-0 cursor-pointer"
                      />
                      <span className="text-xs sm:text-sm font-medium flex-1">
                        {item.texto}
                      </span>
                      <span
                        className={`text-[11px] sm:text-xs font-bold font-mono shrink-0 ${
                          item.concluido ? 'text-[#27AE60]' : 'text-[#E74C3C]'
                        }`}
                      >
                        {item.concluido ? 'CONCLUÍDO' : 'PENDENTE'}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Adicionar item extra ao checklist */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    value={novoItemChecklistTexto}
                    onChange={(e) => setNovoItemChecklistTexto(e.target.value)}
                    placeholder="Adicionar item extra de verificação ao checklist..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={adicionarItemChecklistCustom}
                    className="px-4 py-2.5 sm:py-2 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A] whitespace-nowrap shrink-0"
                  >
                    ＋ Incluir Item
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO 6: REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS (1:1) */}
          {secaoAtiva === 'fotos' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                  Registro Fotográfico de Evidências
                </h1>
                <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-1">
                  Adicione as evidências em formato quadrado (1:1) com zoom, rotação, enquadramento e legenda técnica definidos no momento do upload.
                </p>
              </div>

              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
                <input
                  ref={inputFotosRef}
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp"
                  multiple
                  onChange={handleSelecionarFotos}
                  className="hidden"
                />

                {/* Zona de Upload Clicável / Drag-and-Drop / Colar (Ctrl+V) */}
                <div
                  tabIndex={0}
                  onClick={() => inputFotosRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processarArquivosFotos(e.dataTransfer.files);
                    }
                  }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.files;
                    if (items && items.length > 0) {
                      e.preventDefault();
                      processarArquivosFotos(items);
                    }
                  }}
                  className="border-2 border-dashed border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] focus:border-[#E8A020] focus:outline-none rounded-xl p-5 sm:p-7 text-center cursor-pointer bg-[#F7F9FC] dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 transition-all space-y-2"
                >
                  <ImageIcon className="w-8 h-8 text-[#E8A020] mx-auto" />
                  <div className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                    Clique, arraste ou cole (Ctrl+V) para adicionar evidência fotográfica
                  </div>
                  <div className="text-xs text-[#6B7A8D] dark:text-slate-400">
                    Permite enquadrar na proporção 1:1, aplicar zoom/rotação e definir a legenda técnica (JPG, PNG, WebP)
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        inputFotosRef.current?.click();
                      }}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A] flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Escolher da Galeria / Arquivos
                    </button>
                  </div>
                </div>

                {/* Grade de Fotos 1:1 */}
                {fotosOrdenadas.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 pt-2">
                    {fotosOrdenadas.map((foto, idx) => (
                      <div
                        key={foto.id}
                        className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 p-3 flex flex-col space-y-2.5"
                      >
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-slate-900">
                          <img
                            src={foto.urlBase64}
                            alt={foto.legenda}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removerFoto(foto.id)}
                            title="Excluir foto"
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-[#E74C3C] text-white flex items-center justify-center text-xs transition-colors"
                          >
                            ✕
                          </button>
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded px-2 py-0.5 text-[11px] text-white font-mono">
                            <span>#{idx + 1}</span>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moverOrdemFoto(idx, 'cima')}
                              className="p-0.5 hover:text-[#E8A020] disabled:opacity-30"
                              title="Mover para trás"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === fotosOrdenadas.length - 1}
                              onClick={() => moverOrdemFoto(idx, 'baixo')}
                              className="p-0.5 hover:text-[#E8A020] disabled:opacity-30"
                              title="Mover para frente"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={foto.legenda}
                          onChange={(e) =>
                            atualizarLegendaFoto(foto.id, e.target.value)
                          }
                          placeholder="Legenda técnica da evidência..."
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#E8A020] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO 7: NARRATIVAS DE CAMPO, ANOMALIAS & ASSINATURAS DIGITAIS */}
          {secaoAtiva === 'ocorrencias' && (
            <div className="space-y-5">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                  Narrativas de Campo e Anomalias
                </h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
                    Intercorrências de Percurso
                  </div>
                  <textarea
                    rows={3}
                    value={relatorioAtivo.ocorrenciasCampo.ocorrencias}
                    onChange={(e) =>
                      atualizarOcorrencias('ocorrencias', e.target.value)
                    }
                    placeholder="Registre eventuais intercorrências durante a execução..."
                    className="w-full p-3 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
                    Trabalhos Remanescentes / Pendências
                  </div>
                  <textarea
                    rows={3}
                    value={relatorioAtivo.ocorrenciasCampo.pendencias}
                    onChange={(e) =>
                      atualizarOcorrencias('pendencias', e.target.value)
                    }
                    placeholder="Descreva pendências caso existam..."
                    className="w-full p-3 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
                    Recomendações Geológicas Futuras
                  </div>
                  <textarea
                    rows={3}
                    value={relatorioAtivo.ocorrenciasCampo.recomendacoes}
                    onChange={(e) =>
                      atualizarOcorrencias('recomendacoes', e.target.value)
                    }
                    placeholder="Recomendações preventivas para o cliente..."
                    className="w-full p-3 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
                    Notas Técnicas Gerais
                  </div>
                  <textarea
                    rows={3}
                    value={relatorioAtivo.ocorrenciasCampo.observacoesGerais}
                    onChange={(e) =>
                      atualizarOcorrencias('observacoesGerais', e.target.value)
                    }
                    placeholder="Medições complementares, amperagem, observações..."
                    className="w-full p-3 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO: TERMO DE ENCERRAMENTO E ASSINATURAS */}
          {secaoAtiva === 'assinaturas' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
                    Termo de Encerramento e Assinaturas
                  </h1>
                  <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-0.5">
                    Configure os dados e assinaturas do Responsável Técnico e do Responsável pela Elaboração do Relatório (ABNT NBR 12212 / 12244).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('preview')}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#243447] text-white flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
                >
                  <FileText className="w-4 h-4 text-[#E8A020]" />
                  <span>Visualizar no Laudo A4 / PDF</span>
                </button>
              </div>

              <SignatureSection
                assinaturaResponsavel={relatorioAtivo.assinaturaResponsavel}
                assinaturaCliente={relatorioAtivo.assinaturaCliente}
                onChangeResponsavel={(assinatura) => {
                  setRelatorioAtivo((prev) => ({
                    ...prev,
                    assinaturaResponsavel: assinatura,
                    cabecalho: {
                      ...prev.cabecalho,
                      responsavelTecnicoNome:
                        assinatura?.nomeSignatario || prev.cabecalho.responsavelTecnicoNome,
                      responsavelTecnicoCREA:
                        assinatura?.documento || prev.cabecalho.responsavelTecnicoCREA,
                    },
                    dadosPoco: {
                      ...prev.dadosPoco,
                      testeVazaoSEMA: prev.dadosPoco?.testeVazaoSEMA
                        ? {
                            ...prev.dadosPoco.testeVazaoSEMA,
                            responsavelTecnicoNome:
                              assinatura?.nomeSignatario ||
                              prev.dadosPoco.testeVazaoSEMA.responsavelTecnicoNome,
                            responsavelTecnicoCREA:
                              assinatura?.documento ||
                              prev.dadosPoco.testeVazaoSEMA.responsavelTecnicoCREA,
                          }
                        : undefined,
                    },
                  }));
                  showToast('Assinatura do Responsável Técnico atualizada!');
                }}
                onChangeCliente={(assinatura) => {
                  setRelatorioAtivo((prev) => ({
                    ...prev,
                    assinaturaCliente: assinatura,
                    cabecalho: {
                      ...prev.cabecalho,
                      responsavelElaboracaoNome:
                        assinatura?.nomeSignatario || prev.cabecalho.responsavelElaboracaoNome,
                      responsavelElaboracaoCargo:
                        assinatura?.funcao || prev.cabecalho.responsavelElaboracaoCargo,
                    },
                  }));
                  showToast('Assinatura do Responsável pela Elaboração atualizada!');
                }}
              />
            </div>
          )}

          {/* SEÇÃO 8: VISUALIZAÇÃO A4 & EXPORTAÇÃO PDF */}
          {secaoAtiva === 'preview' && (
            <div className="space-y-4">
              {relatorioAtivo.dadosPoco.testeVazaoSEMA?.ativo && (
                <div className="max-w-[794px] mx-auto rounded-xl border border-[#2E75B6]/40 bg-[#F4F8FC] dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100">
                      Anexo: Relatório Teste de Vazão
                    </div>
                    <p className="text-[11px] text-[#6B7A8D] dark:text-slate-400 mt-0.5">
                      Teste de Bombeamento · Teste de Recuperação · Interpretação
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      exportarPDFTesteBombeamentoGeoeste(relatorioAtivo);
                      showToast(
                        'PDF do Anexo de Teste de Vazão exportado!',
                        'success'
                      );
                    }}
                    className="px-4 py-2.5 text-xs font-bold rounded-lg bg-[#2E75B6] text-white hover:bg-[#1B2A3B] flex items-center gap-2 shrink-0 shadow-xs"
                  >
                    <FileDown className="w-4 h-4 text-[#E8A020]" />
                    <span>Teste de Vazão (PDF)</span>
                  </button>
                </div>
              )}

              <A4Preview
                relatorio={relatorioAtivo}
                exportandoPdf={exportandoPdf}
                onExportarPDF={() => handleExportarPDF()}
                onAtualizarSecoesVisiveis={(novasSecoes) => {
                  setRelatorioAtivo((prev) => ({
                    ...prev,
                    secoesVisiveis: novasSecoes,
                  }));
                }}
              />
            </div>
          )}

          {/* BOTÕES DE FLUXO SEQUENCIAL ("Seção Anterior" / "Próxima Seção ➔") */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-8 mb-12 print:hidden">
            {!naPrimeiraSecao ? (
              <button
                type="button"
                onClick={voltarFluxo}
                className="px-5 py-3 rounded-lg text-sm font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Seção Anterior</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={avancarFluxo}
              className="px-6 py-3 rounded-lg text-sm font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] shadow-md transition-all flex items-center justify-center gap-2"
            >
              {naUltimaSecao ? (
                <>
                  <span>Voltar para o Início</span>
                  <RotateCcw className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Próxima Seção</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </main>
      </div>

      {/* MODAL DE HISTÓRICO GERAL / RELATÓRIOS SALVOS NO SUPABASE */}
      {modalHistoricoAberto &&
        (() => {
          const normalizarTexto = (txt: string) =>
            (txt || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

          const termoNormalizado = normalizarTexto(buscaHistorico.trim());

          const listaOrigem = relatoriosSalvos;

          const relatoriosHistoricoFiltrados = listaOrigem.filter((rel) => {
            const statusItem = rel.cabecalho.statusOS || 'Concluído';
            const bateStatus =
              filtroStatusHistorico === 'todos' ||
              statusItem === filtroStatusHistorico;

            if (!bateStatus) return false;
            if (!termoNormalizado) return true;

            const cliente = normalizarTexto(rel.cabecalho.cliente);
            const numeroOS = normalizarTexto(rel.cabecalho.contratoOS);
            const contratoRef = normalizarTexto(
              rel.cabecalho.contratoRef || ''
            );
            const local = normalizarTexto(rel.cabecalho.localizacao);
            const tagPoco = normalizarTexto(rel.dadosPoco?.pocoId || '');

            return (
              cliente.includes(termoNormalizado) ||
              numeroOS.includes(termoNormalizado) ||
              contratoRef.includes(termoNormalizado) ||
              local.includes(termoNormalizado) ||
              tagPoco.includes(termoNormalizado)
            );
          });

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
              <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDE3EC] dark:border-slate-800 pb-4 mb-4 shrink-0">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#1B2A3B] dark:text-slate-100 truncate flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-emerald-500" />
                      <span>Histórico de Relatórios — Supabase</span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#6B7A8D] dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      Exibindo {relatoriosHistoricoFiltrados.length} de{' '}
                      {listaOrigem.length} relatório(s) salvos na nuvem Supabase
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={handleBuscarRelatoriosSupabase}
                      disabled={carregandoSupabase}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>
                        {carregandoSupabase ? 'Atualizando...' : 'Atualizar'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAbrirModalReset}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center gap-1.5 whitespace-nowrap"
                      title="Apagar Poços, Clientes e Relatórios no Supabase e iniciar do zero (mantém Templates)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Zerar Banco</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalHistoricoAberto(false)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Fechar</span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Barra de Busca por Cliente / Nº da O.S. e Filtro de Status */}
                {relatoriosSalvos.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 shrink-0">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#6B7A8D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={buscaHistorico}
                        onChange={(e) => setBuscaHistorico(e.target.value)}
                        placeholder="Buscar por nome do cliente, Nº da O.S., contrato ou TAG do poço..."
                        className="w-full pl-10 pr-9 py-2 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#E8A020] focus:outline-none"
                        autoFocus
                      />
                      {buscaHistorico && (
                        <button
                          type="button"
                          onClick={() => setBuscaHistorico('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7A8D] hover:text-[#1B2A3B] dark:hover:text-white"
                          title="Limpar busca"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F0F3F7] dark:bg-slate-800 text-[11px] shrink-0 overflow-x-auto no-scrollbar">
                      {(
                        [
                          { id: 'todos', label: 'Todos' },
                          { id: 'Concluído', label: 'Concluído' },
                          { id: 'Em andamento', label: 'Em andamento' },
                          { id: 'Pendente', label: 'Pendente' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFiltroStatusHistorico(f.id)}
                          className={`px-2.5 py-1.5 font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            filtroStatusHistorico === f.id
                              ? 'bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-slate-100 shadow-xs'
                              : 'text-[#6B7A8D] dark:text-slate-400 hover:text-[#1B2A3B] dark:hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabela de Resultados */}
                <div className="flex-1 overflow-y-auto">
                  {listaOrigem.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <p className="text-sm font-semibold text-[#1B2A3B] dark:text-slate-200">
                        Nenhum relatório cadastrado no Supabase ainda.
                      </p>
                      <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                        Preencha uma nova Ordem de Serviço e clique em &ldquo;Salvar no Supabase&rdquo; para começar.
                      </p>
                    </div>
                  ) : relatoriosHistoricoFiltrados.length === 0 ? (
                    <div className="text-center py-10 space-y-3 border border-dashed border-[#DDE3EC] dark:border-slate-800 rounded-xl">
                      <p className="text-sm font-semibold text-[#1B2A3B] dark:text-slate-200">
                        Nenhum relatório corresponde a &ldquo;{buscaHistorico}
                        &rdquo;
                      </p>
                      <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                        Verifique a grafia do nome do cliente ou o número da
                        Ordem de Serviço.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaHistorico('');
                          setFiltroStatusHistorico('todos');
                        }}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A]"
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F7F9FC] dark:bg-slate-950 border-b-2 border-[#DDE3EC] dark:border-slate-800 text-[#6B7A8D] uppercase">
                            <th className="py-2.5 px-3 text-left">Nº OS</th>
                            <th className="py-2.5 px-3 text-left">
                              Cliente Mandante
                            </th>
                            <th className="py-2.5 px-3 text-left">
                              Poço / Hidrodinâmica
                            </th>
                            <th className="py-2.5 px-3 text-left">
                              Último Salvamento
                            </th>
                            <th className="py-2.5 px-3 text-center w-56">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                          {relatoriosHistoricoFiltrados.map((rel) => (
                            <tr
                              key={rel.uuid}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                                {rel.cabecalho.contratoOS || 'Sem OS'}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-[#1B2A3B] dark:text-slate-100">
                                  {rel.cabecalho.cliente || '—'}
                                </div>
                                {rel.cabecalho.localizacao && (
                                  <div className="text-[11px] text-[#6B7A8D] truncate max-w-[240px]">
                                    {rel.cabecalho.localizacao}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="font-mono font-bold text-[#E8A020]">
                                  {rel.dadosPoco?.pocoId || '—'}
                                </span>
                                <span className="mx-1.5 text-slate-300">·</span>
                                <span className="font-mono text-[11px] text-[#6B7A8D]">
                                  NE:{rel.dadosPoco?.nivelEstatico || '—'} | ND:
                                  {rel.dadosPoco?.nivelDinamico || '—'} | Q:
                                  {rel.dadosPoco?.vazaoTeste || '—'}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums text-[#6B7A8D] whitespace-nowrap">
                                {new Date(rel.atualizadoEm).toLocaleString(
                                  'pt-BR'
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCarregarDoHistorico(rel, false)
                                    }
                                    className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A]"
                                  >
                                    Abrir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCarregarDoHistorico(rel, true)
                                    }
                                    className="px-2.5 py-1.5 text-[11px] font-semibold rounded bg-[#2E4260] text-white hover:bg-[#1B2A3B] flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Clonar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleExcluirDoHistorico(rel.uuid)
                                    }
                                    className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                    title="Excluir do Supabase"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* MODAL PROTEGIDO DE RESET TOTAL DO BANCO SUPABASE (PRESERVA TEMPLATES) */}
      {modalResetAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100">
                    Zerar Banco de Dados (Iniciar do Zero)
                  </h3>
                  <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                    Diagnóstico das tabelas e limpeza operacional no Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={executandoReset}
                onClick={() => setModalResetAberto(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Diagnóstico em tempo real das tabelas do Supabase */}
            <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950/70 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#E8A020]" />
                  <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100">
                    Status das Tabelas no Supabase
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={verificandoTabelas}
                    onClick={handleVerificarTabelasSupabase}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] transition-colors flex items-center gap-1"
                  >
                    <RotateCcw
                      className={`w-3 h-3 ${
                        verificandoTabelas ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {verificandoTabelas ? 'Verificando...' : 'Reverificar'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarSqlSupabase((prev) => !prev)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 hover:bg-sky-100 transition-colors flex items-center gap-1"
                  >
                    <Cloud className="w-3 h-3" />
                    <span>
                      {mostrarSqlSupabase
                        ? 'Ocultar SQL'
                        : 'SQL das Tabelas'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {statusTabelasSupabase.map((item) => (
                  <div
                    key={item.tabela}
                    className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                      item.existe && !item.erro
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-bold text-[#1B2A3B] dark:text-slate-100">
                      <span className="truncate">{item.label}</span>
                      {item.existe && !item.erro ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] font-mono text-[#6B7A8D] dark:text-slate-400 truncate">
                      {item.existe && !item.erro
                        ? `${item.contagem ?? 0} reg.${
                            item.preservadaNoReset ? ' · preservada' : ''
                          }`
                        : 'Ausente / criar'}
                    </div>
                  </div>
                ))}
              </div>

              {mostrarSqlSupabase && (
                <div className="pt-2 border-t border-[#DDE3EC] dark:border-slate-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-[11px] text-[#4A5568] dark:text-slate-300 leading-relaxed">
                      Cole o SQL abaixo no <strong>SQL Editor</strong> do seu
                      painel Supabase e clique em <strong>Run</strong> (cria as
                      tabelas ausentes sem apagar seus dados/templates), depois
                      clique em <strong>Reverificar</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopiarSqlSupabase}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#25394e] text-white flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      {sqlCopiado ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>SQL Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#E8A020]" />
                          <span>Copiar SQL Completo</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 text-[10.5px] font-mono max-h-48 overflow-auto whitespace-pre leading-relaxed select-all border border-slate-800">
                    {SQL_COMPLETO_TABELAS_SUPABASE}
                  </pre>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-3.5 space-y-1.5">
                <div className="font-bold text-red-700 dark:text-red-300 uppercase tracking-wide text-[10px]">
                  Será Apagado Permanentemente
                </div>
                <ul className="space-y-1 text-red-800 dark:text-red-200/90">
                  <li>• Relatórios Técnicos ({relatoriosSalvos.length})</li>
                  <li>• Poços Cadastrados ({pocosCadastrados.length})</li>
                  <li>• Clientes ({clientesCadastrados.length})</li>
                  <li>• Banco local legado (IndexedDB)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-1.5">
                <div className="font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide text-[10px]">
                  Será Mantido Intacto
                </div>
                <ul className="space-y-1 text-emerald-800 dark:text-emerald-200/90">
                  <li>• Templates de Memorial ({listaTemplates.length})</li>
                  <li>• Cabeçalho Parecis / Grupo Geoeste</li>
                  <li>• Logotipo institucional padrão</li>
                </ul>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#1B2A3B] dark:text-slate-200">
                Para confirmar, digite{' '}
                <span className="font-mono font-extrabold text-red-600 dark:text-red-400">
                  ZERAR
                </span>{' '}
                no campo abaixo:
              </label>
              <input
                type="text"
                value={confirmacaoTextoReset}
                onChange={(e) => setConfirmacaoTextoReset(e.target.value)}
                placeholder="Digite ZERAR"
                disabled={executandoReset}
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm font-mono uppercase rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-100 focus:border-red-500 focus:outline-none"
              />
            </div>

            {erroReset && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erroReset}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={executandoReset}
                onClick={() => setModalResetAberto(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  executandoReset ||
                  confirmacaoTextoReset.trim().toUpperCase() !== 'ZERAR'
                }
                onClick={handleConfirmarResetTotal}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {executandoReset
                    ? 'Zerando Supabase...'
                    : 'Confirmar Reset Total'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR NOVO RELATÓRIO */}
      {modalNovoRelatorioAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#E8A020]" />
              Iniciar Novo Trabalho
            </h3>
            <p className="text-sm text-[#6B7A8D] dark:text-slate-400">
              Isso criará um novo formulário limpo mantendo o relatório anterior
              salvo no Histórico (Supabase). Confirmar?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNovoRelatorioAberto(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarNovoRelatorio}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A]"
              >
                Sim, limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECORTE 1:1 + ROTAÇÃO + LEGENDA */}
      {filaParaCorte.length > 0 && (
        <ImageCropModal
          filaArquivos={filaParaCorte}
          indiceInicialNumeroFoto={relatorioAtivo.fotos.length + 1}
          onConfirmarFotoCortada={adicionarFotoCortada}
          onFecharModal={() => setFilaParaCorte([])}
        />
      )}

      {/* MODAL DE GERENCIAMENTO DE TEMPLATES */}
      <TemplateManagerModal
        isOpen={modalGerenciarTemplatesAberta}
        onClose={() => setModalGerenciarTemplatesAberta(false)}
        templates={listaTemplates}
        textoAtualRelatorio={relatorioAtivo.descricaoServico}
        onSalvarTemplate={handleSalvarTemplateCustom}
        onExcluirTemplate={handleExcluirTemplateCustom}
        onAplicarTemplate={aplicarTemplateDescricao}
        onRecarregarTemplates={async () => {
          const atualizados = await carregarTodosTemplatesSupabase();
          setListaTemplates(atualizados);
        }}
        showToast={showToast}
      />

      {/* MODAL DE IMPORTAÇÃO DE ORDEM DE SERVIÇO MANUSCRITA (PDF / FOTO) */}
      <ImportarOSCampoModal
        isOpen={modalImportarOSAberta}
        onClose={() => setModalImportarOSAberta(false)}
        onAplicarDados={handleAplicarDadosOSCampo}
        showToast={showToast}
      />

      {/* CENTRAL DE LANÇAMENTO RÁPIDO DE HISTÓRICO (PDF EM LOTE + EXCEL/CSV + GRADE RÁPIDA) */}
      <ModalLancamentoRapidoHistorico
        isOpen={modalLancamentoRapidoAberta}
        onClose={() => setModalLancamentoRapidoAberta(false)}
        clientes={clientesCadastrados}
        pocos={pocosCadastrados}
        clienteInicialUuid={filtroLancamentoRapido.clienteUuid}
        pocoInicialUuid={filtroLancamentoRapido.pocoUuid}
        onImportarLoteOS={handleImportarLoteOS}
        showToast={showToast}
      />

      {/* MODAL DE AUDITORIA TÉCNICA E PARECER HIDROGEOLÓGICO (ABNT NBR 12.212 / 12.244) */}
      <ModalAuditoriaHidrogeologica
        isOpen={modalAuditoriaAberta}
        onClose={() => setModalAuditoriaAberta(false)}
        resultado={resultadoAuditoria}
        carregandoIA={carregandoAuditoriaIA}
        modoBloqueioExportacao={modoBloqueioExportacao}
        onExecutarAuditoriaIA={handleExecutarAuditoriaParecerIA}
        onAplicarSecoesNoRelatorio={handleAplicarSecoesAuditoriaNoRelatorio}
        onForcarExportacaoPDF={() =>
          executarExportacaoPDFDireta(
            relatorioPendenteExportacao || relatorioAtivo
          )
        }
        onIrParaSecao={(sec) => setSecaoAtiva(sec)}
      />

      {/* TOAST FLUTUANTE */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-7 sm:right-7 z-50 px-4 sm:px-5 py-3.5 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-2.5 transition-all ${
            toast.tipo === 'success' ? 'bg-[#27AE60]' : 'bg-[#E74C3C]'
          }`}
        >
          {toast.tipo === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.mensagem}</span>
        </div>
      )}
    </div>
  );
}

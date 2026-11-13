import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RelatorioTecnico,
  FotoRegistro,
  DadosCabecalho,
  DadosPocoArtesiano,
  CadastroPoco,
  TemplateServico,
  SecaoNavegacao,
  MembroEquipe,
  ItemServicoConduzido,
  ItemMaterialAplicado,
  NarrativasOcorrencias,
} from './types/relatorio';
import {
  listarRelatorios,
  salvarRelatorio,
  excluirRelatorio,
  listarPocos,
  salvarPoco,
  excluirPoco,
  criarPocoDemonstracaoLista,
  criarRelatorioEmBranco,
  criarRelatorioDemonstracao,
  criarRelatorioHistoricoAnteriorPT01,
  criarRelatorioInauguralPT01,
  TEMPLATES_SERVICO,
  obterTodosTemplates,
  salvarTemplateCustomizado,
  excluirTemplateCustomizado,
  sincronizarTemplatesNuvem,
  salvarConfigPadrao,
  obterConfigPadrao,
} from './services/indexedDbService';
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
} from './services/supabaseService';
import { useAuth } from './services/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { ImageCropModal, ArquivoParaCorte } from './components/ImageCropModal';
import { A4Preview } from './components/A4Preview';
import { PocosManager } from './components/PocosManager';
import { StepDrawdownSection } from './components/StepDrawdownSection';
import { TemplateManagerModal } from './components/TemplateManagerModal';
import { SignatureSection } from './components/SignatureSection';
import {
  ImportarOSCampoModal,
  DadosExtraidosOSCampo,
} from './components/ImportarOSCampoModal';
import { PocoLocationMap } from './components/PocoLocationMap';
import {
  Building2,
  Droplets,
  PenTool,
  Wrench,
  Package,
  CheckSquare,
  Camera,
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
} from 'lucide-react';

const SECOES_SIDEBAR: {
  id: SecaoNavegacao;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'cadastro_pocos', label: 'Cadastro de Poços', icon: Database },
  { id: 'identificacao', label: 'Identificação', icon: Building2 },
  { id: 'poco', label: 'Dados do Poço', icon: Droplets },
  { id: 'servicos', label: 'Serviços Executados', icon: Wrench },
  { id: 'materiais', label: 'Materiais Aplicados', icon: Package },
  { id: 'checklist', label: 'Checklist de Qualidade', icon: CheckSquare },
  { id: 'fotos', label: 'Registro Fotográfico', icon: Camera },
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

  const [pocosCadastrados, setPocosCadastrados] = useState<CadastroPoco[]>([]);
  const [relatoriosSalvos, setRelatoriosSalvos] = useState<RelatorioTecnico[]>(
    []
  );
  const [relatorioAtivo, setRelatorioAtivo] = useState<RelatorioTecnico>(() =>
    criarRelatorioDemonstracao()
  );
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoNavegacao>('preview');
  const [modalHistoricoAberto, setModalHistoricoAberto] =
    useState<boolean>(false);
  const [abaHistorico, setAbaHistorico] = useState<'local' | 'supabase'>('supabase');
  const [relatoriosSupabase, setRelatoriosSupabase] = useState<RelatorioTecnico[]>([]);
  const [carregandoSupabase, setCarregandoSupabase] = useState<boolean>(false);
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
  const [listaTemplates, setListaTemplates] = useState<TemplateServico[]>(() =>
    obterTodosTemplates()
  );
  const [modalGerenciarTemplatesAberta, setModalGerenciarTemplatesAberta] =
    useState<boolean>(false);
  const [modalImportarOSAberta, setModalImportarOSAberta] =
    useState<boolean>(false);

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
  const inputCameraRef = useRef<HTMLInputElement | null>(null);
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

  // Inicialização do Banco de Dados (Prioridade Supabase + Cache Local)
  useEffect(() => {
    let ativo = true;
    async function inicializarBanco() {
      try {
        let listaPocos: CadastroPoco[] = [];
        let listaRel: RelatorioTecnico[] = [];

        // 1. Tenta carregar primeiro diretamente da Nuvem Supabase
        if (isSupabaseConfigured) {
          try {
            const [pocosNuvem, relatoriosNuvem] = await Promise.all([
              listarPocosSupabase(),
              listarRelatoriosSupabase(),
            ]);

            if (pocosNuvem && pocosNuvem.length > 0) {
              listaPocos = pocosNuvem;
            }
            if (relatoriosNuvem && relatoriosNuvem.length > 0) {
              listaRel = relatoriosNuvem;
            }
          } catch (e) {
            console.warn('Falha ao carregar dados iniciais do Supabase:', e);
          }
        }

        // 2. Se o Supabase estiver vazio ou offline, carrega do IndexedDB ou cria demonstração
        if (listaPocos.length === 0) {
          const demosPocos = criarPocoDemonstracaoLista();
          for (const p of demosPocos) {
            await salvarPoco(p);
          }
          listaPocos = await listarPocos();
        }

        if (listaRel.length === 0) {
          const demoCorrigido = criarRelatorioDemonstracao();
          await salvarRelatorio(demoCorrigido);
          if (demoCorrigido.cabecalho.logoBase64) {
            await salvarConfigPadrao(
              'logoPadrao',
              demoCorrigido.cabecalho.logoBase64
            );
          }
          listaRel = await listarRelatorios();
        }

        if (!ativo) return;

        setPocosCadastrados(listaPocos);
        setRelatoriosSalvos(listaRel);
        setRelatoriosSupabase(listaRel);

        const relPrincipal =
          listaRel.find(
            (r) => r.uuid === 'laudo-hidrogeo-os-2026-0842-corrigido'
          ) ||
          listaRel[0];

        if (relPrincipal) {
          setRelatorioAtivo(relPrincipal);
        }

        setHorarioUltimoSave(new Date().toLocaleTimeString('pt-BR'));
        inicializadoRef.current = true;

        // Sincroniza templates em nuvem (Supabase) em segundo plano
        sincronizarTemplatesNuvem().then((tpls) => {
          if (ativo && tpls && tpls.length > 0) {
            setListaTemplates(tpls);
          }
        });
      } catch (err) {
        if (!ativo) return;
        setErroSistema(
          err instanceof Error
            ? err.message
            : 'Erro ao inicializar o banco de dados.'
        );
      }
    }

    inicializarBanco();
    return () => {
      ativo = false;
    };
  }, []);

  // Auto-save contínuo em IndexedDB (BLOB + Base64)
  useEffect(() => {
    if (!inicializadoRef.current) return;
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    setSalvandoAuto(true);
    autoSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const salvo = await salvarRelatorio(relatorioAtivo);
        setRelatoriosSalvos((prev) => {
          const semAtual = prev.filter((r) => r.uuid !== salvo.uuid);
          return [salvo, ...semAtual].sort(
            (a, b) => b.atualizadoEm - a.atualizadoEm
          );
        });
        setHorarioUltimoSave(new Date().toLocaleTimeString('pt-BR'));
      } catch {
        // Silencioso no auto-save
      } finally {
        setSalvandoAuto(false);
      }
    }, 650);

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

  // Persistência manual explícita (botão "Salvar no Banco")
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
      const salvo = await salvarRelatorio(relatorioAtivo);
      setRelatoriosSalvos((prev) => {
        const semAtual = prev.filter((r) => r.uuid !== salvo.uuid);
        return [salvo, ...semAtual].sort(
          (a, b) => b.atualizadoEm - a.atualizadoEm
        );
      });
      setHorarioUltimoSave(new Date().toLocaleTimeString('pt-BR'));

      if (isSupabaseConfigured) {
        const resNuvem = await salvarRelatorioSupabase(salvo);
        if (resNuvem.sucesso) {
          showToast(
            'Relatório salvo no Banco Local e sincronizado no Supabase (Nuvem)!',
            'success'
          );
          const listaNuvem = await listarRelatoriosSupabase();
          if (listaNuvem && listaNuvem.length > 0) {
            setRelatoriosSupabase(listaNuvem);
          }
        } else {
          showToast(
            `Salvo localmente. Erro no Supabase: ${resNuvem.erro || 'Falha de comunicação'}`,
            'error'
          );
        }
      } else {
        showToast('Relatório salvo com sucesso no banco de dados local!', 'success');
      }
    } catch {
      showToast('Erro ao salvar relatório no banco de dados.', 'error');
    }
  };

  // Operações do Cadastro de Poços
  const handleSalvarPocoNoBanco = async (poco: CadastroPoco) => {
    try {
      const salvo = await salvarPoco(poco);
      const listaAtualizada = await listarPocos();
      setPocosCadastrados(listaAtualizada);
      if (isSupabaseConfigured) {
        await salvarPocoSupabase(poco);
      }
      showToast(
        `Poço ${salvo.tag} (${salvo.nomeIdentificacao}) salvo no cadastro!`,
        'success'
      );
    } catch {
      showToast('Erro ao salvar cadastro do poço.', 'error');
    }
  };

  const handleExcluirPocoDoBanco = async (uuid: string) => {
    try {
      await excluirPoco(uuid);
      const listaAtualizada = await listarPocos();
      setPocosCadastrados(listaAtualizada);
      showToast('Poço removido do cadastro.', 'success');
    } catch {
      showToast('Erro ao excluir poço.', 'error');
    }
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

    setRelatorioAtivo((prev) => ({
      ...prev,
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
      const logoSalva = await obterConfigPadrao('logoPadrao');
      const novo = criarRelatorioEmBranco(
        {
          razaoSocial: relatorioAtivo.cabecalho.razaoSocial,
          cnpj: relatorioAtivo.cabecalho.cnpj,
          enderecoEmpresa: relatorioAtivo.cabecalho.enderecoEmpresa,
          cidadeContatoEmpresa: relatorioAtivo.cabecalho.cidadeContatoEmpresa,
          emailEmpresa: relatorioAtivo.cabecalho.emailEmpresa,
          logoBase64: logoSalva || relatorioAtivo.cabecalho.logoBase64,
        },
        poco
      );
      const salvo = await salvarRelatorio(novo);
      setRelatoriosSalvos((prev) => [salvo, ...prev]);
      setRelatorioAtivo(salvo);
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

    const existente = pocosCadastrados.find(
      (p) =>
        p.uuid === relatorioAtivo.pocoUuid ||
        p.tag.trim().toLowerCase() === tag.toLowerCase()
    );

    const agora = Date.now();
    const registroPoco: CadastroPoco = {
      uuid:
        existente?.uuid ||
        `poco-${agora}-${Math.random().toString(36).slice(2, 7)}`,
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
        existente?.aquiferoLitologia || 'Sistema Aquífero Parecis',
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
      const salvo = await salvarPoco(registroPoco);
      const lista = await listarPocos();
      setPocosCadastrados(lista);
      setRelatorioAtivo((prev) => ({
        ...prev,
        pocoUuid: salvo.uuid,
      }));
      showToast(
        existente
          ? `Ficha cadastral do poço ${salvo.tag} atualizada com sucesso!`
          : `Poço ${salvo.tag} cadastrado e vinculado a este relatório!`,
        'success'
      );
    } catch {
      showToast('Erro ao salvar poço no cadastro.', 'error');
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
          atualizarCabecalho('logoBase64', dataUrl);
          try {
            await salvarConfigPadrao('logoPadrao', dataUrl);
          } catch {
            // ignore
          }
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

  const handleSalvarTemplateCustom = (dados: {
    id?: string;
    titulo: string;
    categoria: string;
    conteudo: string;
  }) => {
    salvarTemplateCustomizado(dados);
    setListaTemplates(obterTodosTemplates());
  };

  const handleExcluirTemplateCustom = (id: string) => {
    excluirTemplateCustomizado(id);
    setListaTemplates(obterTodosTemplates());
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

    const novoRelatorio: RelatorioTecnico = {
      ...base,
      atualizadoEm: Date.now(),
      cabecalho: {
        ...base.cabecalho,
        contratoOS: dados.numeroOS || base.cabecalho.contratoOS,
        contratoRef: dados.contratoRef || base.cabecalho.contratoRef,
        tipoServico:
          dados.tipoServico ||
          base.cabecalho.tipoServico ||
          'MANUTENÇÃO PREVENTIVA DE POÇO ARTESIANO',
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
        nivelEstatico: dados.nivelEstatico || base.dadosPoco.nivelEstatico,
        nivelDinamico: dados.nivelDinamico || base.dadosPoco.nivelDinamico,
        vazaoTeste: dados.vazaoTeste || base.dadosPoco.vazaoTeste,
        crivo: dados.crivo || base.dadosPoco.crivo,
        eletrodoSuperior:
          dados.eletrodoSuperior || base.dadosPoco.eletrodoSuperior,
        eletrodoInferior:
          dados.eletrodoInferior || base.dadosPoco.eletrodoInferior,
        tuboEdutor: dados.tuboEdutor || base.dadosPoco.tuboEdutor,
        especificacaoBomba:
          dados.especificacaoBomba || base.dadosPoco.especificacaoBomba,
        motobombaEstado: dados.motobombaEstado
          ?.toLowerCase()
          .includes('novo')
          ? 'Novo'
          : 'Usado',
        painelEletrico:
          dados.painelEletrico || base.dadosPoco.painelEletrico,
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
      const salvo = await salvarRelatorio(novoRelatorio);
      setRelatoriosSalvos((prev) => {
        const semAtual = prev.filter((r) => r.uuid !== salvo.uuid);
        return [salvo, ...semAtual].sort(
          (a, b) => b.atualizadoEm - a.atualizadoEm
        );
      });
      if (isSupabaseConfigured) {
        const resNuvem = await salvarRelatorioSupabase(salvo);
        if (resNuvem.sucesso) {
          const listaNuvem = await listarRelatoriosSupabase();
          if (listaNuvem && listaNuvem.length > 0) {
            setRelatoriosSupabase(listaNuvem);
          }
        }
      }
      showToast(
        `Ordem de Serviço ${dados.numeroOS || ''} importada e sincronizada com sucesso!`,
        'success'
      );
    } catch {
      showToast(
        'Dados da O.S. preenchidos no relatório com sucesso!',
        'success'
      );
    }
  };

  // Fotos 1:1
  const handleSelecionarFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const listaArquivos: File[] = Array.from(files);
    const lidos: ArquivoParaCorte[] = [];
    let processados = 0;

    listaArquivos.forEach((arquivo, idx) => {
      if (!arquivo.type.startsWith('image/')) {
        processados++;
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        lidos.push({
          id: `crop-${Date.now()}-${idx}`,
          nomeArquivo: arquivo.name,
          dataUrlOriginal: String(reader.result),
        });
        processados++;
        if (processados === listaArquivos.length && lidos.length > 0) {
          setFilaParaCorte(lidos);
        }
      };
      reader.readAsDataURL(arquivo);
    });

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

  // Novo Relatório / Clonar / Excluir
  const handleConfirmarNovoRelatorio = async () => {
    try {
      const logoSalva = await obterConfigPadrao('logoPadrao');
      const novo = criarRelatorioEmBranco({
        razaoSocial: relatorioAtivo.cabecalho.razaoSocial,
        cnpj: relatorioAtivo.cabecalho.cnpj,
        enderecoEmpresa: relatorioAtivo.cabecalho.enderecoEmpresa,
        cidadeContatoEmpresa: relatorioAtivo.cabecalho.cidadeContatoEmpresa,
        emailEmpresa: relatorioAtivo.cabecalho.emailEmpresa,
        logoBase64: logoSalva || relatorioAtivo.cabecalho.logoBase64,
      });
      const salvo = await salvarRelatorio(novo);
      setRelatoriosSalvos((prev) => [salvo, ...prev]);
      setRelatorioAtivo(salvo);
      setSecaoAtiva('identificacao');
      setModalNovoRelatorioAberto(false);
      showToast('Formulário limpo! Novo relatório iniciado.', 'success');
    } catch {
      showToast('Erro ao iniciar novo relatório.', 'error');
    }
  };

  const handleBuscarRelatoriosSupabase = async () => {
    setCarregandoSupabase(true);
    try {
      const lista = await listarRelatoriosSupabase();
      setRelatoriosSupabase(lista);
    } catch (err) {
      console.warn('Erro ao carregar do Supabase:', err);
    } finally {
      setCarregandoSupabase(false);
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
        uuid: `rel-clone-${agora}`,
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
      } else if (secaoAtiva === 'cadastro_pocos') {
        setSecaoAtiva('identificacao');
      }
      showToast('Relatório carregado com sucesso!', 'success');
    }
  };

  const handleExcluirDoHistorico = async (uuid: string) => {
    try {
      await excluirRelatorio(uuid);
      const restantes = relatoriosSalvos.filter((r) => r.uuid !== uuid);
      if (restantes.length === 0) {
        const novo = criarRelatorioEmBranco(relatorioAtivo.cabecalho);
        const salvo = await salvarRelatorio(novo);
        setRelatoriosSalvos([salvo]);
        setRelatorioAtivo(salvo);
      } else {
        setRelatoriosSalvos(restantes);
        if (relatorioAtivo.uuid === uuid) {
          setRelatorioAtivo(restantes[0]);
        }
      }
      showToast('Relatório removido do navegador.', 'success');
    } catch {
      showToast('Erro ao excluir relatório.', 'error');
    }
  };

  // Exportação PDF via jsPDF (do relatório ativo ou de um relatório específico do histórico do poço)
  const handleExportarPDF = async (relatorioAlvo?: RelatorioTecnico) => {
    const alvo = relatorioAlvo || relatorioAtivo;
    try {
      setExportandoPdf(true);
      const nomeArquivo = await exportarRelatorioPDF(alvo);
      const atualizado: RelatorioTecnico = {
        ...alvo,
        status: 'exportado',
      };
      if (alvo.uuid === relatorioAtivo.uuid) {
        setRelatorioAtivo(atualizado);
      }
      await salvarRelatorio(atualizado);
      setRelatoriosSalvos((prev) =>
        prev.map((r) => (r.uuid === atualizado.uuid ? atualizado : r))
      );
      showToast(`PDF exportado com sucesso: ${nomeArquivo}`, 'success');
    } catch {
      showToast('Erro ao exportar o arquivo PDF.', 'error');
    } finally {
      setExportandoPdf(false);
    }
  };

  const [sidebarRetraida, setSidebarRetraida] = useState<boolean>(false);

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
            onClick={() => setSidebarRetraida((prev) => !prev)}
            title={
              sidebarRetraida
                ? 'Expandir menu lateral de seções'
                : 'Recolher menu lateral para ampliar a tela do sistema'
            }
            className="hidden lg:inline-flex items-center justify-center p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 hover:text-[#E8A020] transition-colors"
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
                ? 'Conectado ao Supabase (Sincronização em Nuvem Ativa)'
                : 'Modo Offline-First (IndexedDB Local Ativo. Configure VITE_SUPABASE_URL na Vercel para nuvem).'
            }
            className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
              isSupabaseConfigured
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-white/10 text-white/70 border border-white/15'
            }`}
          >
            <Cloud className="w-3 h-3 shrink-0" />
            <span>{isSupabaseConfigured ? 'Supabase' : 'IndexedDB Local'}</span>
          </span>
        </div>

        {/* Zone 2: Nav Links (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-4 xl:gap-6 text-xs font-semibold text-white/85 overflow-x-auto no-scrollbar">
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
            <span>Histórico ({relatoriosSupabase.length > 0 ? relatoriosSupabase.length : relatoriosSalvos.length})</span>
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
            <span>Importar</span>
          </button>
          <button
            type="button"
            onClick={handlePersistirManual}
            className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-[#E8A020] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            title="Salvar alterações no banco de dados local (IndexedDB) e sincronizar com o Supabase na nuvem"
          >
            <Save className="w-3.5 h-3.5 text-[#E8A020]" />
            <span className="hidden xl:inline">Salvar no Banco</span>
            <span className="xl:hidden">Salvar</span>
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

      {/* LAYOUT PRINCIPAL (Sidebar Colapsável no Desktop + Barra Horizontal Sticky no Mobile/Tablet + Main Content Fluido) */}
      <div
        className={`flex-1 grid grid-cols-1 ${
          sidebarRetraida
            ? 'lg:grid-cols-[68px_1fr]'
            : 'lg:grid-cols-[235px_1fr]'
        } min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-60px)] transition-all duration-200`}
      >
        {/* SIDEBAR DE SEÇÕES DO TRABALHO */}
        <aside className="sticky top-14 sm:top-[60px] z-30 bg-[#243447] text-white py-2 px-3 lg:py-4 lg:px-0 lg:h-[calc(100vh-60px)] border-b border-white/10 lg:border-b-0 flex flex-col justify-between overflow-x-auto lg:overflow-y-auto print:hidden shadow-xs lg:shadow-none">
          <div>
            <div
              className={`${
                sidebarRetraida ? 'lg:px-2' : 'lg:px-3.5'
              } lg:pb-4 lg:border-b lg:border-white/10`}
            >
              {!sidebarRetraida && (
                <div className="hidden lg:flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/40 px-2 pb-2.5">
                  <span>Módulos & Seções</span>
                </div>
              )}
              <div className="flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto lg:overflow-x-visible no-scrollbar">
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
                        if (window.innerWidth < 1024) {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`lg:w-full flex items-center ${
                        sidebarRetraida
                          ? 'lg:justify-center lg:px-2'
                          : 'gap-2 lg:gap-2.5 px-3'
                      } py-2 lg:py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                        ativo
                          ? 'bg-[#E8A020] text-[#1B2A3B] shadow-xs'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={sidebarRetraida ? 'lg:hidden' : ''}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ações rápidas (Desktop Sidebar) */}
            {!sidebarRetraida && (
              <div className="hidden lg:flex px-3.5 py-3 border-b border-white/10 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setModalHistoricoAberto(true)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                  <span className="truncate">
                    Histórico Salvos ({relatoriosSalvos.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handlePersistirManual}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                  <span className="truncate">Salvar</span>
                </button>
              </div>
            )}
          </div>

          {/* Barra de Progresso do Relatório (Desktop Sidebar) */}
          {!sidebarRetraida ? (
            <div className="hidden lg:block p-4 space-y-2">
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
                  ? 'Sincronizando BLOB...'
                  : horarioUltimoSave
                  ? `Auto-save: ${horarioUltimoSave}`
                  : 'IndexedDB Ativo'}
              </p>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center p-2 pb-4 gap-1">
              <span className="text-[10px] font-mono font-bold text-[#E8A020]">
                {progressoPct}%
              </span>
            </div>
          )}
        </aside>

        {/* ÁREA PRINCIPAL DO SISTEMA (Fluida até 1680px para aproveitar toda a largura da tela) */}
        <main className="p-4 sm:p-6 xl:p-8 min-w-0 max-w-[1680px] w-full mx-auto">
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

          {/* MÓDULO: CADASTRO DE POÇOS & HISTÓRICO POR POÇO */}
          {secaoAtiva === 'cadastro_pocos' && (
            <PocosManager
              pocos={pocosCadastrados}
              relatorios={relatoriosSalvos}
              onSalvarPoco={handleSalvarPocoNoBanco}
              onExcluirPoco={handleExcluirPocoDoBanco}
              onIniciarNovaOSNoPoco={handleIniciarNovaOSNoPoco}
              onAbrirRelatorio={(rel, preview) =>
                handleCarregarDoHistorico(rel, false, preview)
              }
              onExportarPDFRelatorio={(rel) => handleExportarPDF(rel)}
            />
          )}

          {/* TIMBRE NA INTERFACE DO FORMULÁRIO (Parecis Perfuração de Poços e Sondagens Ltda) */}
          {secaoAtiva !== 'preview' && secaoAtiva !== 'cadastro_pocos' && (
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
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('cadastro_pocos')}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Database className="w-3.5 h-3.5 text-[#E8A020]" />
                  <span>Gerenciar Cadastro & Histórico por Poço</span>
                </button>
              </div>

              {/* Barra Rápida: Carregar Poço Cadastrado */}
              <div className="rounded-xl border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-900 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Droplets className="w-5 h-5 text-[#E8A020] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100">
                      Vincular a um Poço
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                  <select
                    value={pocoVinculadoAtivo?.uuid || ''}
                    onChange={(e) =>
                      handleVincularPocoAoRelatorioAtivo(e.target.value)
                    }
                    className="w-full md:w-auto md:min-w-[260px] px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                  >
                    <option value="">— Selecionar poço cadastrado —</option>
                    {pocosCadastrados.map((p) => (
                      <option key={p.uuid} value={p.uuid}>
                        {p.tag} — {p.nomeIdentificacao} ({p.cliente})
                      </option>
                    ))}
                  </select>
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
                      value={relatorioAtivo.cabecalho.tipoServico || ''}
                      onChange={(e) =>
                        atualizarCabecalho('tipoServico', e.target.value)
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    >
                      <option value="">Selecione…</option>
                      <option value="Manutenção Preventiva">
                        Manutenção Preventiva
                      </option>
                      <option value="Manutenção Corretiva">
                        Manutenção Corretiva
                      </option>
                      <option value="Manutenção Conjunto-Motobomba">
                        Manutenção Conjunto-Motobomba
                      </option>
                      <option value="Limpeza Completa de Poço">
                        Limpeza Completa de Poço
                      </option>
                      <option value="Perfuração de Poço Tubular">
                        Perfuração de Poço Tubular
                      </option>
                      <option value="Teste de Vazão / Bombeamento">
                        Teste de Vazão / Bombeamento
                      </option>
                      <option value="Sondagem SPT / Geotecnia">
                        Sondagem SPT / Geotecnia
                      </option>
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
                      Crivo (Posição da Bomba)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.crivo}
                      onChange={(e) =>
                        atualizarDadosPoco('crivo', e.target.value)
                      }
                      placeholder="Ex: 120m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#B86E00] dark:text-[#E8A020] mb-1.5">
                      Nível Estático — NE (Medição da O.S.)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.nivelEstatico}
                      onChange={(e) =>
                        atualizarDadosPoco('nivelEstatico', e.target.value)
                      }
                      placeholder="Ex: 24,5m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#E8A020]/60 bg-[#FFFDF7] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#B86E00] dark:text-[#E8A020] mb-1.5">
                      Nível Dinâmico — ND (Medição da O.S.)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.nivelDinamico}
                      onChange={(e) =>
                        atualizarDadosPoco('nivelDinamico', e.target.value)
                      }
                      placeholder="Ex: 52,0m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#E8A020]/60 bg-[#FFFDF7] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#27AE60] mb-1.5">
                      Vazão Mensurada (Medição da O.S.)
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.vazaoTeste}
                      onChange={(e) =>
                        atualizarDadosPoco('vazaoTeste', e.target.value)
                      }
                      placeholder="Ex: 16,5 m³/h"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#27AE60]/50 bg-[#F4FBF7] dark:bg-slate-950 focus:bg-white focus:border-[#27AE60] focus:outline-none"
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
                      placeholder="Ex: Geomecânico"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Eletrodo Superior
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.eletrodoSuperior}
                      onChange={(e) =>
                        atualizarDadosPoco('eletrodoSuperior', e.target.value)
                      }
                      placeholder="Ex: 45m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400 mb-1.5">
                      Eletrodo Inferior
                    </label>
                    <input
                      type="text"
                      value={relatorioAtivo.dadosPoco.eletrodoInferior}
                      onChange={(e) =>
                        atualizarDadosPoco('eletrodoInferior', e.target.value)
                      }
                      placeholder="Ex: 50m"
                      className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
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
                  accept="image/*"
                  multiple
                  onChange={handleSelecionarFotos}
                  className="hidden"
                />
                <input
                  ref={inputCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleSelecionarFotos}
                  className="hidden"
                />

                {/* Zona de Upload Clicável */}
                <div
                  onClick={() => inputFotosRef.current?.click()}
                  className="border-2 border-dashed border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] rounded-xl p-5 sm:p-7 text-center cursor-pointer bg-[#F7F9FC] dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 transition-all space-y-2"
                >
                  <Camera className="w-8 h-8 text-[#E8A020] mx-auto" />
                  <div className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                    Clique para adicionar evidência fotográfica
                  </div>
                  <div className="text-xs text-[#6B7A8D] dark:text-slate-400">
                    Permite enquadrar na proporção 1:1, aplicar zoom/rotação e definir a legenda técnica
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        inputCameraRef.current?.click();
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#E8A020]" />
                      Usar Câmera Mobile
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        inputFotosRef.current?.click();
                      }}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A] flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Escolher da Galeria
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

      {/* MODAL DE HISTÓRICO GERAL / RELATÓRIOS SALVOS NO NAVEGADOR */}
      {modalHistoricoAberto &&
        (() => {
          const normalizarTexto = (txt: string) =>
            (txt || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

          const termoNormalizado = normalizarTexto(buscaHistorico.trim());

          const listaOrigem = abaHistorico === 'supabase' ? relatoriosSupabase : relatoriosSalvos;

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
                      <FolderOpen className="w-4 h-4 text-[#E8A020]" />
                      <span>Histórico de Relatórios Técnicos</span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#6B7A8D] dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      Exibindo {relatoriosHistoricoFiltrados.length} de{' '}
                      {listaOrigem.length} relatório(s) ({abaHistorico === 'supabase' ? 'Nuvem Supabase' : 'Armazenamento Local'})
                    </p>
                  </div>

                  {/* Alternador de Origem: IndexedDB Local vs Supabase */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setAbaHistorico('local')}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          abaHistorico === 'local'
                            ? 'bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5 text-[#E8A020]" />
                        <span>Navegador ({relatoriosSalvos.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAbaHistorico('supabase');
                          handleBuscarRelatoriosSupabase();
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          abaHistorico === 'supabase'
                            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>
                          {carregandoSupabase ? 'Carregando...' : `Supabase (${relatoriosSupabase.length})`}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalHistoricoAberto(false)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 whitespace-nowrap shrink-0"
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
                        {abaHistorico === 'supabase'
                          ? 'Nenhum relatório encontrado na nuvem do Supabase ainda.'
                          : 'Nenhum relatório salvo encontrado neste navegador.'}
                      </p>
                      <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                        {abaHistorico === 'supabase'
                          ? 'Ao clicar em "Salvar no Banco", os relatórios sincronizam automaticamente com a nuvem.'
                          : 'Os relatórios salvos localmente aparecem nesta aba.'}
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
                                    title="Excluir"
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
              salvo no Histórico. Confirmar?
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
        onRecarregarTemplates={() => setListaTemplates(obterTodosTemplates())}
        showToast={showToast}
      />

      {/* MODAL DE IMPORTAÇÃO DE ORDEM DE SERVIÇO MANUSCRITA (PDF / FOTO) */}
      <ImportarOSCampoModal
        isOpen={modalImportarOSAberta}
        onClose={() => setModalImportarOSAberta(false)}
        onAplicarDados={handleAplicarDadosOSCampo}
        showToast={showToast}
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

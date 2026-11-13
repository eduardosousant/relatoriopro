import React, { useState, useRef } from 'react';
import { CadastroPoco, RelatorioTecnico } from '../types/relatorio';
import { formatarDataBR } from '../services/pdfExportService';
import { PocoHydroChart } from './PocoHydroChart';
import { PocoLocationMap } from './PocoLocationMap';
import {
  Plus,
  Search,
  Droplets,
  MapPin,
  FileText,
  Edit3,
  Trash2,
  Activity,
  FolderOpen,
  FileDown,
  Check,
  X,
} from 'lucide-react';

interface PocosManagerProps {
  pocos: CadastroPoco[];
  relatorios: RelatorioTecnico[];
  onSalvarPoco: (poco: CadastroPoco) => Promise<void>;
  onExcluirPoco: (uuid: string) => Promise<void>;
  onIniciarNovaOSNoPoco: (poco: CadastroPoco) => void;
  onAbrirRelatorio: (relatorio: RelatorioTecnico, irParaPreview?: boolean) => void;
  onExportarPDFRelatorio: (relatorio: RelatorioTecnico) => void;
}

/**
 * Extrai valor numérico de strings como "24,5m", "16.5 m³/h" para cálculo de rebaixamento (ND - NE)
 */
function extrairNumero(valor?: string): number | null {
  if (!valor) return null;
  const limpo = valor.replace(',', '.').replace(/[^0-9.-]/g, '');
  const num = parseFloat(limpo);
  return Number.isFinite(num) ? num : null;
}

export const PocosManager: React.FC<PocosManagerProps> = ({
  pocos,
  relatorios,
  onSalvarPoco,
  onExcluirPoco,
  onIniciarNovaOSNoPoco,
  onAbrirRelatorio,
  onExportarPDFRelatorio,
}) => {
  const [busca, setBusca] = useState<string>('');
  const [pocoSelecionadoUuid, setPocoSelecionadoUuid] = useState<string>(
    pocos[0]?.uuid || ''
  );
  const [modoFormulario, setModoFormulario] = useState<
    'fechado' | 'novo' | 'editar'
  >('fechado');
  const [confirmarExclusaoUuid, setConfirmarExclusaoUuid] = useState<
    string | null
  >(null);
  const detalhesPocoRef = useRef<HTMLDivElement | null>(null);

  const criarFormularioVazio = (): CadastroPoco => ({
    uuid: `poco-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tag: `PT0${pocos.length + 1}`,
    nomeIdentificacao: '',
    cliente: '',
    clienteCNPJ: '',
    enderecoLocal: '',
    cidadeUF: 'Sorriso - MT',
    coordenadasUTM: '',
    contatoLocal: '',
    telefoneContato: '',
    profundidadeTotal: '',
    diametroRevestimento: '6 polegadas',
    dataPerfuracao: '',
    numeroOutorga: '',
    aquiferoLitologia: 'Sistema Aquífero Parecis',
    crivoPadrao: '',
    tuboEdutorPadrao: 'Geomecânico',
    eletrodoSuperiorPadrao: '',
    eletrodoInferiorPadrao: '',
    bombaAtual: '',
    painelAtual: '',
    observacoesTecnicas: '',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  });

  const [formPoco, setFormPoco] = useState<CadastroPoco>(criarFormularioVazio);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const normalizar = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const termo = normalizar(busca.trim());
  const pocosFiltrados = pocos.filter((p) => {
    if (!termo) return true;
    return (
      normalizar(p.tag).includes(termo) ||
      normalizar(p.nomeIdentificacao).includes(termo) ||
      normalizar(p.cliente).includes(termo) ||
      normalizar(p.enderecoLocal).includes(termo) ||
      normalizar(p.numeroOutorga || '').includes(termo)
    );
  });

  const pocoAtivo =
    pocos.find((p) => p.uuid === pocoSelecionadoUuid) || pocosFiltrados[0];

  // Filtra todos os relatórios vinculados a um poço (por pocoUuid ou correspondência de TAG + Cliente)
  const obterRelatoriosDoPoco = (poco?: CadastroPoco): RelatorioTecnico[] => {
    if (!poco) return [];
    return relatorios
      .filter((rel) => {
        if (rel.pocoUuid && rel.pocoUuid === poco.uuid) return true;
        const mesmaTag =
          normalizar(rel.dadosPoco?.pocoId || '') === normalizar(poco.tag);
        const mesmoCliente =
          normalizar(rel.cabecalho.cliente) === normalizar(poco.cliente);
        return mesmaTag && (mesmoCliente || !rel.pocoUuid);
      })
      .sort((a, b) => {
        const dataA = a.cabecalho.dataExecucao || '';
        const dataB = b.cabecalho.dataExecucao || '';
        if (dataA !== dataB) return dataB.localeCompare(dataA);
        return b.atualizadoEm - a.atualizadoEm;
      });
  };

  const relatoriosDoPocoAtivo = obterRelatoriosDoPoco(pocoAtivo);

  const abrirNovoCadastro = () => {
    setFormPoco(criarFormularioVazio());
    setErroForm(null);
    setModoFormulario('novo');
  };

  const abrirEdicaoCadastro = (poco: CadastroPoco) => {
    setFormPoco({ ...poco });
    setErroForm(null);
    setModoFormulario('editar');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPoco.tag.trim()) {
      setErroForm('Informe a TAG do poço (ex: PT01).');
      return;
    }
    if (!formPoco.cliente.trim()) {
      setErroForm('Informe o nome / Razão Social do cliente proprietário.');
      return;
    }
    if (!formPoco.enderecoLocal.trim()) {
      setErroForm('Informe o endereço ou localização do poço.');
      return;
    }

    await onSalvarPoco({
      ...formPoco,
      tag: formPoco.tag.trim().toUpperCase(),
      atualizadoEm: Date.now(),
    });
    setPocoSelecionadoUuid(formPoco.uuid);
    setModoFormulario('fechado');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100">
            Cadastro de Poços & Prontuário Histórico por Poço
          </h1>
          <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-0.5">
            Gerencie os dados construtivos fixos de cada poço e acompanhe o histórico de relatórios e variações de Vazão, NE e ND ao longo do tempo.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirNovoCadastro}
          className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Novo Poço
        </button>
      </div>

      {/* Formulário Modal / Card de Criação e Edição de Poço */}
      {modoFormulario !== 'fechado' && (
        <form
          onSubmit={handleSubmitForm}
          className="rounded-xl border-2 border-[#E8A020] bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-lg space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100">
                {modoFormulario === 'novo'
                  ? 'Novo Cadastro de Poço Artesiano'
                  : `Editando Cadastro do Poço ${formPoco.tag}`}
              </h2>
              <p className="text-xs text-[#6B7A8D]">
                Estes dados serão carregados automaticamente sempre que você abrir uma nova O.S. para este poço.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoFormulario('fechado')}
              className="p-1.5 rounded-lg text-[#6B7A8D] hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {erroForm && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {erroForm}
            </div>
          )}

          {/* Bloco 1: Identificação, Cliente e Localização */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
              1. Identificação, Cliente e Endereço Fixo
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  TAG do Poço *
                </label>
                <input
                  type="text"
                  value={formPoco.tag}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, tag: e.target.value })
                  }
                  placeholder="Ex: PT01"
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Nome / Setor do Poço
                </label>
                <input
                  type="text"
                  value={formPoco.nomeIdentificacao}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      nomeIdentificacao: e.target.value,
                    })
                  }
                  placeholder="Ex: Poço Sede / Pivô Central 02 / Indústria"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Cliente / Razão Social *
                </label>
                <input
                  type="text"
                  value={formPoco.cliente}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, cliente: e.target.value })
                  }
                  placeholder="Razão Social ou Proprietário"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  CNPJ / CPF
                </label>
                <input
                  type="text"
                  value={formPoco.clienteCNPJ}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, clienteCNPJ: e.target.value })
                  }
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Endereço / Fazenda / Localização *
                </label>
                <input
                  type="text"
                  value={formPoco.enderecoLocal}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, enderecoLocal: e.target.value })
                  }
                  placeholder="Rodovia, Km, Gleba ou Rua/Bairro"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Cidade / UF
                </label>
                <input
                  type="text"
                  value={formPoco.cidadeUF}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, cidadeUF: e.target.value })
                  }
                  placeholder="Sorriso - MT"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Coordenadas UTM / Geográficas (Lat/Lon)
                </label>
                <input
                  type="text"
                  value={formPoco.coordenadasUTM}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, coordenadasUTM: e.target.value })
                  }
                  placeholder="Ex: LAT -15.6014 LON -56.0979 ou Zona 21L"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-4">
                <PocoLocationMap
                  coordenadasGeograficas={formPoco.coordenadasUTM}
                  coordenadasUTM={formPoco.coordenadasUTM}
                  pocoTag={formPoco.tag}
                  cliente={formPoco.cliente}
                  localizacao={formPoco.enderecoLocal}
                  cidadeUF={formPoco.cidadeUF}
                  variant="compact"
                  onChangeCoordenadas={({
                    coordenadasGeograficas,
                    coordenadasUTM,
                  }) =>
                    setFormPoco((prev) => ({
                      ...prev,
                      coordenadasUTM: `${coordenadasGeograficas} | ${coordenadasUTM}`,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Contato Local
                </label>
                <input
                  type="text"
                  value={formPoco.contatoLocal}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, contatoLocal: e.target.value })
                  }
                  placeholder="Nome do responsável"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  value={formPoco.telefoneContato}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      telefoneContato: e.target.value,
                    })
                  }
                  placeholder="(65) 99999-0000"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          {/* Bloco 2: Características Construtivas Permanentes e Outorga */}
          <div className="space-y-3 pt-2 border-t border-[#DDE3EC] dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
              2. Dados Construtivos Permanentes, Geologia e Outorga
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Profundidade Total
                </label>
                <input
                  type="text"
                  value={formPoco.profundidadeTotal}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      profundidadeTotal: e.target.value,
                    })
                  }
                  placeholder="Ex: 150m"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Diâmetro (Ø) / Revestimento
                </label>
                <input
                  type="text"
                  value={formPoco.diametroRevestimento}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      diametroRevestimento: e.target.value,
                    })
                  }
                  placeholder="Ex: 6 polegadas"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Data de Perfuração
                </label>
                <input
                  type="date"
                  value={formPoco.dataPerfuracao || ''}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, dataPerfuracao: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Nº Outorga (SEMA-MT / ANA)
                </label>
                <input
                  type="text"
                  value={formPoco.numeroOutorga || ''}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, numeroOutorga: e.target.value })
                  }
                  placeholder="Ex: Portaria SEMA Nº 1184/23"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Aquífero / Formação Geológica
                </label>
                <input
                  type="text"
                  value={formPoco.aquiferoLitologia || ''}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      aquiferoLitologia: e.target.value,
                    })
                  }
                  placeholder="Ex: Sistema Aquífero Parecis (Arenito)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Posição do Crivo Padrão
                </label>
                <input
                  type="text"
                  value={formPoco.crivoPadrao}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, crivoPadrao: e.target.value })
                  }
                  placeholder="Ex: 120m"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Tubo Edutor Instalado
                </label>
                <input
                  type="text"
                  value={formPoco.tuboEdutorPadrao}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      tuboEdutorPadrao: e.target.value,
                    })
                  }
                  placeholder='Ex: Geomecânico 2.1/2"'
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Eletrodo Superior
                </label>
                <input
                  type="text"
                  value={formPoco.eletrodoSuperiorPadrao}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      eletrodoSuperiorPadrao: e.target.value,
                    })
                  }
                  placeholder="Ex: 45m"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Eletrodo Inferior
                </label>
                <input
                  type="text"
                  value={formPoco.eletrodoInferiorPadrao}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      eletrodoInferiorPadrao: e.target.value,
                    })
                  }
                  placeholder="Ex: 50m"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Conjunto Moto-Bomba Atual de Referência
                </label>
                <input
                  type="text"
                  value={formPoco.bombaAtual}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, bombaAtual: e.target.value })
                  }
                  placeholder="Ex: Submersa Ebara 7.5 HP 380V"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Painel Elétrico Atual
                </label>
                <input
                  type="text"
                  value={formPoco.painelAtual}
                  onChange={(e) =>
                    setFormPoco({ ...formPoco, painelAtual: e.target.value })
                  }
                  placeholder="Ex: Partida direta com disjuntor-motor"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                  Observações Construtivas Fixas (Filtros, Cimentação, etc.)
                </label>
                <input
                  type="text"
                  value={formPoco.observacoesTecnicas || ''}
                  onChange={(e) =>
                    setFormPoco({
                      ...formPoco,
                      observacoesTecnicas: e.target.value,
                    })
                  }
                  placeholder="Ex: Seção filtrante de 96m a 136m..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#DDE3EC] dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModoFormulario('fechado')}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar Cadastro do Poço
            </button>
          </div>
        </form>
      )}

      {/* Layout Principal: Lista de Poços (Esquerda em XL+) + Prontuário e Histórico do Poço (Direita) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Coluna Esquerda: Lista de Poços Cadastrados */}
        <div className="xl:col-span-4 2xl:col-span-3 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden xl:sticky xl:top-[76px]">
          <div className="p-4 border-b border-[#DDE3EC] dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
              <span>Poços Cadastrados ({pocos.length})</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7A8D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar TAG (PT01), cliente, fazenda..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
              />
            </div>
          </div>

          <div className="divide-y xl:divide-y divide-[#DDE3EC] dark:divide-slate-800 max-h-[260px] xl:max-h-[calc(100vh-220px)] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1">
            {pocosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7A8D] sm:col-span-2 xl:col-span-1">
                Nenhum poço encontrado para esta busca.
              </div>
            ) : (
              pocosFiltrados.map((p) => {
                const selecionado = pocoAtivo?.uuid === p.uuid;
                const qtdRelatorios = obterRelatoriosDoPoco(p).length;
                return (
                  <div
                    key={p.uuid}
                    onClick={() => {
                      setPocoSelecionadoUuid(p.uuid);
                      if (window.innerWidth < 1280 && detalhesPocoRef.current) {
                        setTimeout(() => {
                          detalhesPocoRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }, 60);
                      }
                    }}
                    className={`p-3.5 sm:p-4 cursor-pointer transition-colors ${
                      selecionado
                        ? 'bg-[#1B2A3B] text-white'
                        : 'hover:bg-[#F7F9FC] dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-mono font-bold ${
                          selecionado
                            ? 'text-[#E8A020]'
                            : 'text-[#1B2A3B] dark:text-slate-100'
                        }`}
                      >
                        {p.tag}
                      </span>
                      <span
                        className={`text-[11px] font-mono ${
                          selecionado ? 'text-white/75' : 'text-[#6B7A8D]'
                        }`}
                      >
                        {qtdRelatorios}{' '}
                        {qtdRelatorios === 1 ? 'relatório' : 'relatórios'}
                      </span>
                    </div>

                    <p
                      className={`text-xs font-bold mt-1 truncate ${
                        selecionado
                          ? 'text-white'
                          : 'text-[#1B2A3B] dark:text-slate-200'
                      }`}
                    >
                      {p.cliente}
                    </p>
                    <p
                      className={`text-[11px] truncate mt-0.5 ${
                        selecionado ? 'text-white/70' : 'text-[#6B7A8D]'
                      }`}
                    >
                      {p.nomeIdentificacao || p.enderecoLocal}
                    </p>
                    <div
                      className={`flex items-center gap-2 text-[11px] font-mono mt-2 ${
                        selecionado ? 'text-white/60' : 'text-[#6B7A8D]'
                      }`}
                    >
                      <span>Prof: {p.profundidadeTotal || 'N/I'}</span>
                      <span>·</span>
                      <span>Ø {p.diametroRevestimento || 'N/I'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna Direita: Prontuário Completo e Histórico Hidrodinâmico do Poço Selecionado */}
        <div ref={detalhesPocoRef} className="xl:col-span-8 2xl:col-span-9 space-y-5 scroll-mt-28 min-w-0">
          {!pocoAtivo ? (
            <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 text-center text-sm text-[#6B7A8D]">
              Selecione um poço ao lado ou cadastre um novo poço para visualizar seu prontuário e histórico de relatórios.
            </div>
          ) : (
            <>
              {/* Card 1: Ficha Técnica Cadastral do Poço */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#DDE3EC] dark:border-slate-800 pb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Droplets className="w-5 h-5 text-[#E8A020] shrink-0" />
                      <h2 className="text-base sm:text-lg font-bold text-[#1B2A3B] dark:text-slate-100 font-mono truncate">
                        {pocoAtivo.tag} —{' '}
                        <span className="font-sans">
                          {pocoAtivo.nomeIdentificacao || 'Poço Tubular Profundo'}
                        </span>
                      </h2>
                    </div>
                    <p className="text-xs text-[#6B7A8D] mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {pocoAtivo.cliente} · {pocoAtivo.enderecoLocal} (
                        {pocoAtivo.cidadeUF})
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicaoCadastro(pocoAtivo)}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar Poço</span>
                    </button>

                    {confirmarExclusaoUuid === pocoAtivo.uuid ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onExcluirPoco(pocoAtivo.uuid);
                            setConfirmarExclusaoUuid(null);
                          }}
                          className="px-2.5 py-2 text-xs font-bold rounded-lg bg-red-600 text-white"
                        >
                          Confirmar Exclusão
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarExclusaoUuid(null)}
                          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmarExclusaoUuid(pocoAtivo.uuid)}
                        className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        title="Excluir cadastro do poço"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onIniciarNovaOSNoPoco(pocoAtivo)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nova O.S. para este Poço</span>
                    </button>
                  </div>
                </div>

                {/* Grid de Dados Construtivos Fixos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                    <span className="block text-[10px] font-bold uppercase text-[#6B7A8D]">
                      Profundidade Total
                    </span>
                    <span className="font-mono font-bold text-sm mt-0.5 block">
                      {pocoAtivo.profundidadeTotal || '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                    <span className="block text-[10px] font-bold uppercase text-[#6B7A8D]">
                      Diâmetro / Revest.
                    </span>
                    <span className="font-semibold text-sm mt-0.5 block truncate">
                      {pocoAtivo.diametroRevestimento || '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                    <span className="block text-[10px] font-bold uppercase text-[#6B7A8D]">
                      Crivo / Edutor
                    </span>
                    <span className="font-mono font-semibold text-xs mt-0.5 block truncate">
                      {pocoAtivo.crivoPadrao || '—'} ·{' '}
                      {pocoAtivo.tuboEdutorPadrao || '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                    <span className="block text-[10px] font-bold uppercase text-[#6B7A8D]">
                      Outorga / Perfuração
                    </span>
                    <span className="font-mono text-xs mt-0.5 block truncate">
                      {pocoAtivo.numeroOutorga ||
                        formatarDataBR(pocoAtivo.dataPerfuracao || '')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#6B7A8D] block">
                      Coordenadas UTM & Aquífero
                    </span>
                    <span className="font-mono">
                      {pocoAtivo.coordenadasUTM || 'UTM N/I'}
                    </span>{' '}
                    · <span>{pocoAtivo.aquiferoLitologia || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#6B7A8D] block">
                      Equipamento Atual Registrado
                    </span>
                    <span>
                      {pocoAtivo.bombaAtual || 'Bomba N/I'} ·{' '}
                      {pocoAtivo.painelAtual || 'Painel N/I'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Evolução Hidrodinâmica (Variações de NE, ND, Rebaixamento e Vazão por O.S.) */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#E8A020] shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#1B2A3B] dark:text-slate-100">
                      Evolução Hidrodinâmica do Poço (Variações de NE, ND e Vazão)
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#6B7A8D] font-mono">
                    {relatoriosDoPocoAtivo.length} medição(ões) registrada(s)
                  </span>
                </div>

                {relatoriosDoPocoAtivo.length === 0 ? (
                  <p className="text-xs text-[#6B7A8D] py-4">
                    Ainda não há relatórios emitidos para este poço. Clique em &ldquo;Nova O.S. para este Poço&rdquo; para registrar a primeira medição.
                  </p>
                ) : (
                  <div className="space-y-5">
                    <PocoHydroChart
                      poco={pocoAtivo}
                      relatoriosDoPoco={relatoriosDoPocoAtivo}
                    />
                    <div className="overflow-x-auto rounded-lg border border-[#DDE3EC] dark:border-slate-800">
                      <table className="w-full min-w-[600px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#1B2A3B] text-white text-[11px]">
                          <th className="py-2 px-3 text-left">Data</th>
                          <th className="py-2 px-3 text-left">Nº O.S.</th>
                          <th className="py-2 px-3 text-right">
                            Nível Estático (NE)
                          </th>
                          <th className="py-2 px-3 text-right">
                            Nível Dinâmico (ND)
                          </th>
                          <th className="py-2 px-3 text-right">
                            Rebaixamento (Δh)
                          </th>
                          <th className="py-2 px-3 text-right">
                            Vazão (Q)
                          </th>
                          <th className="py-2 px-3 text-left">
                            Motobomba / Crivo na Visita
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                        {relatoriosDoPocoAtivo.map((rel, i) => {
                          const neNum = extrairNumero(
                            rel.dadosPoco?.nivelEstatico
                          );
                          const ndNum = extrairNumero(
                            rel.dadosPoco?.nivelDinamico
                          );
                          const rebaixamento =
                            neNum !== null && ndNum !== null && ndNum >= neNum
                              ? `${(ndNum - neNum)
                                  .toFixed(1)
                                  .replace('.', ',')}m`
                              : '—';

                          return (
                            <tr
                              key={rel.uuid}
                              className={
                                i === 0
                                  ? 'bg-amber-50/50 dark:bg-amber-950/20 font-medium'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }
                            >
                              <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                                {formatarDataBR(rel.cabecalho.dataExecucao)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                                {rel.cabecalho.contratoOS}
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                                {rel.dadosPoco?.nivelEstatico || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                                {rel.dadosPoco?.nivelDinamico || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#6B7A8D]">
                                {rebaixamento}
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-right text-[#27AE60]">
                                {rel.dadosPoco?.vazaoTeste || '—'}
                              </td>
                              <td className="py-2.5 px-3 truncate max-w-[210px]">
                                {rel.dadosPoco?.especificacaoBomba || '—'}{' '}
                                {rel.dadosPoco?.crivo
                                  ? `(${rel.dadosPoco.crivo})`
                                  : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Todos os Relatórios Técnicos (O.S.) deste Poço */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#E8A020]" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#1B2A3B] dark:text-slate-100">
                      Histórico de Relatórios Emitidos para o Poço {pocoAtivo.tag}
                    </h3>
                  </div>
                </div>

                {relatoriosDoPocoAtivo.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#DDE3EC] dark:border-slate-800 rounded-xl space-y-2">
                    <p className="text-xs text-[#6B7A8D]">
                      Nenhuma Ordem de Serviço registrada para o poço {pocoAtivo.tag}.
                    </p>
                    <button
                      type="button"
                      onClick={() => onIniciarNovaOSNoPoco(pocoAtivo)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B]"
                    >
                      ＋ Criar Primeiro Relatório para {pocoAtivo.tag}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {relatoriosDoPocoAtivo.map((rel) => (
                      <div
                        key={rel.uuid}
                        className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 p-4 flex flex-wrap items-center justify-between gap-4 hover:border-[#E8A020] transition-colors"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-sm text-[#1B2A3B] dark:text-slate-100">
                              {rel.cabecalho.contratoOS}
                            </span>
                            <span>·</span>
                            <span className="font-semibold text-[#E8A020]">
                              {rel.cabecalho.tipoServico || 'Serviço Técnico'}
                            </span>
                            <span>·</span>
                            <span className="font-mono text-[#6B7A8D]">
                              Execução: {formatarDataBR(rel.cabecalho.dataExecucao)}
                            </span>
                            <span>·</span>
                            <span className="font-medium text-[#6B7A8D]">
                              {rel.cabecalho.statusOS || 'Concluído'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {rel.descricaoServico ||
                              'Sem memorial descritivo informado.'}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#6B7A8D] pt-1">
                            <span>
                              NE: <strong>{rel.dadosPoco?.nivelEstatico || '—'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              ND: <strong>{rel.dadosPoco?.nivelDinamico || '—'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Vazão: <strong>{rel.dadosPoco?.vazaoTeste || '—'}</strong>
                            </span>
                            <span>·</span>
                            <span>{rel.fotos.length} foto(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onAbrirRelatorio(rel, false)}
                            className="px-3 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Abrir O.S.
                          </button>
                          <button
                            type="button"
                            onClick={() => onAbrirRelatorio(rel, true)}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020]"
                          >
                            Ver A4
                          </button>
                          <button
                            type="button"
                            onClick={() => onExportarPDFRelatorio(rel)}
                            className="p-2 rounded-lg bg-[#1B2A3B] text-white hover:bg-[#243447]"
                            title="Baixar PDF deste relatório"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

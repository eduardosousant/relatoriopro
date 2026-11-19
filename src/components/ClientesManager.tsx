import React, { useState, useRef, useEffect } from 'react';
import {
  CadastroCliente,
  CadastroPoco,
  RelatorioTecnico,
} from '../types/relatorio';
import {
  normalizarTextoCliente,
  obterPocosDoCliente,
} from '../utils/clienteMatch';
import {
  Users,
  Plus,
  Search,
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Droplets,
  Edit3,
  Trash2,
  Check,
  X,
  FolderOpen,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';

interface ClientesManagerProps {
  clientes: CadastroCliente[];
  pocos: CadastroPoco[];
  relatorios: RelatorioTecnico[];
  onSalvarCliente: (cliente: CadastroCliente) => Promise<void>;
  onExcluirCliente: (uuid: string) => Promise<void>;
  onSalvarPoco: (poco: CadastroPoco) => Promise<void>;
  onIniciarNovaOSNoPoco: (poco: CadastroPoco) => void;
  onAbrirProntuarioPoco: (poco: CadastroPoco) => void;
  onAbrirLancamentoRapido?: (clienteUuid?: string, pocoUuid?: string) => void;
}

export const ClientesManager: React.FC<ClientesManagerProps> = ({
  clientes,
  pocos,
  relatorios,
  onSalvarCliente,
  onExcluirCliente,
  onSalvarPoco,
  onIniciarNovaOSNoPoco,
  onAbrirProntuarioPoco,
  onAbrirLancamentoRapido,
}) => {
  const [buscaCliente, setBuscaCliente] = useState<string>('');
  const [buscaPocoDoCliente, setBuscaPocoDoCliente] = useState<string>('');
  const [clienteSelecionadoUuid, setClienteSelecionadoUuid] = useState<string>(
    clientes[0]?.uuid || ''
  );
  const [modoFormularioCliente, setModoFormularioCliente] = useState<
    'fechado' | 'novo' | 'editar'
  >('fechado');
  const [confirmarExclusaoUuid, setConfirmarExclusaoUuid] = useState<
    string | null
  >(null);
  const [novoPocoAberto, setNovoPocoAberto] = useState<boolean>(false);
  const detalhesRef = useRef<HTMLDivElement | null>(null);

  const criarFormularioClienteVazio = (): CadastroCliente => ({
    uuid: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    razaoSocial: '',
    nomeFantasia: '',
    cnpjCpf: '',
    enderecoSede: '',
    cidadeUF: '',
    contatoPrincipal: '',
    telefone: '',
    email: '',
    observacoes: '',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  });

  const [formCliente, setFormCliente] = useState<CadastroCliente>(
    criarFormularioClienteVazio
  );
  const [erroFormCliente, setErroFormCliente] = useState<string | null>(null);

  const [formNovoPoco, setFormNovoPoco] = useState({
    tag: '',
    nomeIdentificacao: '',
    enderecoLocal: '',
    cidadeUF: '',
    profundidadeTotal: '',
    diametroRevestimento: '6 polegadas',
    numeroOutorga: '',
    bombaAtual: '',
    coordenadasUTM: '',
  });
  const [erroFormPoco, setErroFormPoco] = useState<string | null>(null);

  const termoCliente = normalizarTextoCliente(buscaCliente);
  const clientesFiltrados = clientes.filter((c) => {
    if (!termoCliente) return true;
    return (
      normalizarTextoCliente(c.razaoSocial).includes(termoCliente) ||
      normalizarTextoCliente(c.nomeFantasia).includes(termoCliente) ||
      normalizarTextoCliente(c.cnpjCpf).includes(termoCliente) ||
      normalizarTextoCliente(c.cidadeUF).includes(termoCliente) ||
      normalizarTextoCliente(c.enderecoSede).includes(termoCliente) ||
      normalizarTextoCliente(c.contatoPrincipal).includes(termoCliente)
    );
  });

  // Mantém seleção válida conforme busca ou alterações na lista
  useEffect(() => {
    if (
      clientesFiltrados.length > 0 &&
      !clientesFiltrados.some((c) => c.uuid === clienteSelecionadoUuid)
    ) {
      setClienteSelecionadoUuid(clientesFiltrados[0].uuid);
    } else if (clientesFiltrados.length === 0 && clientes.length > 0 && !termoCliente) {
      setClienteSelecionadoUuid(clientes[0].uuid);
    }
  }, [clientesFiltrados, clienteSelecionadoUuid, clientes, termoCliente]);

  const clienteAtivo =
    clientesFiltrados.find((c) => c.uuid === clienteSelecionadoUuid) ||
    clientesFiltrados[0] ||
    null;

  // SOMENTE os poços cadastrados exclusivamente para o cliente pesquisado/selecionado
  const pocosExclusivosDoCliente = obterPocosDoCliente(pocos, clienteAtivo);

  const termoPoco = normalizarTextoCliente(buscaPocoDoCliente);
  const pocosDoClienteFiltrados = pocosExclusivosDoCliente.filter((p) => {
    if (!termoPoco) return true;
    return (
      normalizarTextoCliente(p.tag).includes(termoPoco) ||
      normalizarTextoCliente(p.nomeIdentificacao).includes(termoPoco) ||
      normalizarTextoCliente(p.enderecoLocal).includes(termoPoco) ||
      normalizarTextoCliente(p.numeroOutorga).includes(termoPoco)
    );
  });

  const contarRelatoriosDoPoco = (poco: CadastroPoco): number => {
    return relatorios.filter((rel) => {
      if (rel.pocoUuid && rel.pocoUuid === poco.uuid) return true;
      const mesmaTag =
        normalizarTextoCliente(rel.dadosPoco?.pocoId) ===
        normalizarTextoCliente(poco.tag);
      const mesmoCliente =
        normalizarTextoCliente(rel.cabecalho.cliente) ===
        normalizarTextoCliente(poco.cliente);
      return mesmaTag && (mesmoCliente || !rel.pocoUuid);
    }).length;
  };

  const abrirNovoCliente = () => {
    setFormCliente(criarFormularioClienteVazio());
    setErroFormCliente(null);
    setModoFormularioCliente('novo');
  };

  const abrirEdicaoCliente = (cliente: CadastroCliente) => {
    setFormCliente({ ...cliente });
    setErroFormCliente(null);
    setModoFormularioCliente('editar');
  };

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCliente.razaoSocial.trim()) {
      setErroFormCliente('Informe o Nome ou Razão Social do cliente.');
      return;
    }

    const clienteLimpo: CadastroCliente = {
      ...formCliente,
      razaoSocial: formCliente.razaoSocial.trim(),
      nomeFantasia: formCliente.nomeFantasia?.trim() || '',
      cnpjCpf: formCliente.cnpjCpf.trim(),
      enderecoSede: formCliente.enderecoSede.trim(),
      cidadeUF: formCliente.cidadeUF.trim(),
      contatoPrincipal: formCliente.contatoPrincipal.trim(),
      telefone: formCliente.telefone.trim(),
      email: formCliente.email?.trim() || '',
      observacoes: formCliente.observacoes?.trim() || '',
      atualizadoEm: Date.now(),
    };

    await onSalvarCliente(clienteLimpo);
    setClienteSelecionadoUuid(clienteLimpo.uuid);
    setModoFormularioCliente('fechado');
  };

  const abrirCadastroPocoParaCliente = () => {
    if (!clienteAtivo) return;
    setFormNovoPoco({
      tag: `PT0${pocosExclusivosDoCliente.length + 1}`,
      nomeIdentificacao: '',
      enderecoLocal: clienteAtivo.enderecoSede || '',
      cidadeUF: clienteAtivo.cidadeUF || '',
      profundidadeTotal: '',
      diametroRevestimento: '6 polegadas',
      numeroOutorga: '',
      bombaAtual: '',
      coordenadasUTM: '',
    });
    setErroFormPoco(null);
    setNovoPocoAberto(true);
  };

  const handleSubmitNovoPocoParaCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAtivo) return;
    if (!formNovoPoco.tag.trim()) {
      setErroFormPoco('Informe a TAG do poço (ex: PT01).');
      return;
    }
    if (!formNovoPoco.enderecoLocal.trim()) {
      setErroFormPoco('Informe o endereço/localização deste poço.');
      return;
    }

    const agora = Date.now();
    const novoPoco: CadastroPoco = {
      uuid: `poco-${agora}-${Math.random().toString(36).slice(2, 7)}`,
      clienteUuid: clienteAtivo.uuid,
      tag: formNovoPoco.tag.trim().toUpperCase(),
      nomeIdentificacao:
        formNovoPoco.nomeIdentificacao.trim() ||
        `Poço ${formNovoPoco.tag.trim().toUpperCase()} — ${clienteAtivo.razaoSocial}`,
      cliente: clienteAtivo.razaoSocial,
      clienteCNPJ: clienteAtivo.cnpjCpf || '',
      enderecoLocal: formNovoPoco.enderecoLocal.trim(),
      cidadeUF: formNovoPoco.cidadeUF.trim() || clienteAtivo.cidadeUF || '',
      coordenadasUTM: formNovoPoco.coordenadasUTM.trim(),
      contatoLocal: clienteAtivo.contatoPrincipal || '',
      telefoneContato: clienteAtivo.telefone || '',
      profundidadeTotal: formNovoPoco.profundidadeTotal.trim(),
      diametroRevestimento: formNovoPoco.diametroRevestimento.trim(),
      dataPerfuracao: '',
      numeroOutorga: formNovoPoco.numeroOutorga.trim(),
      aquiferoLitologia: '',
      crivoPadrao: '',
      tuboEdutorPadrao: 'Geomecânico',
      eletrodoSuperiorPadrao: '',
      eletrodoInferiorPadrao: '',
      bombaAtual: formNovoPoco.bombaAtual.trim(),
      painelAtual: '',
      observacoesTecnicas: '',
      criadoEm: agora,
      atualizadoEm: agora,
    };

    await onSalvarPoco(novoPoco);
    setNovoPocoAberto(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Etapa de Clientes */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E8A020]" />
            <span>Cadastro de Clientes & Poços por Cliente</span>
          </h1>
          <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-0.5">
            Cadastre seus clientes e pesquise pelo nome, CNPJ/CPF ou cidade para visualizar exclusivamente os poços pertencentes a cada cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onAbrirLancamentoRapido && (
            <button
              type="button"
              onClick={() => onAbrirLancamentoRapido(clienteAtivo?.uuid)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#1B2A3B] hover:bg-slate-800 text-[#E8A020] shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Abrir Central de Lançamento Rápido de Histórico (PDF em Lote + Planilha Excel/CSV)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>⚡ Lançamento Rápido / Importar Excel (2024–2026)</span>
            </button>
          )}

          <button
            type="button"
            onClick={abrirNovoCliente}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Cliente
          </button>
        </div>
      </div>

      {/* Formulário de Criação / Edição de Cliente */}
      {modoFormularioCliente !== 'fechado' && (
        <form
          onSubmit={handleSubmitCliente}
          className="rounded-xl border-2 border-[#E8A020] bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-lg space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100">
                {modoFormularioCliente === 'novo'
                  ? 'Novo Cadastro de Cliente'
                  : `Editando Cliente: ${formCliente.razaoSocial}`}
              </h2>
              <p className="text-xs text-[#6B7A8D]">
                Os dados do cliente ficam vinculados automaticamente aos poços cadastrados e às Ordens de Serviço.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoFormularioCliente('fechado')}
              className="p-1.5 rounded-lg text-[#6B7A8D] hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {erroFormCliente && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {erroFormCliente}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Razão Social / Nome Completo *
              </label>
              <input
                type="text"
                value={formCliente.razaoSocial}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, razaoSocial: e.target.value })
                }
                placeholder="Ex: Agroindustrial Vale do Rio Pardo S/A"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Nome Fantasia / Propriedade
              </label>
              <input
                type="text"
                value={formCliente.nomeFantasia || ''}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, nomeFantasia: e.target.value })
                }
                placeholder="Ex: Fazenda Santa Helena"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                CNPJ / CPF
              </label>
              <input
                type="text"
                value={formCliente.cnpjCpf}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, cnpjCpf: e.target.value })
                }
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Endereço Sede / Fazenda
              </label>
              <input
                type="text"
                value={formCliente.enderecoSede}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, enderecoSede: e.target.value })
                }
                placeholder="Rodovia, Km, Gleba ou Avenida / Bairro"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Cidade / UF
              </label>
              <input
                type="text"
                value={formCliente.cidadeUF}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, cidadeUF: e.target.value })
                }
                placeholder="Ex: Sorriso / MT"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Contato Principal / Fiscal
              </label>
              <input
                type="text"
                value={formCliente.contatoPrincipal}
                onChange={(e) =>
                  setFormCliente({
                    ...formCliente,
                    contatoPrincipal: e.target.value,
                  })
                }
                placeholder="Nome do responsável"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={formCliente.telefone}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, telefone: e.target.value })
                }
                placeholder="(65) 99999-0000"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={formCliente.email || ''}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, email: e.target.value })
                }
                placeholder="contato@empresa.com.br"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                Observações / Contrato
              </label>
              <input
                type="text"
                value={formCliente.observacoes || ''}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, observacoes: e.target.value })
                }
                placeholder="Notas comerciais ou contratuais"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#DDE3EC] dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModoFormularioCliente('fechado')}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar Cliente
            </button>
          </div>
        </form>
      )}

      {/* Grid Principal: Lista + Pesquisa de Clientes (Esquerda) | Detalhes + Somente Poços do Cliente (Direita) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Coluna Esquerda: Pesquisa e Seleção do Cliente */}
        <div className="xl:col-span-4 2xl:col-span-3 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden xl:sticky xl:top-[76px]">
          <div className="p-4 border-b border-[#DDE3EC] dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#6B7A8D]">
              <span>Clientes Cadastrados ({clientes.length})</span>
              {termoCliente && (
                <span className="text-[10px] font-mono text-[#E8A020]">
                  {clientesFiltrados.length} encontrado(s)
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7A8D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Pesquisar cliente, CNPJ/CPF, cidade..."
                className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
              />
              {buscaCliente && (
                <button
                  type="button"
                  onClick={() => setBuscaCliente('')}
                  title="Limpar pesquisa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7A8D] hover:text-[#1B2A3B] dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-[#DDE3EC] dark:divide-slate-800 max-h-[280px] xl:max-h-[calc(100vh-230px)] overflow-y-auto">
            {clientesFiltrados.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs text-[#6B7A8D]">
                  Nenhum cliente encontrado para "{buscaCliente}".
                </p>
                <button
                  type="button"
                  onClick={abrirNovoCliente}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#E8A020]/15 text-[#B47810] dark:text-[#E8A020] hover:bg-[#E8A020] hover:text-[#1B2A3B] transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Cadastrar este cliente
                </button>
              </div>
            ) : (
              clientesFiltrados.map((c) => {
                const selecionado = clienteAtivo?.uuid === c.uuid;
                const qtdPocos = obterPocosDoCliente(pocos, c).length;
                return (
                  <div
                    key={c.uuid}
                    onClick={() => {
                      setClienteSelecionadoUuid(c.uuid);
                      setBuscaPocoDoCliente('');
                      setNovoPocoAberto(false);
                      if (window.innerWidth < 1280 && detalhesRef.current) {
                        setTimeout(() => {
                          detalhesRef.current?.scrollIntoView({
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
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-xs font-bold leading-snug ${
                          selecionado
                            ? 'text-white'
                            : 'text-[#1B2A3B] dark:text-slate-100'
                        }`}
                      >
                        {c.razaoSocial}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          selecionado
                            ? 'bg-[#E8A020] text-[#1B2A3B]'
                            : 'bg-[#F0F3F7] dark:bg-slate-800 text-[#1B2A3B] dark:text-slate-200'
                        }`}
                      >
                        {qtdPocos} {qtdPocos === 1 ? 'poço' : 'poços'}
                      </span>
                    </div>

                    {c.nomeFantasia && (
                      <p
                        className={`text-[11px] mt-0.5 truncate ${
                          selecionado ? 'text-[#E8A020]' : 'text-[#6B7A8D]'
                        }`}
                      >
                        {c.nomeFantasia}
                      </p>
                    )}

                    <div
                      className={`mt-1.5 flex items-center justify-between gap-2 text-[10.5px] font-mono ${
                        selecionado ? 'text-white/75' : 'text-[#6B7A8D]'
                      }`}
                    >
                      <span className="truncate">{c.cnpjCpf || 'CNPJ/CPF n/i'}</span>
                      <span className="truncate shrink-0">{c.cidadeUF || '—'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna Direita: Ficha do Cliente Selecionado + Lista EXCLUSIVA de Poços desse Cliente */}
        <div
          ref={detalhesRef}
          className="xl:col-span-8 2xl:col-span-9 space-y-5 scroll-mt-20"
        >
          {!clienteAtivo ? (
            <div className="rounded-xl border border-dashed border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
              <Users className="w-10 h-10 text-[#6B7A8D] mx-auto mb-3 opacity-50" />
              <p className="text-sm font-semibold text-[#1B2A3B] dark:text-slate-200">
                Selecione ou pesquise um cliente ao lado
              </p>
              <p className="text-xs text-[#6B7A8D] mt-1">
                Ao selecionar um cliente, todos os poços cadastrados exclusivamente para ele serão exibidos aqui.
              </p>
            </div>
          ) : (
            <>
              {/* Ficha do Cliente Selecionado */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#1B2A3B] text-[#E8A020] text-[10px] font-mono font-bold uppercase tracking-wider">
                      <UserCheck className="w-3 h-3" />
                      <span>Cliente Selecionado</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-[#1B2A3B] dark:text-slate-100 pt-1">
                      {clienteAtivo.razaoSocial}
                    </h2>
                    {clienteAtivo.nomeFantasia && (
                      <p className="text-xs font-semibold text-[#6B7A8D]">
                        {clienteAtivo.nomeFantasia}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onAbrirLancamentoRapido && (
                      <button
                        type="button"
                        onClick={() => onAbrirLancamentoRapido(clienteAtivo.uuid)}
                        className="px-3 py-2 text-xs font-bold rounded-lg bg-[#E8A020]/15 border border-[#E8A020]/40 text-[#B47810] dark:text-[#E8A020] hover:bg-[#E8A020] hover:text-[#1B2A3B] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Lançar Histórico de O.S. deste Cliente</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => abrirEdicaoCliente(clienteAtivo)}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar Cliente
                    </button>

                    {confirmarExclusaoUuid === clienteAtivo.uuid ? (
                      <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-2.5 py-1.5 rounded-lg">
                        <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
                          Confirmar exclusão?
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await onExcluirCliente(clienteAtivo.uuid);
                            setConfirmarExclusaoUuid(null);
                          }}
                          className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarExclusaoUuid(null)}
                          className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[11px] font-semibold"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmarExclusaoUuid(clienteAtivo.uuid)}
                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={abrirCadastroPocoParaCliente}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Cadastrar Novo Poço neste Cliente
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#DDE3EC] dark:border-slate-800 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC]/70 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-[#6B7A8D] flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#E8A020]" />
                      CNPJ / CPF
                    </div>
                    <div className="font-mono font-semibold text-[#1B2A3B] dark:text-slate-100 mt-1 truncate">
                      {clienteAtivo.cnpjCpf || 'Não informado'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC]/70 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-[#6B7A8D] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#E8A020]" />
                      Cidade / Localização
                    </div>
                    <div className="font-semibold text-[#1B2A3B] dark:text-slate-100 mt-1 truncate">
                      {clienteAtivo.cidadeUF || '—'}
                    </div>
                    {clienteAtivo.enderecoSede && (
                      <div className="text-[11px] text-[#6B7A8D] truncate">
                        {clienteAtivo.enderecoSede}
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC]/70 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-[#6B7A8D] flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#E8A020]" />
                      Contato & Telefone
                    </div>
                    <div className="font-semibold text-[#1B2A3B] dark:text-slate-100 mt-1 truncate">
                      {clienteAtivo.contatoPrincipal || 'Não informado'}
                    </div>
                    <div className="text-[11px] font-mono text-[#6B7A8D] truncate">
                      {clienteAtivo.telefone || '—'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC]/70 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-[#6B7A8D] flex items-center gap-1">
                      <Mail className="w-3 h-3 text-[#E8A020]" />
                      E-mail / Obs.
                    </div>
                    <div className="font-semibold text-[#1B2A3B] dark:text-slate-100 mt-1 truncate">
                      {clienteAtivo.email || '—'}
                    </div>
                    {clienteAtivo.observacoes && (
                      <div className="text-[11px] text-[#6B7A8D] truncate">
                        {clienteAtivo.observacoes}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Formulário Rápido para Cadastrar Poço Diretamente no Cliente Selecionado */}
              {novoPocoAberto && (
                <form
                  onSubmit={handleSubmitNovoPocoParaCliente}
                  className="rounded-xl border-2 border-[#E8A020] bg-[#FFFDF7] dark:bg-slate-900 p-5 space-y-4 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-slate-800 pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                        Novo Poço Vinculado a: {clienteAtivo.razaoSocial}
                      </h3>
                      <p className="text-[11px] text-[#6B7A8D]">
                        Este poço aparecerá exclusivamente na carteira deste cliente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNovoPocoAberto(false)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {erroFormPoco && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                      {erroFormPoco}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        TAG do Poço *
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.tag}
                        onChange={(e) =>
                          setFormNovoPoco({ ...formNovoPoco, tag: e.target.value })
                        }
                        placeholder="Ex: PT01"
                        className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Nome / Setor do Poço
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.nomeIdentificacao}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            nomeIdentificacao: e.target.value,
                          })
                        }
                        placeholder="Ex: Poço Sede / Pivô 03"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Endereço / Localização do Poço *
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.enderecoLocal}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            enderecoLocal: e.target.value,
                          })
                        }
                        placeholder="Gleba, talhão ou endereço completo"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Cidade / UF
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.cidadeUF}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            cidadeUF: e.target.value,
                          })
                        }
                        placeholder="Cidade / UF"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Profundidade Total
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.profundidadeTotal}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            profundidadeTotal: e.target.value,
                          })
                        }
                        placeholder="Ex: 160,00 m"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Diâmetro / Revestimento
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.diametroRevestimento}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            diametroRevestimento: e.target.value,
                          })
                        }
                        placeholder='Ex: 6" Aço Carbono'
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Nº Outorga
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.numeroOutorga}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            numeroOutorga: e.target.value,
                          })
                        }
                        placeholder="Portaria / Processo"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Motobomba Instalada
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.bombaAtual}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            bombaAtual: e.target.value,
                          })
                        }
                        placeholder="Ex: Ebara 4BHS-15 7,5 CV 380V"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] mb-1">
                        Coordenadas (Lat/Lon ou UTM)
                      </label>
                      <input
                        type="text"
                        value={formNovoPoco.coordenadasUTM}
                        onChange={(e) =>
                          setFormNovoPoco({
                            ...formNovoPoco,
                            coordenadasUTM: e.target.value,
                          })
                        }
                        placeholder="LAT -21.17 LON -47.82"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setNovoPocoAberto(false)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar Poço neste Cliente
                    </button>
                  </div>
                </form>
              )}

              {/* Lista EXCLUSIVA de Poços Cadastrados para o Cliente Selecionado */}
              <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#DDE3EC] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-[#E8A020]" />
                      <span>
                        Poços Cadastrados Exclusivamente para{' '}
                        {clienteAtivo.razaoSocial} (
                        {pocosExclusivosDoCliente.length})
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#6B7A8D] mt-0.5">
                      Exibindo somente os poços vinculados a este cliente.
                    </p>
                  </div>

                  {pocosExclusivosDoCliente.length > 1 && (
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-[#6B7A8D] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={buscaPocoDoCliente}
                        onChange={(e) => setBuscaPocoDoCliente(e.target.value)}
                        placeholder="Filtrar poços deste cliente..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:outline-none focus:border-[#E8A020]"
                      />
                    </div>
                  )}
                </div>

                {pocosDoClienteFiltrados.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <Droplets className="w-9 h-9 text-[#6B7A8D] mx-auto opacity-40" />
                    <p className="text-xs font-semibold text-[#1B2A3B] dark:text-slate-200">
                      {pocosExclusivosDoCliente.length === 0
                        ? `Nenhum poço cadastrado ainda para ${clienteAtivo.razaoSocial}.`
                        : 'Nenhum poço deste cliente corresponde ao filtro.'}
                    </p>
                    {pocosExclusivosDoCliente.length === 0 && (
                      <button
                        type="button"
                        onClick={abrirCadastroPocoParaCliente}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Cadastrar Primeiro Poço deste Cliente
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                    {pocosDoClienteFiltrados.map((poco) => {
                      const qtdRel = contarRelatoriosDoPoco(poco);
                      return (
                        <div
                          key={poco.uuid}
                          className="p-4 sm:p-5 hover:bg-[#F7F9FC] dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded bg-[#1B2A3B] text-[#E8A020] text-xs font-mono font-bold">
                                {poco.tag}
                              </span>
                              <span className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                                {poco.nomeIdentificacao || `Poço ${poco.tag}`}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10.5px] font-mono text-[#6B7A8D] dark:text-slate-300">
                                {qtdRel} {qtdRel === 1 ? 'relatório' : 'relatórios'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7A8D]">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                                {poco.enderecoLocal || 'Local não informado'}
                                {poco.cidadeUF ? ` · ${poco.cidadeUF}` : ''}
                              </span>
                              {poco.profundidadeTotal && (
                                <span className="font-mono">
                                  Prof.: {poco.profundidadeTotal}
                                </span>
                              )}
                              {poco.diametroRevestimento && (
                                <span>Ø: {poco.diametroRevestimento}</span>
                              )}
                              {poco.numeroOutorga && (
                                <span className="font-mono">
                                  Outorga: {poco.numeroOutorga}
                                </span>
                              )}
                            </div>

                            {poco.bombaAtual && (
                              <div className="text-[11.5px] text-[#1B2A3B]/80 dark:text-slate-300">
                                <span className="font-semibold">Bomba:</span>{' '}
                                {poco.bombaAtual}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onAbrirProntuarioPoco(poco)}
                              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-[#E8A020]" />
                              Abrir Prontuário
                            </button>
                            <button
                              type="button"
                              onClick={() => onIniciarNovaOSNoPoco(poco)}
                              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Nova O.S.
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

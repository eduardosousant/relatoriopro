import React, { useState, useRef } from 'react';
import { TemplateServico } from '../types/relatorio';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  FileText,
  Copy,
  FolderCog,
  Search,
  BookmarkCheck,
  Download,
  Upload,
  Cloud,
  HelpCircle,
} from 'lucide-react';
import {
  exportarTemplatesJson,
  importarTemplatesJson,
} from '../services/indexedDbService';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TemplateServico[];
  textoAtualRelatorio?: string;
  onSalvarTemplate: (dados: {
    id?: string;
    titulo: string;
    categoria: string;
    conteudo: string;
  }) => void;
  onExcluirTemplate: (id: string) => void;
  onAplicarTemplate: (template: TemplateServico) => void;
  onRecarregarTemplates?: () => void;
  showToast: (mensagem: string, tipo?: 'success' | 'error') => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  templates,
  textoAtualRelatorio = '',
  onSalvarTemplate,
  onExcluirTemplate,
  onAplicarTemplate,
  onRecarregarTemplates,
  showToast,
}) => {
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);
  const [templateEditandoId, setTemplateEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('Preventiva');
  const [conteudo, setConteudo] = useState<string>('');
  const [busca, setBusca] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [mostrarAjudaNuvem, setMostrarAjudaNuvem] = useState<boolean>(false);
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const categoriasDisponiveis = [
    'todas',
    ...Array.from(new Set(templates.map((t) => t.categoria || 'Geral'))),
  ];

  const templatesFiltrados = templates.filter((t) => {
    const matchBusca =
      t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      t.conteudo.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria =
      filtroCategoria === 'todas' || t.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  const iniciarCriacao = (conteudoInicial = '') => {
    setTemplateEditandoId(null);
    setTitulo('');
    setCategoria('Preventiva');
    setConteudo(conteudoInicial);
    setModoEdicao(true);
  };

  const iniciarEdicao = (tpl: TemplateServico) => {
    setTemplateEditandoId(tpl.id);
    setTitulo(tpl.titulo);
    setCategoria(tpl.categoria);
    setConteudo(tpl.conteudo);
    setModoEdicao(true);
  };

  const cancelarEdicao = () => {
    setModoEdicao(false);
    setTemplateEditandoId(null);
    setTitulo('');
    setConteudo('');
  };

  const salvarTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      showToast('Por favor, informe o título do template.', 'error');
      return;
    }
    if (!conteudo.trim()) {
      showToast('O conteúdo do memorial descritivo não pode estar vazio.', 'error');
      return;
    }

    onSalvarTemplate({
      id: templateEditandoId || undefined,
      titulo: titulo.trim(),
      categoria: categoria.trim() || 'Personalizado',
      conteudo: conteudo.trim(),
    });

    showToast(
      templateEditandoId
        ? 'Template atualizado com sucesso!'
        : 'Novo template criado com sucesso!',
      'success'
    );
    cancelarEdicao();
  };

  const confirmarExclusao = (tpl: TemplateServico) => {
    if (confirm(`Deseja realmente excluir o template personalizado "${tpl.titulo}"?`)) {
      onExcluirTemplate(tpl.id);
      showToast('Template excluído com sucesso!');
    }
  };

  const puxarTextoAtual = () => {
    if (!textoAtualRelatorio.trim()) {
      showToast('O campo de memorial descritivo no relatório está vazio.', 'error');
      return;
    }
    setConteudo(textoAtualRelatorio.trim());
    showToast('Texto do relatório atual carregado no formulário!', 'success');
  };

  const handleExportarJson = () => {
    const jsonStr = exportarTemplatesJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates_memorial_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo de templates exportado com sucesso!', 'success');
  };

  const handleImportarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const conteudoStr = String(event.target?.result || '');
      const res = importarTemplatesJson(conteudoStr);
      if (res.sucesso) {
        showToast(`${res.qtd} template(s) importado(s) com sucesso!`, 'success');
        onRecarregarTemplates?.();
      } else {
        showToast('Formato de arquivo JSON inválido para templates.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const sqlSupabase = `-- Executar no SQL Editor do Supabase (para sincronizar entre todos os computadores):
create table if not exists public.templates_memorial (
  id text primary key,
  titulo text not null,
  categoria text not null,
  conteudo text not null,
  is_custom boolean default true,
  criado_em bigint not null
);

alter table public.templates_memorial enable row level security;
create policy "Acesso templates" on public.templates_memorial for all using (true);`;

  const copiarSqlSupabase = () => {
    navigator.clipboard.writeText(sqlSupabase);
    showToast('Comando SQL copiado para a área de transferência!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:hidden">
      <div className="bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-[#DDE3EC] dark:border-slate-800 flex items-center justify-between bg-[#F7F9FC] dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#E8A020]/15 text-[#E8A020]">
              <FolderCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                Gerenciar Templates de Memorial Descritivo
              </h3>
              <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                Crie modelos personalizados e reutilize descrições técnicas prontas para cada tipo de serviço.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Dinâmico: Modo Edição ou Modo Lista */}
        {modoEdicao ? (
          <form onSubmit={salvarTemplate} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E8A020] flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" />
                  {templateEditandoId ? 'Editar Template Personalizado' : 'Criar Novo Template de Serviço'}
                </span>
                {textoAtualRelatorio && !templateEditandoId && (
                  <button
                    type="button"
                    onClick={puxarTextoAtual}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#E8A020] bg-[#E8A020]/10 text-[#1B2A3B] dark:text-[#E8A020] hover:bg-[#E8A020]/20 transition-colors flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Usar texto atual do relatório</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                    Título do Template <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Manutenção Preventiva com Desinfecção e Análise de Água"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Preventiva, Limpeza, etc."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Conteúdo do Memorial Descritivo <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Você pode usar numeração (1., 2., 3...) e tópicos
                  </span>
                </div>
                <textarea
                  rows={10}
                  required
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Escreva as etapas, metodologia de execução, normas técnicas atendidas e especificações..."
                  className="w-full p-3.5 text-xs font-mono leading-relaxed rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none resize-y"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#DDE3EC] dark:border-slate-800 flex items-center justify-between bg-[#F7F9FC] dark:bg-slate-950">
              <button
                type="button"
                onClick={cancelarEdicao}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Voltar à Lista
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Salvar Template</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Barra de Ações e Filtro */}
            <div className="p-4 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Pesquisar por título ou conteúdo..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                  />
                </div>
                {categoriasDisponiveis.length > 2 && (
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
                  >
                    {categoriasDisponiveis.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'todas' ? 'Todas categorias' : cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                {textoAtualRelatorio.trim() && (
                  <button
                    type="button"
                    onClick={() => iniciarCriacao(textoAtualRelatorio.trim())}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E8A020] bg-[#E8A020]/10 text-[#1B2A3B] dark:text-[#E8A020] hover:bg-[#E8A020]/20 transition-colors flex items-center gap-1.5 shrink-0"
                    title="Cria um novo template com o texto digitado atualmente no relatório"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salvar Texto Atual</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => iniciarCriacao()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#25394e] text-white transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E8A020]" />
                  <span>Novo Template</span>
                </button>
              </div>
            </div>

            {/* Lista de Templates */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {templatesFiltrados.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Nenhum template encontrado com os filtros atuais.</p>
                </div>
              ) : (
                templatesFiltrados.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`rounded-xl border p-4 transition-all ${
                      tpl.isCustom
                        ? 'border-[#E8A020]/40 bg-[#FFFDF7] dark:bg-slate-900 shadow-xs'
                        : 'border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                            {tpl.titulo}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {tpl.categoria}
                          </span>
                          {tpl.isCustom ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8A020]/20 text-[#B87000] dark:text-[#E8A020]">
                              Personalizado
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                              Padrão
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onAplicarTemplate(tpl);
                            onClose();
                          }}
                          className="px-3 py-1 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] transition-colors flex items-center gap-1 shadow-2xs"
                          title="Insere este template no relatório técnico atual"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aplicar</span>
                        </button>

                        {tpl.isCustom && (
                          <>
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(tpl)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Editar este template"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmarExclusao(tpl)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Excluir este template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-[11.5px] text-slate-600 dark:text-slate-400 font-mono bg-slate-50/80 dark:bg-slate-950/50 p-2.5 rounded-lg line-clamp-3 leading-relaxed border border-slate-100 dark:border-slate-800">
                      {tpl.conteudo}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 sm:p-4 border-t border-[#DDE3EC] dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#F7F9FC] dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  ref={inputArquivoRef}
                  onChange={handleImportarArquivo}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleExportarJson}
                  className="px-2.5 py-1.5 rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium"
                  title="Baixar arquivo de backup com todos os templates personalizados para usar em outro computador"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Exportar (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => inputArquivoRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium"
                  title="Carregar arquivo .json de templates exportados de outro PC"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Importar (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarAjudaNuvem(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 hover:bg-sky-100 transition-colors flex items-center gap-1.5 font-medium"
                  title="Como acessar seus templates em qualquer PC via Supabase"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Acessar de Outros PCs (Nuvem)</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Instruções para Acessar de Outro PC / Supabase */}
        {mostrarAjudaNuvem && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                      Como acessar seus templates em outro computador?
                    </h4>
                    <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
                      Você pode usar 2 métodos simples:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarAjudaNuvem(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-[#1B2A3B] dark:text-slate-200 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    Opção 1: Sem mexer no banco (Exportar / Importar)
                  </span>
                  <p>
                    Clique em <strong>Exportar (.json)</strong> neste computador para salvar o arquivo de backup e, no outro computador, abra o sistema e clique em <strong>Importar (.json)</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-sky-600" />
                      Opção 2: Sincronização Automática na Nuvem (Supabase)
                    </span>
                    <button
                      type="button"
                      onClick={copiarSqlSupabase}
                      className="px-2 py-1 text-[11px] font-bold rounded-md bg-sky-600 hover:bg-sky-700 text-white transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar SQL</span>
                    </button>
                  </div>
                  <p>
                    Para que qualquer template criado em um computador apareça <strong>automaticamente</strong> em todos os outros, execute o comando abaixo no <strong>SQL Editor</strong> do seu painel Supabase uma única vez:
                  </p>
                  <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-200 text-[10.5px] font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
                    {sqlSupabase}
                  </pre>
                  <p className="text-[11px] text-sky-700 dark:text-sky-300">
                    Assim que criada a tabela, o sistema salvará e atualizará seus templates na nuvem automaticamente!
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarAjudaNuvem(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#25394e] text-white transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  RelatorioTecnico,
  CadastroPoco,
  CadastroCliente,
  TemplateServico,
} from '../types/relatorio';
import {
  normalizarTextoCliente,
  limparDigitosDocumento,
} from '../utils/clienteMatch';
import {
  TEMPLATES_SERVICO,
  gerarUuidV4,
  limparBancoLocalLegado,
  parsearTemplatesJson,
} from './relatorioDefaults';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGACY_STORAGE_KEY_TEMPLATES = 'hidrogeo_custom_templates_v1';

/**
 * Garante que qualquer identificador seja convertido de forma determinística
 * em um UUID v4 válido aceito pelo tipo PostgreSQL UUID do Supabase.
 */
export function normalizarParaUUID(input: string | undefined | null): string {
  if (!input) return '00000000-0000-4000-8000-000000000000';
  const limpo = String(input).trim().toLowerCase();
  if (UUID_REGEX.test(limpo)) {
    return limpo;
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex =
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (Math.imul(h1, 31) >>> 0).toString(16).padStart(8, '0') +
    (Math.imul(h2, 37) >>> 0).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(
    13,
    16
  )}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ==============================================================================
// MAPEAMENTO POÇOS TUBULARES (SUPABASE)
// ==============================================================================

function pocoParaSupabase(poco: CadastroPoco) {
  return {
    uuid: normalizarParaUUID(poco.uuid),
    tag: poco.tag,
    nome_identificacao: poco.nomeIdentificacao,
    cliente: poco.cliente,
    cliente_cnpj: poco.clienteCNPJ,
    endereco_local: poco.enderecoLocal,
    cidade_uf: poco.cidadeUF,
    coordenadas_utm: poco.coordenadasUTM,
    contato_local: poco.contatoLocal,
    telefone_contato: poco.telefoneContato,
    profundidade_total: poco.profundidadeTotal,
    diametro_revestimento: poco.diametroRevestimento,
    data_perfuracao: poco.dataPerfuracao,
    numero_outorga: poco.numeroOutorga,
    aquifero_litologia: poco.aquiferoLitologia,
    crivo_padrao: poco.crivoPadrao,
    tubo_edutor_padrao: poco.tuboEdutorPadrao,
    eletrodo_superior_padrao: poco.eletrodoSuperiorPadrao,
    eletrodo_inferior_padrao: poco.eletrodoInferiorPadrao,
    bomba_atual: poco.bombaAtual,
    painel_atual: poco.painelAtual,
    observacoes_tecnicas: poco.observacoesTecnicas,
    criado_em: poco.criadoEm || Date.now(),
    atualizado_em: Date.now(),
  };
}

function supabaseParaPoco(row: any): CadastroPoco {
  return {
    uuid: row.uuid,
    tag: row.tag || '',
    nomeIdentificacao: row.nome_identificacao || '',
    cliente: row.cliente || '',
    clienteCNPJ: row.cliente_cnpj || '',
    enderecoLocal: row.endereco_local || '',
    cidadeUF: row.cidade_uf || '',
    coordenadasUTM: row.coordenadas_utm || '',
    contatoLocal: row.contato_local || '',
    telefoneContato: row.telefone_contato || '',
    profundidadeTotal: row.profundidade_total || '',
    diametroRevestimento: row.diametro_revestimento || '',
    dataPerfuracao: row.data_perfuracao || '',
    numeroOutorga: row.numero_outorga || '',
    aquiferoLitologia: row.aquifero_litologia || '',
    crivoPadrao: row.crivo_padrao || '',
    tuboEdutorPadrao: row.tubo_edutor_padrao || '',
    eletrodoSuperiorPadrao: row.eletrodo_superior_padrao || '',
    eletrodoInferiorPadrao: row.eletrodo_inferior_padrao || '',
    bombaAtual: row.bomba_atual || '',
    painelAtual: row.painel_atual || '',
    observacoesTecnicas: row.observacoes_tecnicas || '',
    criadoEm: Number(row.criado_em || Date.now()),
    atualizadoEm: Number(row.atualizado_em || Date.now()),
  };
}

// ==============================================================================
// MAPEAMENTO RELATÓRIOS TÉCNICOS (SUPABASE)
// ==============================================================================

function relatorioParaSupabase(relatorio: RelatorioTecnico) {
  const cabecalhoComMetadados = {
    ...relatorio.cabecalho,
    uuidOriginal: relatorio.uuid,
    clienteUuid: relatorio.clienteUuid || undefined,
    secoesVisiveis: relatorio.secoesVisiveis,
  };

  const dadosPocoLimpo = {
    ...relatorio.dadosPoco,
    profundidadeBomba: '',
  };

  return {
    uuid: normalizarParaUUID(relatorio.uuid),
    poco_uuid: relatorio.pocoUuid ? normalizarParaUUID(relatorio.pocoUuid) : null,
    contrato_os: relatorio.cabecalho.contratoOS || '',
    cliente: relatorio.cabecalho.cliente || '',
    status: relatorio.status || 'rascunho',
    data_execucao: relatorio.cabecalho.dataExecucao || '',
    cabecalho: cabecalhoComMetadados,
    dados_poco: dadosPocoLimpo,
    descricao_servico: relatorio.descricaoServico || '',
    equipe: relatorio.equipe || [],
    servicos_conduzidos: relatorio.servicosConduzidos || [],
    materiais_aplicados: relatorio.materiaisAplicados || [],
    checklist: relatorio.checklist || [],
    ocorrencias_campo: relatorio.ocorrenciasCampo || {},
    fotos: relatorio.fotos || [],
    assinatura_responsavel: relatorio.assinaturaResponsavel || null,
    assinatura_cliente: relatorio.assinaturaCliente || null,
    criado_em: relatorio.criadoEm || Date.now(),
    atualizado_em: Date.now(),
  };
}

function supabaseParaRelatorio(row: any): RelatorioTecnico {
  const cabecalho = row.cabecalho || {};
  const secoesVisiveis =
    cabecalho.secoesVisiveis || (row as any).secoes_visiveis || undefined;
  const dadosPoco = {
    ...(row.dados_poco || {}),
    profundidadeBomba: '',
  };

  return {
    uuid: cabecalho.uuidOriginal || row.uuid,
    clienteUuid: cabecalho.clienteUuid || undefined,
    pocoUuid: row.poco_uuid || undefined,
    status: row.status || 'rascunho',
    cabecalho,
    dadosPoco,
    descricaoServico: row.descricao_servico || '',
    equipe: row.equipe || [],
    servicosConduzidos: row.servicos_conduzidos || [],
    materiaisAplicados: row.materiais_aplicados || [],
    checklist: row.checklist || [],
    ocorrenciasCampo: row.ocorrencias_campo || {},
    fotos: row.fotos || [],
    secoesVisiveis,
    assinaturaResponsavel: row.assinatura_responsavel || undefined,
    assinaturaCliente: row.assinatura_cliente || undefined,
    criadoEm: Number(row.criado_em || Date.now()),
    atualizadoEm: Number(row.atualizado_em || Date.now()),
  };
}

// ==============================================================================
// SERVIÇOS DE POÇOS TUBULARES (SUPABASE)
// ==============================================================================

export interface RespostaSincronizacaoSupabase {
  sucesso: boolean;
  erro?: string;
}

export async function salvarPocoSupabase(poco: CadastroPoco): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const payload = pocoParaSupabase(poco);
    const { error } = await supabase
      .from('pocos')
      .upsert(payload, { onConflict: 'uuid' });
    if (error) {
      console.warn('Erro ao salvar poço no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Falha na comunicação com Supabase (poço):', err);
    return false;
  }
}

export async function listarPocosSupabase(): Promise<CadastroPoco[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('pocos')
      .select('*')
      .order('tag', { ascending: true });
    if (error || !data) return [];
    return data.map(supabaseParaPoco);
  } catch (err) {
    console.warn('Falha ao listar poços do Supabase:', err);
    return [];
  }
}

export async function excluirPocoSupabase(uuid: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const uuidNormalizado = normalizarParaUUID(uuid);
    const { error } = await supabase
      .from('pocos')
      .delete()
      .eq('uuid', uuidNormalizado);
    if (error) {
      console.warn('Erro ao excluir poço no Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================
// SERVIÇOS DE RELATÓRIOS TÉCNICOS (SUPABASE)
// ==============================================================================

export async function salvarRelatorioSupabase(
  relatorio: RelatorioTecnico
): Promise<RespostaSincronizacaoSupabase> {
  if (!supabase || !isSupabaseConfigured) {
    return { sucesso: false, erro: 'Supabase não está configurado.' };
  }
  try {
    const payload = relatorioParaSupabase(relatorio);
    const { error } = await supabase
      .from('relatorios')
      .upsert(payload, { onConflict: 'uuid' });

    if (error) {
      console.warn('Erro ao salvar relatório no Supabase:', error.message);
      return { sucesso: false, erro: error.message };
    }
    return { sucesso: true };
  } catch (err: any) {
    console.warn('Falha na comunicação com Supabase (relatório):', err);
    return {
      sucesso: false,
      erro: err?.message || 'Falha de conexão com a nuvem',
    };
  }
}

export async function listarRelatoriosSupabase(): Promise<RelatorioTecnico[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('relatorios')
      .select('*')
      .order('atualizado_em', { ascending: false });
    if (error || !data) return [];
    return data.map(supabaseParaRelatorio);
  } catch (err) {
    console.warn('Falha ao listar relatórios do Supabase:', err);
    return [];
  }
}

export async function obterRelatorioSupabase(
  uuid: string
): Promise<RelatorioTecnico | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  try {
    const uuidNormalizado = normalizarParaUUID(uuid);
    const { data, error } = await supabase
      .from('relatorios')
      .select('*')
      .eq('uuid', uuidNormalizado)
      .single();
    if (error || !data) return null;
    return supabaseParaRelatorio(data);
  } catch {
    return null;
  }
}

export async function excluirRelatorioSupabase(uuid: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const uuidNormalizado = normalizarParaUUID(uuid);
    const { error } = await supabase
      .from('relatorios')
      .delete()
      .eq('uuid', uuidNormalizado);
    if (error) {
      console.warn('Erro ao excluir relatório no Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================
// STORAGE: UPLOAD DE FOTOS E LOGOS PARA O BUCKET 'evidencias-campo'
// ==============================================================================

function dataUrlParaBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function uploadEvidenciaSupabase(
  pasta: string,
  nomeArquivo: string,
  dataUrlOuBlob: string | Blob
): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  try {
    const blob =
      typeof dataUrlOuBlob === 'string'
        ? dataUrlParaBlob(dataUrlOuBlob)
        : dataUrlOuBlob;

    const caminho = `${pasta}/${Date.now()}_${nomeArquivo.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )}`;
    const { data, error } = await supabase.storage
      .from('evidencias-campo')
      .upload(caminho, blob, {
        upsert: true,
        contentType: blob.type || 'image/jpeg',
      });

    if (error || !data) {
      console.warn(
        'Erro ao fazer upload para o bucket Supabase:',
        error?.message
      );
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('evidencias-campo')
      .getPublicUrl(caminho);

    return publicUrlData.publicUrl || null;
  } catch (err) {
    console.warn('Exceção ao fazer upload para Supabase Storage:', err);
    return null;
  }
}

// ==============================================================================
// TEMPLATES DE MEMORIAL DESCRITIVO (EXCLUSIVAMENTE SUPABASE + PADRÕES DO SISTEMA)
// ==============================================================================

export async function salvarTemplateSupabase(
  template: TemplateServico
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const payload = {
      id: template.id,
      titulo: template.titulo,
      categoria: template.categoria,
      conteudo: template.conteudo,
      is_custom: template.isCustom ?? true,
      criado_em: template.criadoEm || Date.now(),
    };
    const { error } = await supabase
      .from('templates_memorial')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn(
        'Erro ao salvar template no Supabase (templates_memorial):',
        error.message
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Falha ao sincronizar template com Supabase:', err);
    return false;
  }
}

export async function listarTemplatesSupabase(): Promise<TemplateServico[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('templates_memorial')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      titulo: row.titulo,
      categoria: row.categoria,
      conteudo: row.conteudo,
      isCustom: Boolean(row.is_custom),
      criadoEm: Number(row.criado_em || Date.now()),
    }));
  } catch {
    return [];
  }
}

export async function excluirTemplateSupabase(id: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('templates_memorial')
      .delete()
      .eq('id', id);
    if (error) {
      console.warn('Erro ao excluir template no Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Carrega todos os templates personalizados diretamente do Supabase (migrando eventual
 * cache legado do navegador para a nuvem uma única vez) e combina com os 5 templates padrão.
 */
export async function carregarTodosTemplatesSupabase(): Promise<
  TemplateServico[]
> {
  let daNuvem = await listarTemplatesSupabase();

  // Migração transparente única: se houver templates antigos no localStorage, sobe para o Supabase e limpa o cache local
  if (typeof window !== 'undefined') {
    try {
      const rawLegado = window.localStorage.getItem(LEGACY_STORAGE_KEY_TEMPLATES);
      if (rawLegado) {
        const parsed = JSON.parse(rawLegado);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const idsNuvem = new Set(daNuvem.map((t) => t.id));
          let todosMigrados = true;
          for (const item of parsed) {
            if (item?.id && item?.titulo && item?.conteudo && !idsNuvem.has(item.id)) {
              const ok = await salvarTemplateSupabase({
                id: String(item.id),
                titulo: String(item.titulo),
                categoria: String(item.categoria || 'Personalizado'),
                conteudo: String(item.conteudo),
                isCustom: true,
                criadoEm: Number(item.criadoEm || Date.now()),
              });
              if (!ok) todosMigrados = false;
            }
          }
          if (todosMigrados) {
            window.localStorage.removeItem(LEGACY_STORAGE_KEY_TEMPLATES);
          }
          daNuvem = await listarTemplatesSupabase();
        } else {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY_TEMPLATES);
        }
      }
    } catch {
      // Ignora erro de leitura do cache legado
    }
  }

  return [...daNuvem, ...TEMPLATES_SERVICO];
}

export async function importarTemplatesJsonParaSupabase(
  jsonStr: string
): Promise<{ sucesso: boolean; qtd: number }> {
  const lista = parsearTemplatesJson(jsonStr);
  if (lista.length === 0) {
    return { sucesso: false, qtd: 0 };
  }
  let salvos = 0;
  for (const tpl of lista) {
    const ok = await salvarTemplateSupabase(tpl);
    if (ok) salvos++;
  }
  return { sucesso: salvos > 0, qtd: salvos };
}

// ==============================================================================
// SERVIÇOS DE CLIENTES (SUPABASE)
// ==============================================================================

function clienteParaSupabase(cliente: CadastroCliente) {
  return {
    uuid: normalizarParaUUID(cliente.uuid),
    uuid_original: cliente.uuid,
    razao_social: cliente.razaoSocial,
    nome_fantasia: cliente.nomeFantasia || '',
    cnpj_cpf: cliente.cnpjCpf || '',
    endereco_sede: cliente.enderecoSede || '',
    cidade_uf: cliente.cidadeUF || '',
    contato_principal: cliente.contatoPrincipal || '',
    telefone: cliente.telefone || '',
    email: cliente.email || '',
    observacoes: cliente.observacoes || '',
    criado_em: cliente.criadoEm || Date.now(),
    atualizado_em: Date.now(),
  };
}

function supabaseParaCliente(row: any): CadastroCliente {
  return {
    uuid: row.uuid_original || row.uuid,
    razaoSocial: row.razao_social || '',
    nomeFantasia: row.nome_fantasia || '',
    cnpjCpf: row.cnpj_cpf || '',
    enderecoSede: row.endereco_sede || '',
    cidadeUF: row.cidade_uf || '',
    contatoPrincipal: row.contato_principal || '',
    telefone: row.telefone || '',
    email: row.email || '',
    observacoes: row.observacoes || '',
    criadoEm: Number(row.criado_em || Date.now()),
    atualizadoEm: Number(row.atualizado_em || Date.now()),
  };
}

export async function salvarClienteSupabase(
  cliente: CadastroCliente
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const payload = clienteParaSupabase(cliente);
    const { error } = await supabase
      .from('clientes')
      .upsert(payload, { onConflict: 'uuid' });
    if (error) {
      console.warn('Erro ao salvar cliente no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Falha ao sincronizar cliente com Supabase:', err);
    return false;
  }
}

export async function listarClientesSupabase(): Promise<CadastroCliente[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('razao_social', { ascending: true });
    if (error || !data) return [];
    return data.map(supabaseParaCliente);
  } catch {
    return [];
  }
}

export async function excluirClienteSupabase(uuid: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const uuidNormalizado = normalizarParaUUID(uuid);
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('uuid', uuidNormalizado);
    if (error) {
      console.warn('Erro ao excluir cliente no Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Vincula em memória os poços carregados do Supabase aos respectivos clientes cadastrados
 * (e cria automaticamente no Supabase o cliente caso exista um poço com nome de cliente ainda não cadastrado).
 * Nunca cria registros de demonstração quando o banco está vazio.
 */
export async function sincronizarClientesComPocosSupabase(
  pocos: CadastroPoco[],
  clientesAtuais: CadastroCliente[]
): Promise<{
  clientes: CadastroCliente[];
  pocosAtualizados: CadastroPoco[];
}> {
  const clientes = [...clientesAtuais];
  const pocosAtualizados: CadastroPoco[] = [];

  for (const poco of pocos) {
    const nomeCli = (poco.cliente || '').trim();
    if (!nomeCli) {
      pocosAtualizados.push(poco);
      continue;
    }

    const normNome = normalizarTextoCliente(nomeCli);
    const docPoco = limparDigitosDocumento(poco.clienteCNPJ || '');

    let clienteEncontrado = clientes.find((c) => {
      if (poco.clienteUuid && c.uuid === poco.clienteUuid) return true;
      if (docPoco && limparDigitosDocumento(c.cnpjCpf || '') === docPoco) {
        return true;
      }
      return normalizarTextoCliente(c.razaoSocial) === normNome;
    });

    if (!clienteEncontrado) {
      const agora = Date.now();
      const novoCliente: CadastroCliente = {
        uuid: gerarUuidV4(),
        razaoSocial: nomeCli,
        nomeFantasia: '',
        cnpjCpf: poco.clienteCNPJ || '',
        enderecoSede: poco.enderecoLocal || '',
        cidadeUF: poco.cidadeUF || '',
        contatoPrincipal: poco.contatoLocal || '',
        telefone: poco.telefoneContato || '',
        email: '',
        observacoes: '',
        criadoEm: agora,
        atualizadoEm: agora,
      };
      await salvarClienteSupabase(novoCliente);
      clientes.push(novoCliente);
      clienteEncontrado = novoCliente;
    }

    pocosAtualizados.push({
      ...poco,
      clienteUuid: clienteEncontrado.uuid,
    });
  }

  clientes.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
  return { clientes, pocosAtualizados };
}

// ==============================================================================
// DIAGNÓSTICO DE TABELAS E SCRIPT SQL COMPLETO DO SUPABASE
// ==============================================================================

export const SQL_COMPLETO_TABELAS_SUPABASE = `-- ============================================================================
-- RelatorPRO · Script SQL Completo e Idempotente para o Supabase (SQL Editor)
-- Seguro para rodar mesmo com tabelas já existentes (NÃO apaga seus dados/templates).
-- ============================================================================

-- 1. Tabela de Clientes
create table if not exists public.clientes (
  uuid uuid primary key,
  uuid_original text,
  razao_social text not null,
  nome_fantasia text default '',
  cnpj_cpf text default '',
  endereco_sede text default '',
  cidade_uf text default '',
  contato_principal text default '',
  telefone text default '',
  email text default '',
  observacoes text default '',
  criado_em bigint not null,
  atualizado_em bigint not null
);

-- 2. Tabela de Poços Tubulares
create table if not exists public.pocos (
  uuid uuid primary key,
  tag text not null,
  nome_identificacao text default '',
  cliente text default '',
  cliente_cnpj text default '',
  endereco_local text default '',
  cidade_uf text default '',
  coordenadas_utm text default '',
  contato_local text default '',
  telefone_contato text default '',
  profundidade_total text default '',
  diametro_revestimento text default '',
  data_perfuracao text default '',
  numero_outorga text default '',
  aquifero_litologia text default '',
  crivo_padrao text default '',
  tubo_edutor_padrao text default '',
  eletrodo_superior_padrao text default '',
  eletrodo_inferior_padrao text default '',
  bomba_atual text default '',
  painel_atual text default '',
  observacoes_tecnicas text default '',
  criado_em bigint not null,
  atualizado_em bigint not null
);

-- 3. Tabela de Relatórios Técnicos / Ordens de Serviço
create table if not exists public.relatorios (
  uuid uuid primary key,
  poco_uuid uuid references public.pocos(uuid) on delete set null,
  contrato_os text default '',
  cliente text default '',
  status text default 'rascunho',
  data_execucao text default '',
  cabecalho jsonb default '{}'::jsonb,
  dados_poco jsonb default '{}'::jsonb,
  descricao_servico text default '',
  equipe jsonb default '[]'::jsonb,
  servicos_conduzidos jsonb default '[]'::jsonb,
  materiais_aplicados jsonb default '[]'::jsonb,
  checklist jsonb default '[]'::jsonb,
  ocorrencias_campo jsonb default '{}'::jsonb,
  fotos jsonb default '[]'::jsonb,
  assinatura_responsavel jsonb,
  assinatura_cliente jsonb,
  criado_em bigint not null,
  atualizado_em bigint not null
);

-- 4. Tabela de Templates de Memorial Descritivo (Preservada no Reset)
create table if not exists public.templates_memorial (
  id text primary key,
  titulo text not null,
  categoria text not null,
  conteudo text not null,
  is_custom boolean default true,
  criado_em bigint not null
);

-- Habilita RLS e libera operações CRUD via chave anon/publishable do aplicativo
alter table public.clientes enable row level security;
alter table public.pocos enable row level security;
alter table public.relatorios enable row level security;
alter table public.templates_memorial enable row level security;

drop policy if exists "Acesso total clientes" on public.clientes;
create policy "Acesso total clientes" on public.clientes
  for all using (true) with check (true);

drop policy if exists "Acesso total pocos" on public.pocos;
create policy "Acesso total pocos" on public.pocos
  for all using (true) with check (true);

drop policy if exists "Acesso total relatorios" on public.relatorios;
create policy "Acesso total relatorios" on public.relatorios
  for all using (true) with check (true);

drop policy if exists "Acesso templates" on public.templates_memorial;
drop policy if exists "Acesso total templates_memorial" on public.templates_memorial;
create policy "Acesso total templates_memorial" on public.templates_memorial
  for all using (true) with check (true);

-- 5. Migração segura: converte colunas varchar(N) legadas (ex.: varchar(100)) para TEXT sem perda de dados
do $$
declare
  col record;
begin
  for col in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('pocos', 'clientes', 'relatorios', 'templates_memorial')
      and data_type = 'character varying'
  loop
    execute format(
      'alter table public.%I alter column %I type text',
      col.table_name,
      col.column_name
    );
  end loop;
end $$;

-- Atualiza imediatamente o schema cache do PostgREST no Supabase
notify pgrst, 'reload schema';`;

export type NomeTabelaSupabase =
  | 'relatorios'
  | 'pocos'
  | 'clientes'
  | 'templates_memorial';

export interface StatusTabelaSupabase {
  tabela: NomeTabelaSupabase;
  label: string;
  preservadaNoReset: boolean;
  existe: boolean;
  contagem: number | null;
  erro?: string;
}

function ehErroTabelaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

export async function verificarTabelasSupabase(): Promise<StatusTabelaSupabase[]> {
  const definicoes: {
    tabela: NomeTabelaSupabase;
    label: string;
    colunaPk: string;
    preservadaNoReset: boolean;
  }[] = [
    { tabela: 'relatorios', label: 'Relatórios', colunaPk: 'uuid', preservadaNoReset: false },
    { tabela: 'pocos', label: 'Poços', colunaPk: 'uuid', preservadaNoReset: false },
    { tabela: 'clientes', label: 'Clientes', colunaPk: 'uuid', preservadaNoReset: false },
    {
      tabela: 'templates_memorial',
      label: 'Templates',
      colunaPk: 'id',
      preservadaNoReset: true,
    },
  ];

  if (!supabase || !isSupabaseConfigured) {
    return definicoes.map((d) => ({
      tabela: d.tabela,
      label: d.label,
      preservadaNoReset: d.preservadaNoReset,
      existe: false,
      contagem: null,
      erro: 'Supabase não configurado.',
    }));
  }

  return Promise.all(
    definicoes.map(async (def) => {
      try {
        const { count, error } = await supabase!
          .from(def.tabela)
          .select(def.colunaPk, { head: true, count: 'exact' });

        if (error) {
          if (ehErroTabelaAusente(error)) {
            return {
              tabela: def.tabela,
              label: def.label,
              preservadaNoReset: def.preservadaNoReset,
              existe: false,
              contagem: null,
              erro: 'Tabela ainda não criada no Supabase',
            };
          }
          return {
            tabela: def.tabela,
            label: def.label,
            preservadaNoReset: def.preservadaNoReset,
            existe: true,
            contagem: null,
            erro: error.message,
          };
        }

        return {
          tabela: def.tabela,
          label: def.label,
          preservadaNoReset: def.preservadaNoReset,
          existe: true,
          contagem: typeof count === 'number' ? count : 0,
        };
      } catch (err: any) {
        return {
          tabela: def.tabela,
          label: def.label,
          preservadaNoReset: def.preservadaNoReset,
          existe: false,
          contagem: null,
          erro: err?.message || 'Erro de conexão',
        };
      }
    })
  );
}

// ==============================================================================
// RESET TOTAL DOS DADOS OPERACIONAIS NO SUPABASE (PRESERVA TEMPLATES!)
// ==============================================================================

export interface ResultadoResetSupabase {
  sucesso: boolean;
  relatoriosRemovidos: number;
  pocosRemovidos: number;
  clientesRemovidos: number;
  tabelasAusentes: string[];
  erros: string[];
}

async function limparTabelaPorUuid(
  tabela: 'relatorios' | 'pocos' | 'clientes'
): Promise<{ removidos: number; ausente?: boolean; erro?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { removidos: 0, erro: 'Supabase não está configurado.' };
  }

  const { data, error: erroSelect } = await supabase
    .from(tabela)
    .select('uuid');

  if (erroSelect) {
    if (ehErroTabelaAusente(erroSelect)) {
      return { removidos: 0, ausente: true };
    }
    return {
      removidos: 0,
      erro: `Falha ao listar tabela "${tabela}": ${erroSelect.message}`,
    };
  }

  const uuids = (data || [])
    .map((r: any) => r.uuid)
    .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);

  if (uuids.length === 0) {
    return { removidos: 0 };
  }

  let removidos = 0;
  const tamanhoLote = 100;
  for (let i = 0; i < uuids.length; i += tamanhoLote) {
    const lote = uuids.slice(i, i + tamanhoLote);
    const { error: erroDelete } = await supabase
      .from(tabela)
      .delete()
      .in('uuid', lote);

    if (erroDelete) {
      return {
        removidos,
        erro: `Falha ao apagar registros em "${tabela}": ${erroDelete.message}`,
      };
    }
    removidos += lote.length;
  }

  return { removidos };
}

/**
 * Zera TODOS os dados operacionais (relatorios → pocos → clientes) no Supabase
 * e apaga o banco IndexedDB legado do navegador, preservando integralmente
 * a tabela `templates_memorial` e os templates padrão do sistema.
 */
export async function zerarDadosOperacionaisSupabase(): Promise<ResultadoResetSupabase> {
  const erros: string[] = [];
  const tabelasAusentes: string[] = [];

  if (!supabase || !isSupabaseConfigured) {
    await limparBancoLocalLegado();
    return {
      sucesso: false,
      relatoriosRemovidos: 0,
      pocosRemovidos: 0,
      clientesRemovidos: 0,
      tabelasAusentes: [],
      erros: ['Conexão com o Supabase não está configurada.'],
    };
  }

  // Ordem segura de chave estrangeira: relatorios -> pocos -> clientes
  // A tabela templates_memorial NUNCA é tocada.
  const resRel = await limparTabelaPorUuid('relatorios');
  if (resRel.ausente) tabelasAusentes.push('relatorios');
  if (resRel.erro) erros.push(resRel.erro);

  const resPocos = await limparTabelaPorUuid('pocos');
  if (resPocos.ausente) tabelasAusentes.push('pocos');
  if (resPocos.erro) erros.push(resPocos.erro);

  const resClientes = await limparTabelaPorUuid('clientes');
  if (resClientes.ausente) tabelasAusentes.push('clientes');
  if (resClientes.erro) erros.push(resClientes.erro);

  // Remove banco IndexedDB legado do navegador
  await limparBancoLocalLegado();

  return {
    sucesso: erros.length === 0,
    relatoriosRemovidos: resRel.removidos,
    pocosRemovidos: resPocos.removidos,
    clientesRemovidos: resClientes.removidos,
    tabelasAusentes,
    erros,
  };
}

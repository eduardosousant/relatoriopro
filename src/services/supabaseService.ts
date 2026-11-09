import { supabase, isSupabaseConfigured } from './supabaseClient';
import { RelatorioTecnico, CadastroPoco, TemplateServico } from '../types/relatorio';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Garante que qualquer identificador (mesmo texto/slug legado como 'laudo-hidrogeo-os-2026-0842-corrigido')
 * seja convertido de forma determinística em um UUID v4 válido aceito pelo tipo PostgreSQL UUID do Supabase.
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

/**
 * Mapeia o objeto CadastroPoco da aplicação para as colunas do PostgreSQL/Supabase
 */
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
    criado_em: poco.criadoEm,
    atualizado_em: Date.now(),
  };
}

/**
 * Converte a linha do PostgreSQL/Supabase de volta para CadastroPoco
 */
function supabaseParaPoco(row: any): CadastroPoco {
  return {
    uuid: row.uuid,
    tag: row.tag,
    nomeIdentificacao: row.nome_identificacao,
    cliente: row.cliente,
    clienteCNPJ: row.cliente_cnpj || '',
    enderecoLocal: row.endereco_local || '',
    cidadeUF: row.cidade_uf || '',
    coordenadasUTM: row.coordenadas_utm || '',
    contatoLocal: row.contato_local || '',
    telefoneContato: row.telefone_contato || '',
    profundidadeTotal: row.profundidade_total || '',
    diametroRevestimento: row.diametro_revestimento || '',
    dataPerfuracao: row.data_perfuracao,
    numeroOutorga: row.numero_outorga,
    aquiferoLitologia: row.aquifero_litologia,
    crivoPadrao: row.crivo_padrao || '',
    tuboEdutorPadrao: row.tubo_edutor_padrao || '',
    eletrodoSuperiorPadrao: row.eletrodo_superior_padrao || '',
    eletrodoInferiorPadrao: row.eletrodo_inferior_padrao || '',
    bombaAtual: row.bomba_atual || '',
    painelAtual: row.painel_atual || '',
    observacoesTecnicas: row.observacoes_tecnicas,
    criadoEm: Number(row.criado_em),
    atualizadoEm: Number(row.atualizado_em),
  };
}

/**
 * Mapeia o objeto RelatorioTecnico da aplicação para a tabela relatorios do Supabase
 */
function relatorioParaSupabase(relatorio: RelatorioTecnico) {
  // Preserva o uuid original no cabecalho (ex: caso seja slug local) e adiciona metadados
  const cabecalhoComMetadados = {
    ...relatorio.cabecalho,
    uuidOriginal: relatorio.uuid,
    secoesVisiveis: relatorio.secoesVisiveis,
  };

  return {
    uuid: normalizarParaUUID(relatorio.uuid),
    poco_uuid: relatorio.pocoUuid ? normalizarParaUUID(relatorio.pocoUuid) : null,
    contrato_os: relatorio.cabecalho.contratoOS || '',
    cliente: relatorio.cabecalho.cliente || '',
    status: relatorio.status || 'rascunho',
    data_execucao: relatorio.cabecalho.dataExecucao || '',
    cabecalho: cabecalhoComMetadados,
    dados_poco: relatorio.dadosPoco,
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

/**
 * Converte a linha do PostgreSQL/Supabase de volta para RelatorioTecnico
 */
function supabaseParaRelatorio(row: any): RelatorioTecnico {
  const cabecalho = row.cabecalho || {};
  const secoesVisiveis =
    cabecalho.secoesVisiveis || (row as any).secoes_visiveis || undefined;

  return {
    uuid: cabecalho.uuidOriginal || row.uuid,
    pocoUuid: row.poco_uuid || undefined,
    status: row.status || 'rascunho',
    cabecalho,
    dadosPoco: row.dados_poco || {},
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
    criadoEm: Number(row.criado_em),
    atualizadoEm: Number(row.atualizado_em),
  };
}

// ==============================================================================
// SERVIÇOS DE POÇOS TUBULARES (SUPABASE)
// ==============================================================================

export async function salvarPocoSupabase(poco: CadastroPoco): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const payload = pocoParaSupabase(poco);
    const { error } = await supabase.from('pocos').upsert(payload, { onConflict: 'uuid' });
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
    const { error } = await supabase.from('pocos').delete().eq('uuid', uuidNormalizado);
    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// SERVIÇOS DE RELATÓRIOS TÉCNICOS (SUPABASE)
// ==============================================================================

export interface RespostaSincronizacaoSupabase {
  sucesso: boolean;
  erro?: string;
}

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
    return { sucesso: false, erro: err?.message || 'Falha de conexão com a nuvem' };
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

export async function obterRelatorioSupabase(uuid: string): Promise<RelatorioTecnico | null> {
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
    const { error } = await supabase.from('relatorios').delete().eq('uuid', uuidNormalizado);
    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// STORAGE: UPLOAD DE FOTOS E LOGOS PARA O BUCKET 'evidencias-campo'
// ==============================================================================

/**
 * Converte base64 DataURL para Blob para envio ao Supabase Storage
 */
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
    const blob = typeof dataUrlOuBlob === 'string'
      ? dataUrlParaBlob(dataUrlOuBlob)
      : dataUrlOuBlob;

    const caminho = `${pasta}/${Date.now()}_${nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supabase.storage
      .from('evidencias-campo')
      .upload(caminho, blob, {
        upsert: true,
        contentType: blob.type || 'image/jpeg',
      });

    if (error || !data) {
      console.warn('Erro ao fazer upload para o bucket Supabase:', error?.message);
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
// TEMPLATES DE MEMORIAL DESCRITIVO (SINCRONIZAÇÃO EM NUVEM SUPABASE)
// ==============================================================================

export async function salvarTemplateSupabase(template: TemplateServico): Promise<boolean> {
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
      console.debug('Tabela templates_memorial no Supabase não encontrada ou sem permissão:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.debug('Falha ao sincronizar template com Supabase:', err);
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
      criadoEm: Number(row.criado_em),
    }));
  } catch {
    return [];
  }
}

export async function excluirTemplateSupabase(id: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('templates_memorial').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}


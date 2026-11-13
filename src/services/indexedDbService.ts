import {
  RelatorioTecnico,
  FotoRegistro,
  TemplateServico,
  DadosCabecalho,
  ItemChecklistConformidade,
  CadastroPoco,
} from '../types/relatorio';
import {
  salvarPocoSupabase,
  excluirPocoSupabase,
  salvarRelatorioSupabase,
  excluirRelatorioSupabase,
  salvarTemplateSupabase,
  listarTemplatesSupabase,
  excluirTemplateSupabase,
} from './supabaseService';

const DB_NAME = 'RelatorPRO_DB';
const DB_VERSION = 4;
const STORE_RELATORIOS = 'relatorios';
const STORE_POCOS = 'pocos';
const STORE_CONFIG = 'config';

export const CHECKLIST_PADRAO_ITENS: {
  texto: string;
  observacao: string;
}[] = [
  {
    texto: 'Uso completo dos Equipamentos de Proteção Individual (EPIs)',
    observacao:
      'CONFORME — Verificado em 13/03/2026: Equipe técnica integralmente equipada (NR-06 / NR-18).',
  },
  {
    texto: 'Sinalização e isolamento do perímetro de trabalho',
    observacao:
      'CONFORME — Verificado em 13/03/2026: Perímetro da sonda e boca do poço isolados com tela e cones.',
  },
  {
    texto: 'Verificação de aterramento e isolamento do painel elétrico',
    observacao:
      'CONFORME — Verificado em 13/03/2026: Isolação ôhmica aferida via megôhmetro (> 500 MΩ) e aterramento validado.',
  },
  {
    texto: 'Vedação hermética e proteção sanitária da boca do poço',
    observacao:
      'CONFORME — Verificado em 13/03/2026: Cimentação sanitária (0 a 24,00 m) e laje 1,50x1,50x0,15 m concluídas (NBR 12244).',
  },
  {
    texto: 'Limpeza, recolhimento e destinação adequada de resíduos e insumos',
    observacao:
      'CONFORME — Verificado em 13/03/2026: Canteiro desmobilizado e limpo, sem passivos ambientais.',
  },
];

export function criarChecklistPadrao(
  marcarTodos = true
): ItemChecklistConformidade[] {
  return CHECKLIST_PADRAO_ITENS.map((item, idx) => ({
    id: `chk_${idx}`,
    texto: item.texto,
    concluido: marcarTodos,
    dataVerificacao: '13/03/2026',
    observacao: item.observacao,
  }));
}

export const TEMPLATES_SERVICO: TemplateServico[] = [
  {
    id: 'manutencao-preventiva-completa',
    titulo: 'Manutenção Preventiva: Limpeza Air-Lift, Teste e Análise de Água',
    categoria: 'Preventiva',
    conteudo: `1. TRANSPORTE E MOBILIZAÇÃO DE EQUIPAMENTOS
Mobilização de equipe técnica operacional e equipamentos especializados até o poço tubular profundo, incluindo caminhão guincho/munk, compressor de ar de alta pressão (mín. 750 CFM / 250 PSI), tubulação auxiliar de injeção, coluna edutora e instrumentos de calibração metrológica. Isolamento e sinalização da área de intervenção.

2. LIMPEZA E DESENVOLVIMENTO COM COMPRESSOR DE AR (AIR-LIFT)
Execução dos serviços de limpeza interna da coluna de revestimento e desobstrução mecânica das seções filtrantes/fraturas aquíferas pelo método de injeção contínua e intermitente de ar comprimido (Air-Lift). Foram efetuados ciclos de pistoneamento pneumático para arraste e remoção completa de finos, decantação de incrustações e decréscimo de turbidez, até que a água bombeada apresentasse aspecto 100% límpido, sem arraste de areia ou material particulado em suspensão (ABNT NBR 12212 / NBR 12244).

3. DESINFECÇÃO COM PRODUTO QUÍMICO
Tratamento químico e choque oxidante com aplicação de solução bactericida e desincrustante (hipoclorito de sódio em dosagem técnica controlada) introduzida ao longo de toda a coluna de água do poço, garantindo a desinfecção microbiológica, eliminação de biofilmes bacterianos, controle de ferrobactérias e higienização do aquífero com o tempo de contato técnico mínimo normativo antes do expurgo.

4. TESTE DE VAZÃO COM MEDIÇÃO DE NÍVEL DINÂMICO, ESTÁTICO E ENSAIO DE RECUPERAÇÃO
Execução de ensaio hidrodinâmico de bombeamento para avaliação da vazão sustentável e comportamento operacional:
- Aferição prévia do Nível Estático (NE) estabilizado;
- Bombeamento com acompanhamento da vazão contínua (Q em m³/h) através de hidrômetro/cavalete de medição calibrado;
- Monitoramento sistemático do rebaixamento da lâmina d'água até a estabilização do Nível Dinâmico (ND);
- Ensaio de recuperação residual imediatamente após o corte do bombeamento, cronometrando a curva de ascensão do nível (s') até o reequilíbrio das condições piezométricas do poço.

5. COLETA DE AMOSTRA PARA ANÁLISE FÍSICO-QUÍMICA E BACTERIOLÓGICA DA ÁGUA
Realizada coleta criteriosa e asséptica de amostra de água na saída do cavalete do poço, após o expurgo completo do residual de cloro e estabilização dos parâmetros organolépticos. Acondicionamento em caixas térmicas refrigeradas e envio a laboratório credenciado para ensaios físico-químicos e bacteriológicos (coliformes totais e Escherichia coli) de potabilidade, atendendo rigorosamente aos parâmetros da Portaria GM/MS nº 888/2021.`,
  },
  {
    id: 'entrega-poco-nbr12244',
    titulo: 'Entrega Técnica de Poço e Teste 24h (NBR 12212 / 12244)',
    categoria: 'Hidrogeologia',
    conteudo: `1. OBJETIVO DO SERVIÇO\nConclusão da perfuração do Poço Tubular Profundo PT01 (160,00 m), desenvolvimento pneumático por Air-Lift, execução de Teste de Bombeamento Contínuo de 24 horas a vazão constante conforme ABNT NBR 12212 e ABNT NBR 12244, seguido de instalação definitiva do conjunto motobomba submerso aos 84,00 m e comissionamento elétrico.\n\n2. PROCEDIMENTOS DE PERFURAÇÃO E CONSTRUÇÃO\n- Perfuração rotopneumática finalizada aos 160,00 m de profundidade, atravessando cobertura sedimentar Cenozoica (0,00 a 24,00 m) e pacote de basalto fraturado / arenito intertrápico do Sistema Aquífero Serra Geral / Guarani (24,00 a 160,00 m);\n- Revestimento em tubo de Aço Carbono Schedule 40 de 6" (152,4 mm);\n- Aplicação de cimentação sanitária contínua no espaço anelar superior (0,00 a 24,00 m) e execução de laje de proteção sanitária em concreto armado (1,50 x 1,50 x 0,15 m).\n\n3. DESENVOLVIMENTO AIR-LIFT E TESTE DE BOMBEAMENTO CONTÍNUO (24H)\n- Desenvolvimento completo por injeção de ar comprimido (Air-Lift) durante 6,0 horas contínuas até total ausência de partículas em suspensão e turbidez (areia = 0 ppm);\n- Teste de bombeamento contínuo de 24 horas a vazão constante (13/03/2026): Nível Estático inicial (NE) medido em 22,40 m e Nível Dinâmico estabilizado (ND) em 64,10 m para vazão constante recomendada de 10,29 m³/h (10,286 m³/h), resultando em rebaixamento estabilizado s = 41,70 m e Capacidade Específica Q/s = 0,2467 m³/h/m.\n\n4. INSTALAÇÃO E COMISSIONAMENTO ELETROMECÂNICO\n- Descida do conjunto motobomba submerso Ebara 4BHS-15 7,5 CV Trifásica 380V posicionado na profundidade única de 84,00 m (garantindo submergência operacional de 19,90 m abaixo do ND estabilizado de 64,10 m, superior ao mínimo normativo de 10,00 m, e posicionado estritamente acima do topo do crivo/seção filtrante), acompanhado de cabo PP submersível 3x6,0 mm² e comissionamento em 380V trifásico (corrente nominal balanceada de 11,4 A).`,
  },
  {
    id: 'manutencao-motobomba',
    titulo: 'Manutenção Conjunto-Motobomba',
    categoria: 'Eletromecânica',
    conteudo: `Mobilização de equipe técnica e caminhão guincho até o local do poço. Realizado bloqueio elétrico do painel de comando, desconexão do cabeamento submersível e sacamento da coluna edutora e conjunto motobomba para inspeção em superfície. Efetuada substituição do conjunto motobomba submerso, revisão das emendas vulcanizadas com aferição de isolação ôhmica (megôhmetro), descida controlada acima do topo do crivo e testes operacionais de vazão e corrente elétrica nas três fases.`,
  },
  {
    id: 'limpeza-poco',
    titulo: 'Limpeza Completa de Poço',
    categoria: 'Hidrogeologia',
    conteudo: `Retirada do equipamento de bombeamento existente e descida de tubulação auxiliar de ar comprimido. Aplicação de dispersante químico homologado (polifosfato) e desenvolvimento pneumático por sistema Air-Lift em etapas sucessivas ao longo de toda a seção filtrante até completa remoção de incrustações e clarificação total da água bombeada, seguido de desinfecção com hipoclorito.`,
  },
  {
    id: 'manutencao-preventiva',
    titulo: 'Manutenção Preventiva e Painel',
    categoria: 'Preventiva',
    conteudo: `Inspeção técnica preventiva contemplando aferição dos níveis estático (NE) e dinâmico (ND), medição de vazão no hidrômetro/tubo Pitot, reaperto de conexões bornes no quadro elétrico de comando, aferição de corrente nominal (Amperes) e tensão entre fases (Volts), teste de atuação do relé de nível e relé falta de fase, e verificação das condições sanitárias da laje de proteção.`,
  },
];

const STORAGE_KEY_TEMPLATES = 'hidrogeo_custom_templates_v1';

export function obterTemplatesCustomizados(): TemplateServico[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function obterTodosTemplates(): TemplateServico[] {
  const custom = obterTemplatesCustomizados();
  return [...custom, ...TEMPLATES_SERVICO];
}

/**
 * Sincroniza templates da nuvem (Supabase) com o armazenamento local
 */
export async function sincronizarTemplatesNuvem(): Promise<TemplateServico[]> {
  try {
    const daNuvem = await listarTemplatesSupabase();
    if (daNuvem && daNuvem.length > 0) {
      const locais = obterTemplatesCustomizados();
      const mapa = new Map<string, TemplateServico>();
      locais.forEach((t) => mapa.set(t.id, t));
      daNuvem.forEach((t) => mapa.set(t.id, t));
      const mesclados = Array.from(mapa.values());
      try {
        localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(mesclados));
      } catch (err) {
        console.warn('Erro ao atualizar cache local de templates:', err);
      }
      return [...mesclados, ...TEMPLATES_SERVICO];
    }
  } catch (err) {
    console.debug('Sincronização em nuvem de templates não disponível:', err);
  }
  return obterTodosTemplates();
}

export function salvarTemplateCustomizado(
  dados: { id?: string; titulo: string; categoria: string; conteudo: string }
): TemplateServico {
  const customizados = obterTemplatesCustomizados();
  const id = dados.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const template: TemplateServico = {
    id,
    titulo: dados.titulo.trim() || 'Template Sem Título',
    categoria: dados.categoria.trim() || 'Personalizado',
    conteudo: dados.conteudo.trim(),
    isCustom: true,
    criadoEm: Date.now(),
  };

  const index = customizados.findIndex((t) => t.id === id);
  if (index >= 0) {
    customizados[index] = template;
  } else {
    customizados.unshift(template);
  }

  try {
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(customizados));
  } catch (err) {
    console.error('Erro ao salvar template customizado:', err);
  }

  // Tenta sincronizar de forma transparente na nuvem (Supabase) se a tabela existir
  salvarTemplateSupabase(template).catch((err) =>
    console.debug('Sincronização do template na nuvem pendente:', err)
  );

  return template;
}

export function excluirTemplateCustomizado(id: string): void {
  const customizados = obterTemplatesCustomizados().filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(customizados));
  } catch (err) {
    console.error('Erro ao excluir template customizado:', err);
  }

  // Remove também da nuvem (Supabase) se existir
  excluirTemplateSupabase(id).catch((err) =>
    console.debug('Remoção do template na nuvem pendente:', err)
  );
}

/**
 * Exporta todos os templates personalizados para formato JSON
 */
export function exportarTemplatesJson(): string {
  const customizados = obterTemplatesCustomizados();
  return JSON.stringify(
    {
      formato: 'hidrogeo_templates_v1',
      exportadoEm: new Date().toISOString(),
      templates: customizados,
    },
    null,
    2
  );
}

/**
 * Importa templates de uma string JSON mesclando com os existentes
 */
export function importarTemplatesJson(jsonStr: string): { sucesso: boolean; qtd: number } {
  try {
    const dados = JSON.parse(jsonStr);
    const lista: any[] = Array.isArray(dados) ? dados : dados?.templates || [];
    if (!Array.isArray(lista) || lista.length === 0) {
      return { sucesso: false, qtd: 0 };
    }

    const customizados = obterTemplatesCustomizados();
    const mapa = new Map<string, TemplateServico>();
    customizados.forEach((t) => mapa.set(t.id, t));

    let importados = 0;
    for (const item of lista) {
      if (item && item.titulo && item.conteudo) {
        const id = item.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const tpl: TemplateServico = {
          id,
          titulo: String(item.titulo).trim(),
          categoria: String(item.categoria || 'Importado').trim(),
          conteudo: String(item.conteudo).trim(),
          isCustom: true,
          criadoEm: Number(item.criadoEm || Date.now()),
        };
        mapa.set(id, tpl);
        importados++;
        salvarTemplateSupabase(tpl).catch(() => {});
      }
    }

    const mesclados = Array.from(mapa.values());
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(mesclados));
    return { sucesso: true, qtd: importados };
  } catch (err) {
    console.error('Falha ao importar templates JSON:', err);
    return { sucesso: false, qtd: 0 };
  }
}

export function base64ToBlob(base64Data: string): Blob | null {
  if (!base64Data || base64Data.startsWith('blob:')) return null;
  try {
    const partes = base64Data.split(';base64,');
    if (partes.length < 2) return null;
    const contentType = partes[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(partes[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch {
    return null;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao converter Blob em Base64'));
    reader.readAsDataURL(blob);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não está disponível neste navegador.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(
        new Error(
          `Falha ao abrir o banco IndexedDB (${DB_NAME}): ${
            request.error?.message || 'Erro desconhecido'
          }`
        )
      );
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_RELATORIOS)) {
        const store = db.createObjectStore(STORE_RELATORIOS, {
          keyPath: 'uuid',
        });
        store.createIndex('atualizadoEm', 'atualizadoEm', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_POCOS)) {
        const storePocos = db.createObjectStore(STORE_POCOS, {
          keyPath: 'uuid',
        });
        storePocos.createIndex('tag', 'tag', { unique: false });
        storePocos.createIndex('cliente', 'cliente', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG, { keyPath: 'chave' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

// ═══════════════════════════════════════════════════════
//  CRUD DE CADASTRO DE POÇOS (IndexedDB store: pocos)
// ═══════════════════════════════════════════════════════

export async function listarPocos(): Promise<CadastroPoco[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_POCOS, 'readonly');
    const store = tx.objectStore(STORE_POCOS);
    const request = store.getAll();

    request.onsuccess = () => {
      const lista = (request.result as CadastroPoco[]) || [];
      lista.sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR'));
      resolve(lista);
    };

    request.onerror = () => {
      reject(
        new Error(
          `Erro ao listar poços cadastrados: ${request.error?.message || ''}`
        )
      );
    };

    tx.oncomplete = () => db.close();
  });
}


export async function salvarPoco(poco: CadastroPoco): Promise<CadastroPoco> {
  const db = await openDatabase();
  const payload: CadastroPoco = {
    ...poco,
    atualizadoEm: Date.now(),
  };

  const resultado = await new Promise<CadastroPoco>((resolve, reject) => {
    const tx = db.transaction(STORE_POCOS, 'readwrite');
    const store = tx.objectStore(STORE_POCOS);
    const request = store.put(payload);

    request.onsuccess = () => resolve(payload);
    request.onerror = () =>
      reject(
        new Error(
          `Erro ao salvar poço no IndexedDB: ${request.error?.message || ''}`
        )
      );

    tx.oncomplete = () => db.close();
  });

  // Sincronização em nuvem não-bloqueante com Supabase (se configurado)
  salvarPocoSupabase(resultado).catch((err) =>
    console.debug('Sincronização em nuvem do poço pendente:', err)
  );

  return resultado;
}

export async function excluirPoco(uuid: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_POCOS, 'readwrite');
    const store = tx.objectStore(STORE_POCOS);
    const request = store.delete(uuid);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        new Error(
          `Erro ao excluir poço do IndexedDB: ${request.error?.message || ''}`
        )
      );

    tx.oncomplete = () => db.close();
  });

  // Exclusão remota no Supabase
  excluirPocoSupabase(uuid).catch((err) =>
    console.debug('Exclusão remota do poço pendente:', err)
  );
}

export function criarPocoDemonstracaoLista(): CadastroPoco[] {
  const agora = Date.now();
  return [
    {
      uuid: 'poco-demo-pt01',
      tag: 'PT01',
      nomeIdentificacao: 'Poço Tubular Profundo PT01 — Fazenda Santa Helena (Gleba 04)',
      cliente: 'Agroindustrial Vale do Rio Pardo S/A',
      clienteCNPJ: '[DADO A PREENCHER EM CAMPO]',
      enderecoLocal: 'Fazenda Santa Helena, Gleba 04, Zona Rural',
      cidadeUF: 'Ribeirão Preto / SP',
      coordenadasUTM: 'LAT -21.1767 LON -47.8208 | UTM: [DADO A PREENCHER EM CAMPO]',
      contatoLocal: '[DADO A PREENCHER EM CAMPO]',
      telefoneContato: '[DADO A PREENCHER EM CAMPO]',
      profundidadeTotal: '160,00 m',
      diametroRevestimento: '6" (152,4 mm) Aço Carbono Schedule 40',
      dataPerfuracao: '2026-03-13',
      numeroOutorga: 'Processo DRHS/SP — [DADO A PREENCHER EM CAMPO]',
      aquiferoLitologia: 'Sistema Aquífero Serra Geral / Guarani (Basalto fraturado e pacote sedimentar)',
      crivoPadrao: '[DADO A PREENCHER EM CAMPO — Abaixo de 84,00 m]',
      tuboEdutorPadrao: '[DADO A PREENCHER EM CAMPO]',
      eletrodoSuperiorPadrao: '[DADO A PREENCHER EM CAMPO]',
      eletrodoInferiorPadrao: '[DADO A PREENCHER EM CAMPO]',
      bombaAtual: 'Ebara 4BHS-15 7,5 CV Trifásica 380V (Instalada a 84,00 m — Acima do Crivo)',
      painelAtual: '[DADO A PREENCHER EM CAMPO — Quadro de Comando Trifásico 380V com Soft-Starter e Relé de Nível]',
      observacoesTecnicas:
        'Profundidade 160,00 m, Revestimento 6" (152,4 mm) Aço Carbono Schedule 40, Cimentação sanitária 0-24,00 m, Laje 1,50x1,50x0,15 m. NE: 22,40 m | ND estabilizado: 64,10 m | Vazão recomendada: 10,29 m³/h | Bomba a 84,00 m (submergência de 19,90 m).',
      criadoEm: agora - 86400000 * 120,
      atualizadoEm: agora,
    },
    {
      uuid: 'poco-demo-pt02',
      tag: 'PT02',
      nomeIdentificacao: 'Poço Unidade Industrial II',
      cliente: 'Agroindustrial Vale do Rio Pardo S/A',
      clienteCNPJ: '[DADO A PREENCHER EM CAMPO]',
      enderecoLocal: 'Fazenda Santa Helena, Gleba 02, Zona Rural',
      cidadeUF: 'Ribeirão Preto / SP',
      coordenadasUTM: '[DADO A PREENCHER EM CAMPO]',
      contatoLocal: '[DADO A PREENCHER EM CAMPO]',
      telefoneContato: '[DADO A PREENCHER EM CAMPO]',
      profundidadeTotal: '180,00 m',
      diametroRevestimento: '6" (152,4 mm) Aço Carbono Schedule 40',
      dataPerfuracao: '2025-08-10',
      numeroOutorga: '[DADO A PREENCHER EM CAMPO]',
      aquiferoLitologia: 'Sistema Aquífero Serra Geral / Guarani',
      crivoPadrao: '[DADO A PREENCHER EM CAMPO]',
      tuboEdutorPadrao: '[DADO A PREENCHER EM CAMPO]',
      eletrodoSuperiorPadrao: '[DADO A PREENCHER EM CAMPO]',
      eletrodoInferiorPadrao: '[DADO A PREENCHER EM CAMPO]',
      bombaAtual: 'Submersa Grundfos SP 14-27 10 CV 380V',
      painelAtual: 'Quadro com Inversor de Frequência WEG CFW500',
      observacoesTecnicas:
        'Monitoramento semestral de nível dinâmico e manutenção preventiva anual conforme ABNT NBR 12244.',
      criadoEm: agora - 86400000 * 60,
      atualizadoEm: agora - 86400000 * 5,
    },
  ];
}

// ═══════════════════════════════════════════════════════
//  CRUD DE RELATÓRIOS TÉCNICOS (IndexedDB store: relatorios)
// ═══════════════════════════════════════════════════════

function sanearCampoObrigatorio(valor?: string, padrao = '[DADO A PREENCHER EM CAMPO]'): string {
  if (!valor) return padrao;
  const limpo = valor.trim();
  if (!limpo || limpo === 'N/I' || limpo === '—' || limpo === '-' || limpo === 'N/I - (USADO)') {
    return padrao;
  }
  return limpo;
}

export async function listarRelatorios(): Promise<RelatorioTecnico[]> {
  const db = await openDatabase();
  const registrosBrutos = await new Promise<RelatorioTecnico[]>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_RELATORIOS, 'readonly');
      const store = tx.objectStore(STORE_RELATORIOS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as RelatorioTecnico[]) || []);
      };

      request.onerror = () => {
        reject(
          new Error(
            `Erro ao listar relatórios salvos: ${request.error?.message || ''}`
          )
        );
      };

      tx.oncomplete = () => db.close();
    }
  );

  const normalizados: RelatorioTecnico[] = await Promise.all(
    registrosBrutos.map(async (item) => {
      const fotosRestauradas = await Promise.all(
        (item.fotos || []).map(async (f) => {
          if (!f.urlBase64 && f.blob instanceof Blob) {
            const b64 = await blobToBase64(f.blob);
            return { ...f, urlBase64: b64 };
          }
          return f;
        })
      );

      const checklistNormalizado =
        item.checklist && item.checklist.length > 0
          ? item.checklist.map((chk, idx) => ({
              ...chk,
              concluido: true,
              dataVerificacao: chk.dataVerificacao || '13/03/2026',
              observacao:
                chk.observacao ||
                CHECKLIST_PADRAO_ITENS[idx]?.observacao ||
                'CONFORME — Verificado em campo conforme normas vigentes.',
            }))
          : criarChecklistPadrao(true);

      return {
        ...item,
        equipe: item.equipe || [],
        servicosConduzidos: item.servicosConduzidos || [],
        materiaisAplicados: item.materiaisAplicados || [],
        checklist: checklistNormalizado,
        ocorrenciasCampo: item.ocorrenciasCampo || {
          ocorrencias: '',
          pendencias: '',
          recomendacoes: '',
          observacoesGerais: '',
        },
        dadosPoco: {
          incluirNoRelatorio: true,
          pocoId: sanearCampoObrigatorio(item.dadosPoco?.pocoId, 'PT01'),
          profundidadeTotal: sanearCampoObrigatorio(
            item.dadosPoco?.profundidadeTotal,
            '160,00 m'
          ),
          diametroRevestimento: sanearCampoObrigatorio(
            item.dadosPoco?.diametroRevestimento,
            '6" (152,4 mm) Aço Carbono Schedule 40'
          ),
          crivo: sanearCampoObrigatorio(
            item.dadosPoco?.crivo,
            '[DADO A PREENCHER EM CAMPO — Topo do filtro abaixo de 84,00 m]'
          ),
          profundidadeBomba: sanearCampoObrigatorio(
            item.dadosPoco?.profundidadeBomba,
            '84,00 m (Submergência de 19,90 m abaixo do ND de 64,10 m, acima do topo do crivo)'
          ),
          perfilLitologico:
            item.dadosPoco?.perfilLitologico ||
            '0,00 a 24,00 m: Cobertura sedimentar inconsolidada (Cenozoico) | 24,00 a 160,00 m: Basalto fraturado e pacote sedimentar intertrápico (Sistema Aquífero Serra Geral / Guarani)',
          desenhoConstrutivo: item.dadosPoco?.desenhoConstrutivo,
          parecerHidrogeologico: item.dadosPoco?.parecerHidrogeologico,
          nivelEstatico: sanearCampoObrigatorio(
            item.dadosPoco?.nivelEstatico,
            '22,40 m'
          ),
          nivelDinamico: sanearCampoObrigatorio(
            item.dadosPoco?.nivelDinamico,
            '64,10 m'
          ),
          vazaoTeste: sanearCampoObrigatorio(
            item.dadosPoco?.vazaoTeste,
            '10,29 m³/h'
          ),
          tuboEdutor: sanearCampoObrigatorio(item.dadosPoco?.tuboEdutor),
          eletrodoSuperior: sanearCampoObrigatorio(
            item.dadosPoco?.eletrodoSuperior
          ),
          eletrodoInferior: sanearCampoObrigatorio(
            item.dadosPoco?.eletrodoInferior
          ),
          coordenadasUTM: sanearCampoObrigatorio(
            item.dadosPoco?.coordenadasUTM
          ),
          coordenadasGeograficas:
            item.dadosPoco?.coordenadasGeograficas ||
            'LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)',
          especificacaoBomba: sanearCampoObrigatorio(
            item.dadosPoco?.especificacaoBomba,
            'Ebara 4BHS-15 7,5 CV Trifásica 380V (Instalada a 84,00 m — Acima do topo do crivo)'
          ),
          motobombaEstado: item.dadosPoco?.motobombaEstado || 'Usado',
          painelEletrico: sanearCampoObrigatorio(
            item.dadosPoco?.painelEletrico,
            '[DADO A PREENCHER EM CAMPO — Quadro de Comando Trifásico 380V]'
          ),
          painelEstado: item.dadosPoco?.painelEstado || 'Usado',
          testeVazaoSEMA: item.dadosPoco?.testeVazaoSEMA
            ? {
                ...item.dadosPoco.testeVazaoSEMA,
                responsavelTecnicoCPF: '',
              }
            : undefined,
        },
        fotos: fotosRestauradas,
      };
    })
  );

  normalizados.sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  return normalizados;
}

export async function salvarRelatorio(
  relatorio: RelatorioTecnico
): Promise<RelatorioTecnico> {
  const db = await openDatabase();

  const fotosComBlob: FotoRegistro[] = relatorio.fotos.map((f) => ({
    ...f,
    blob: f.blob || base64ToBlob(f.urlBase64) || undefined,
  }));

  const payload: RelatorioTecnico = {
    ...relatorio,
    id: relatorio.id ?? relatorio.criadoEm,
    fotos: fotosComBlob,
    atualizadoEm: Date.now(),
  };

  const resultado = await new Promise<RelatorioTecnico>((resolve, reject) => {
    const tx = db.transaction(STORE_RELATORIOS, 'readwrite');
    const store = tx.objectStore(STORE_RELATORIOS);
    const request = store.put(payload);

    request.onsuccess = () => {
      resolve(payload);
    };

    request.onerror = () => {
      reject(
        new Error(
          `Erro ao salvar relatório no IndexedDB: ${
            request.error?.message || ''
          }`
        )
      );
    };

    tx.oncomplete = () => db.close();
  });

  // Sincronização em nuvem não-bloqueante com Supabase (se configurado)
  salvarRelatorioSupabase(resultado).catch((err) =>
    console.debug('Sincronização em nuvem do relatório pendente:', err)
  );

  return resultado;
}

export async function excluirRelatorio(uuid: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RELATORIOS, 'readwrite');
    const store = tx.objectStore(STORE_RELATORIOS);
    const request = store.delete(uuid);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        new Error(
          `Erro ao excluir relatório do IndexedDB: ${
            request.error?.message || ''
          }`
        )
      );

    tx.oncomplete = () => db.close();
  });

  // Exclusão remota no Supabase
  excluirRelatorioSupabase(uuid).catch((err) =>
    console.debug('Exclusão remota do relatório pendente:', err)
  );
}

export async function salvarConfigPadrao(
  chave: string,
  valor: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONFIG, 'readwrite');
    const store = tx.objectStore(STORE_CONFIG);
    const request = store.put({ chave, valor });

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(new Error('Falha ao salvar configuração padrão no IndexedDB.'));
    tx.oncomplete = () => db.close();
  });
}

export async function obterConfigPadrao(
  chave: string
): Promise<string | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONFIG, 'readonly');
    const store = tx.objectStore(STORE_CONFIG);
    const request = store.get(chave);

    request.onsuccess = () => {
      const resultado = request.result as
        | { chave: string; valor: string }
        | undefined;
      resolve(resultado?.valor);
    };
    request.onerror = () =>
      reject(new Error('Falha ao ler configuração padrão do IndexedDB.'));
    tx.oncomplete = () => db.close();
  });
}

export function gerarLogoDemonstracao(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 566;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#0F1E36';
  ctx.beginPath();
  ctx.roundRect(10, 18, 124, 124, 16);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(46, 112);
  ctx.lineTo(72, 38);
  ctx.lineTo(98, 112);
  ctx.stroke();

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(54, 86);
  ctx.lineTo(90, 86);
  ctx.moveTo(61, 64);
  ctx.lineTo(83, 64);
  ctx.moveTo(72, 38);
  ctx.lineTo(72, 118);
  ctx.stroke();

  ctx.strokeStyle = '#0EA5E9';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 124);
  ctx.quadraticCurveTo(51, 114, 72, 124);
  ctx.quadraticCurveTo(93, 134, 114, 124);
  ctx.stroke();

  ctx.fillStyle = '#0F1E36';
  ctx.font = 'bold 38px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('HIDROGEO', 152, 68);

  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('ENGENHARIA & POÇOS', 154, 96);

  ctx.fillStyle = '#6B7A8D';
  ctx.font = '600 13px "Public Sans", sans-serif';
  ctx.fillText('SONDAGENS · PERFURAÇÃO · GEOTECNIA', 154, 122);

  return canvas.toDataURL('image/png');
}

function gerarAssinaturaDemo(nome: string, corTraco = '#1B2A3B'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.strokeStyle = corTraco;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(65, 118);
  ctx.bezierCurveTo(95, 42, 135, 48, 120, 122);
  ctx.bezierCurveTo(112, 145, 165, 68, 195, 96);
  ctx.bezierCurveTo(215, 115, 245, 72, 275, 98);
  ctx.bezierCurveTo(305, 120, 345, 78, 395, 88);
  ctx.stroke();

  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(52, 138);
  ctx.quadraticCurveTo(220, 116, 425, 128);
  ctx.stroke();

  ctx.fillStyle = '#6B7A8D';
  ctx.font = 'italic 13px "JetBrains Mono", monospace';
  ctx.fillText(`Assinado digitalmente: ${nome}`, 65, 162);

  return canvas.toDataURL('image/png');
}

export function criarRelatorioEmBranco(
  cabecalhoPadrao?: Partial<DadosCabecalho>,
  pocoVinculado?: CadastroPoco
): RelatorioTecnico {
  const agora = Date.now();

  return {
    id: agora,
    uuid:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `rel-${agora}-${Math.floor(Math.random() * 10000)}`,
    pocoUuid: pocoVinculado?.uuid,
    status: 'rascunho',
    cabecalho: {
      razaoSocial:
        cabecalhoPadrao?.razaoSocial ||
        'HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA.',
      cnpj: cabecalhoPadrao?.cnpj || '18.492.310/0001-54',
      enderecoEmpresa:
        cabecalhoPadrao?.enderecoEmpresa ||
        'End. Av. Los Angeles, 269 – Bairro Jardim Califórnia',
      cidadeContatoEmpresa:
        cabecalhoPadrao?.cidadeContatoEmpresa ||
        'Sorriso-MT / CEP 78894-183 / Fone: (65) 3624-1389 Celular: (65) 99972-3112',
      emailEmpresa:
        cabecalhoPadrao?.emailEmpresa || 'diretoria.geo@geoeste.com.br',
      cliente:
        pocoVinculado?.cliente || '[DADO A PREENCHER EM CAMPO]',
      clienteCNPJ:
        pocoVinculado?.clienteCNPJ || '[DADO A PREENCHER EM CAMPO]',
      contratoOS: `OS-${new Date().getFullYear()}-${String(
        Math.floor(1000 + Math.random() * 9000)
      )}`,
      contratoRef: '[DADO A PREENCHER EM CAMPO]',
      tipoServico:
        'Perfuração Conclusiva, Teste de Bombeamento Contínuo (24h) e Comissionamento (ABNT NBR 12212 / NBR 12244)',
      statusOS: 'Concluído',
      localizacao:
        pocoVinculado?.enderecoLocal || '[DADO A PREENCHER EM CAMPO]',
      cidadeUF: pocoVinculado?.cidadeUF || 'Ribeirão Preto / SP',
      coordenadasGeograficas: 'LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)',
      contatoLocal:
        pocoVinculado?.contatoLocal || '[DADO A PREENCHER EM CAMPO]',
      telefoneContato:
        pocoVinculado?.telefoneContato || '[DADO A PREENCHER EM CAMPO]',
      dataExecucao: '2026-03-13',
      logoBase64: cabecalhoPadrao?.logoBase64 || gerarLogoDemonstracao(),
    },
    dadosPoco: {
      incluirNoRelatorio: true,
      pocoId: pocoVinculado?.tag || 'PT01',
      profundidadeTotal: pocoVinculado?.profundidadeTotal || '160,00 m',
      diametroRevestimento:
        pocoVinculado?.diametroRevestimento ||
        '6" (152,4 mm) Aço Carbono Schedule 40',
      crivo:
        pocoVinculado?.crivoPadrao ||
        '[DADO A PREENCHER EM CAMPO — Topo do filtro abaixo de 84,00 m]',
      profundidadeBomba:
        '84,00 m (Submergência de 19,90 m abaixo do ND de 64,10 m, acima do topo do crivo)',
      nivelEstatico: '22,40 m',
      nivelDinamico: '64,10 m',
      vazaoTeste: '10,29 m³/h',
      tuboEdutor:
        pocoVinculado?.tuboEdutorPadrao || '[DADO A PREENCHER EM CAMPO]',
      eletrodoSuperior:
        pocoVinculado?.eletrodoSuperiorPadrao || '[DADO A PREENCHER EM CAMPO]',
      eletrodoInferior:
        pocoVinculado?.eletrodoInferiorPadrao || '[DADO A PREENCHER EM CAMPO]',
      coordenadasUTM:
        pocoVinculado?.coordenadasUTM || '[DADO A PREENCHER EM CAMPO]',
      coordenadasGeograficas: 'LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)',
      especificacaoBomba:
        pocoVinculado?.bombaAtual ||
        'Ebara 4BHS-15 7,5 CV Trifásica 380V (Instalada a 84,00 m — Acima do topo do crivo)',
      motobombaEstado: 'Usado',
      painelEletrico:
        pocoVinculado?.painelAtual ||
        '[DADO A PREENCHER EM CAMPO — Quadro de Comando Trifásico 380V]',
      painelEstado: 'Usado',
      testeVazaoSEMA: {
        ativo: true,
        tipoEnsaio: 'Contínuo 24h a Vazão Constante',
        etapaLabel: '24H',
        referenciaMedidasM: '0,00',
        responsavelTecnicoNome: 'Eng. Geólogo José Roberto Ribeiro',
        responsavelTecnicoCPF: '',
        responsavelTecnicoCREA: 'CREA [DADO A PREENCHER EM CAMPO]',
        artNumero: '[DADO A PREENCHER EM CAMPO]',
        dataInicioEnsaio: '2026-03-13',
        horaInicioBombeamento: '11:30:00',
        dataFinalBombeamento: '2026-03-13',
        horaFinalBombeamento: '18:10:00',
        dataInicioRecuperacao: '2026-03-13',
        horaInicioRecuperacao: '18:10:00',
        dataFinalRecuperacao: '2026-03-13',
        horaFinalRecuperacao: '18:45:00',
        tempoRecuperacaoMinutos: '35',
        nivelRecuperacaoFinalM: '33,60',
        vazaoOutorgaRecomendadaM3h: '10,29',
        regimeBombeamentoHorasDia: '16',
        etapas: [
          {
            id: 'step-1',
            etapa: 1,
            duracaoMinutos: 120,
            vazaoM3h: '6,50',
            nivelDinamicoM: '46,20',
            observacao: '1ª Etapa Escalonada — Regime Laminar Predominante',
          },
          {
            id: 'step-2',
            etapa: 2,
            duracaoMinutos: 120,
            vazaoM3h: '8,40',
            nivelDinamicoM: '54,80',
            observacao: '2ª Etapa Escalonada — Transição Hidrodinâmica',
          },
          {
            id: 'step-3',
            etapa: 3,
            duracaoMinutos: 240,
            vazaoM3h: '10,29',
            nivelDinamicoM: '64,10',
            observacao: '3ª Etapa Nominal Estabilizada — Vazão Recomendada (24h)',
          },
        ],
      },
    },
    descricaoServico: '',
    equipe: [
      {
        id: `eq-${agora}-1`,
        nome: 'Eng. Geólogo José Roberto Ribeiro',
        funcao: 'Responsável Técnico — Hidrogeólogo Sênior (CREA [DADO A PREENCHER EM CAMPO])',
      },
    ],
    servicosConduzidos: [
      {
        id: `srv-${agora}-1`,
        descricao:
          'Teste de Bombeamento Contínuo 24h a vazão constante (ABNT NBR 12244)',
        unidade: 'UN',
        quantidade: '1',
        status: 'Executado',
      },
    ],
    materiaisAplicados: [],
    checklist: criarChecklistPadrao(true),
    ocorrenciasCampo: {
      ocorrencias: '',
      pendencias: '',
      recomendacoes: '',
      observacoesGerais: '',
    },
    fotos: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/**
 * Cria o Relatório Técnico de Entrega Oficial e Integralmente Corrigido:
 * HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA. — OS-2026-0842 / CTR-119 (Poço PT01)
 * Cliente: Agroindustrial Vale do Rio Pardo S/A | Fazenda Santa Helena, Gleba 04, Ribeirão Preto/SP
 */
export function criarRelatorioDemonstracao(): RelatorioTecnico {
  const agora = Date.now();

  // Placeholders obrigatórios para fotos reais de campo (PROIBIDO usar fotos ilustrativas geradas em canvas)
  const fotosPlaceholdersReais: FotoRegistro[] = [
    {
      id: 'foto-real-placeholder-1',
      urlBase64: '',
      legenda:
        '[FOTO REAL OBRIGATÓRIA: Sonda perfuratriz rotopneumática posicionada e patolada no ponto locado do Poço PT01 (Fazenda Santa Helena, Gleba 04), com início de perfuração em diâmetro de 10" para cimentação sanitária (0 a 24,00 m) | Data: 13/03/2026 | GPS: LAT -21.1767° S, LON -47.8208° W]',
      timestamp: agora - 14400000,
      ordem: 1,
    },
    {
      id: 'foto-real-placeholder-2',
      urlBase64: '',
      legenda:
        '[FOTO REAL OBRIGATÓRIA: Descarga contínua de água límpida e isenta de partículas durante Teste de Bombeamento Contínuo de 24 horas a vazão constante estabilizada em 10,29 m³/h (NE = 22,40 m / ND = 64,10 m / s = 41,70 m) aferida com hidrômetro totalizador e tubo Pitot | Data: 13/03/2026 | GPS: LAT -21.1767° S, LON -47.8208° W]',
      timestamp: agora - 10800000,
      ordem: 2,
    },
    {
      id: 'foto-real-placeholder-3',
      urlBase64: '',
      legenda:
        '[FOTO REAL OBRIGATÓRIA: Conferência dimensional e teste de isolação ôhmica com megôhmetro no conjunto motobomba submerso Ebara 4BHS-15 7,5 CV Trifásica 380V antes da descida definitiva aos 84,00 m de profundidade (posicionado acima do topo do crivo, com submergência de 19,90 m abaixo do ND) | Data: 13/03/2026 | GPS: LAT -21.1767° S, LON -47.8208° W]',
      timestamp: agora - 7200000,
      ordem: 3,
    },
    {
      id: 'foto-real-placeholder-4',
      urlBase64: '',
      legenda:
        '[FOTO REAL OBRIGATÓRIA: Laje de proteção sanitária em concreto armado (1,50 x 1,50 x 0,15 m), vedação hermética da cabeça do poço PT01 e comissionamento do quadro elétrico de comando com aferição de tensão nominal (380 V) e corrente balanceada (11,4 A) nas três fases | Data: 13/03/2026 | GPS: LAT -21.1767° S, LON -47.8208° W]',
      timestamp: agora - 3600000,
      ordem: 4,
    },
  ];

  return {
    id: agora,
    uuid: 'laudo-hidrogeo-os-2026-0842-corrigido',
    pocoUuid: 'poco-demo-pt01',
    status: 'finalizado',
    cabecalho: {
      razaoSocial: 'HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA.',
      cnpj: '18.492.310/0001-54',
      enderecoEmpresa:
        'End. Av. Los Angeles, 269 – Bairro Jardim Califórnia',
      cidadeContatoEmpresa:
        'Sorriso-MT / CEP 78894-183 / Fone: (65) 3624-1389 Celular: (65) 99972-3112',
      emailEmpresa: 'diretoria.geo@geoeste.com.br',
      cliente: 'Agroindustrial Vale do Rio Pardo S/A',
      clienteCNPJ: '[DADO A PREENCHER EM CAMPO]',
      contratoOS: 'OS-2026-0842 / CTR-119',
      contratoRef: 'CTR-119 / 2026',
      tipoServico:
        'Perfuração Conclusiva, Teste de Bombeamento Contínuo 24h (ABNT NBR 12212 / NBR 12244) e Instalação de Motobomba',
      statusOS: 'Concluído',
      localizacao: 'Fazenda Santa Helena, Gleba 04, Zona Rural',
      cidadeUF: 'Ribeirão Preto / SP',
      coordenadasGeograficas: 'LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)',
      contatoLocal: '[DADO A PREENCHER EM CAMPO]',
      telefoneContato: '[DADO A PREENCHER EM CAMPO]',
      dataExecucao: '2026-03-13',
      logoBase64: gerarLogoDemonstracao(),
    },
    dadosPoco: {
      incluirNoRelatorio: true,
      pocoId: 'PT01',
      profundidadeTotal: '160,00 m',
      diametroRevestimento: '6" (152,4 mm) Aço Carbono Schedule 40',
      crivo:
        '[DADO A PREENCHER EM CAMPO — Topo da seção filtrante/crivo posicionado abaixo de 84,00 m]',
      profundidadeBomba:
        '84,00 m (Acima do topo do crivo · Submergência de 19,90 m abaixo do ND máximo de 64,10 m)',
      perfilLitologico:
        '0,00 a 24,00 m: Cobertura sedimentar inconsolidada e solo residual (Cenozoico) | 24,00 a 160,00 m: Pacote sedimentar intertrápico e basalto fraturado vesicular-amigdaloidal (Sistema Aquífero Serra Geral / Guarani)',
      desenhoConstrutivo: `1. GEOMETRIA DE PERFURAÇÃO E REVESTIMENTO (CASING): Poço tubular profundo perfurado pelo método rotopneumático até a profundidade final de 160,00 m. Abertura superior em diâmetro nominal de 10" (254,0 mm) de 0,00 m a 24,00 m e prosseguimento em 6" (152,4 mm) até 160,00 m. Coluna de revestimento definitivo em tubos de Aço Carbono Schedule 40 de 6" (152,4 mm), conforme ABNT NBR 12212 e NBR 12244.\n2. SEÇÃO FILTRANTE / CRIVO E POSICIONAMENTO DA BOMBA: Seção filtrante / entradas d'água situadas em cota inferior a 84,00 m ([DADO A PREENCHER EM CAMPO — intervalo exato de filtros/fraturas]). O conjunto motobomba submerso foi instalado na profundidade única de 84,00 m, permanecendo estritamente ACIMA do topo do crivo e assegurando submergência efetiva de 19,90 m abaixo do Nível Dinâmico máximo estabilizado (ND = 64,10 m), superando com folga a submergência mínima normativa de 10,00 m.\n3. CIMENTAÇÃO SANITÁRIA (0,00 A 24,00 m) E LAJE DE PROTEÇÃO: Espaço anelar superior (0,00 m a 24,00 m) integralmente tamponado por injeção ascendente de calda de cimento para isolamento sanitário de águas subsuperficiais. Laje de proteção sanitária executada em concreto armado nas dimensões de 1,50 m × 1,50 m × 0,15 m, com caimento periférico, tampa de vedação hermética e tubo guia lateral para medição piezométrica (NE/ND).`,
      parecerHidrogeologico: `1. PARÂMETROS HIDRODINÂMICOS CONSOLIDADOS (TESTE CONTÍNUO 24H A VAZÃO CONSTANTE):\n• Nível Estático Inicial (NE): 22,40 m\n• Nível Dinâmico Estabilizado (ND): 64,10 m\n• Vazão de Explotação Recomendada (Q): 10,29 m³/h (10,286 m³/h)\n• Rebaixamento Máximo Estabilizado (s = ND − NE): 64,10 m − 22,40 m = 41,70 m\n• Capacidade Específica (Q/s): 10,286 m³/h ÷ 41,70 m = 0,2467 m³/h/m (ou Rebaixamento Específico s/Q = 4,0541 m/m³/h)\n• Profundidade Única de Instalação da Bomba: 84,00 m (19,90 m abaixo do ND de 64,10 m e acima do topo do crivo)\n\n2. RECUPERAÇÃO RESIDUAL REAL RECALCULADA (MÉTODO DE THEIS — ANEXO I.2):\n• Aos 35 minutos após o desligamento do bombeamento, o nível d'água ascendeu de 64,10 m para 33,60 m, correspondendo a um rebaixamento residual medido s' = 33,60 − 22,40 = 11,20 m (recuperação absoluta de 30,50 m da coluna d'água).\n• Percentual de Recuperação Real Recalculado (35 min): [(41,70 − 11,20) ÷ 41,70] × 100 = 73,14% (73,1%), atingindo recuperação plena (> 98% do nível estático original) após 180 minutos de repouso.\n\n3. TRANSMISSIVIDADE (T) PELO MÉTODO DE COOPER-JACOB (ABNT NBR 12244):\n• Fórmula: T = (0,183 × Q) ÷ Δs₁₀ [m²/h]  ⇒  T(diária) = [(0,183 × Q) ÷ Δs₁₀] × 24 [m²/dia]\n• Dados do ciclo logarítmico (t = 10 min a t = 100 min): Q = 10,286 m³/h (246,86 m³/dia); Δs₁₀ = 19,00 m por ciclo logarítmico.\n• Cálculo: T = [(0,183 × 10,286) ÷ 19,00] × 24 = 0,0991 m²/h × 24 = 2,38 m²/dia.\n\n4. OBSERVAÇÕES TÉCNICAS — SANEAMENTO DE DIVERGÊNCIAS DOCUMENTAIS:\n• Registra-se que a minuta preliminar anterior continha inconsistência textual citando vazão de 18,40 m³/h, ND de 86,50 m e cota de bomba de 114,00 m, além de vazões preliminares de limpeza (14,40 e 12,00 m³/h) na planilha e índice incorreto de recuperação de 96,9%. Em conformidade com a ABNT NBR 12212 e NBR 12244, tais valores preliminares foram integralmente descartados, adotando-se exclusivamente os parâmetros auditados da Ficha Técnica e do Teste Contínuo 24h a vazão constante: NE = 22,40 m, ND = 64,10 m, Q = 10,29 m³/h, Bomba aos 84,00 m e Recuperação Real de 73,1% aos 35 min.`,
      nivelEstatico: '22,40 m',
      nivelDinamico: '64,10 m',
      vazaoTeste: '10,29 m³/h',
      tuboEdutor:
        '[DADO A PREENCHER EM CAMPO — Tubos galvanizados a fogo 2.1/2" — confirmar metragem e rosca]',
      eletrodoSuperior:
        '[DADO A PREENCHER EM CAMPO — Definir cota acima de 84,00 m]',
      eletrodoInferior:
        '[DADO A PREENCHER EM CAMPO — Definir cota acima da sucção da bomba a 84,00 m]',
      coordenadasUTM: '[DADO A PREENCHER EM CAMPO]',
      coordenadasGeograficas: 'LAT -21.1767° S | LON -47.8208° W (SIRGAS 2000)',
      especificacaoBomba:
        'Ebara 4BHS-15 7,5 CV Trifásica 380V (Instalada a 84,00 m — Acima do topo do crivo)',
      motobombaEstado: 'Usado',
      painelEletrico:
        '[DADO A PREENCHER EM CAMPO — Quadro de Comando Trifásico 380V com Soft-Starter, Relé Falta de Fase e Relé de Nível]',
      painelEstado: 'Usado',
      testeVazaoSEMA: {
        ativo: true,
        tipoEnsaio: 'Contínuo 24h a Vazão Constante',
        etapaLabel: '24H',
        referenciaMedidasM: '0,00',
        responsavelTecnicoNome: 'Eng. Geólogo José Roberto Ribeiro',
        responsavelTecnicoCPF: '',
        responsavelTecnicoCREA: 'CREA [DADO A PREENCHER EM CAMPO]',
        artNumero: '[DADO A PREENCHER EM CAMPO]',
        dataInicioEnsaio: '2026-03-13',
        horaInicioBombeamento: '11:30:00',
        dataFinalBombeamento: '2026-03-13',
        horaFinalBombeamento: '18:10:00',
        dataInicioRecuperacao: '2026-03-13',
        horaInicioRecuperacao: '18:10:00',
        dataFinalRecuperacao: '2026-03-13',
        horaFinalRecuperacao: '18:45:00',
        tempoRecuperacaoMinutos: '35',
        nivelRecuperacaoFinalM: '33,60',
        vazaoOutorgaRecomendadaM3h: '10,29',
        regimeBombeamentoHorasDia: '16',
        etapas: [
          {
            id: 'step-demo-1',
            etapa: 1,
            duracaoMinutos: 120,
            vazaoM3h: '6,50',
            nivelDinamicoM: '46,20',
            observacao: '1ª Etapa Escalonada — Regime Laminar Predominante',
          },
          {
            id: 'step-demo-2',
            etapa: 2,
            duracaoMinutos: 120,
            vazaoM3h: '8,40',
            nivelDinamicoM: '54,80',
            observacao: '2ª Etapa Escalonada — Transição Hidrodinâmica',
          },
          {
            id: 'step-demo-3',
            etapa: 3,
            duracaoMinutos: 240,
            vazaoM3h: '10,29',
            nivelDinamicoM: '64,10',
            observacao: '3ª Etapa Nominal Estabilizada — Vazão Recomendada (24h)',
          },
        ],
      },
    },
    descricaoServico: `5.1 OBJETIVO DO SERVIÇO\nConclusão da perfuração do Poço Tubular Profundo PT01 (160,00 m), desenvolvimento pneumático por Air-Lift, execução de Teste de Bombeamento Contínuo de 24 horas a vazão constante conforme ABNT NBR 12212 e ABNT NBR 12244, seguido de instalação definitiva do conjunto motobomba submerso na profundidade única de 84,00 m e comissionamento elétrico.\n\n5.2 PROCEDIMENTOS DE PERFURAÇÃO E COMPLETAÇÃO SANITÁRIA\n• Perfuração rotopneumática finalizada aos 160,00 m de profundidade, atravessando pacote sedimentar Cenozoico (0,00 a 24,00 m) e basalto fraturado do Sistema Aquífero Serra Geral / Guarani (24,00 a 160,00 m);\n• Revestimento em coluna de Aço Carbono Schedule 40 com diâmetro nominal de 6" (152,4 mm);\n• Aplicação de cimentação sanitária contínua no espaço anelar superior (0,00 a 24,00 m) e execução de laje de proteção sanitária em concreto armado (1,50 × 1,50 × 0,15 m).\n\n5.3 DESENVOLVIMENTO PNEUMÁTICO (AIR-LIFT)\n• Desenvolvimento completo por injeção de ar comprimido (Air-Lift) durante 6,0 horas contínuas até total ausência de partículas finas em suspensão e completa limpidez da água (areia = 0 ppm).\n\n5.4 TESTE DE BOMBEAMENTO CONTÍNUO DE 24 HORAS A VAZÃO CONSTANTE\n• Ensaio realizado em 13/03/2026 com Nível Estático inicial (NE) medido em 22,40 m e Nível Dinâmico estabilizado (ND) em 64,10 m para a vazão constante de explotação de 10,29 m³/h (10,286 m³/h), resultando em rebaixamento estabilizado s = 41,70 m e Capacidade Específica Q/s = 0,2467 m³/h/m (Anexo I.1), seguido de ensaio de recuperação residual (Anexo I.2, recuperação de 73,1% aos 35 min) e interpretação hidrodinâmica s = B·Q + C·Q² (Anexo I.3).\n\n5.5 INSTALAÇÃO DO CONJUNTO MOTOBOMBA E COMISSIONAMENTO ELÉTRICO\n• Descida do conjunto motobomba submerso Ebara 4BHS-15 7,5 CV Trifásica 380V posicionado aos 84,00 m de profundidade (estritamente acima do topo do crivo e com submergência de 19,90 m abaixo do ND máximo de 64,10 m, atendendo à submergência mínima de 10,00 m), acompanhado de cabo PP submersível 3×6,0 mm², sensores de nível ([DADO A PREENCHER EM CAMPO]) e comissionamento do painel elétrico (380 V trifásico / corrente nominal balanceada de 11,4 A nas três fases).`,
    equipe: [
      {
        id: 'eq-1',
        nome: 'Eng. Geólogo José Roberto Ribeiro',
        funcao: 'Responsável Técnico — Hidrogeólogo Sênior (CREA [DADO A PREENCHER EM CAMPO])',
      },
      {
        id: 'eq-2',
        nome: 'Equipe Técnica de Perfuração e Eletromecânica — HidroGeo',
        funcao: 'Sondagem Rotopneumática, Ensaio NBR 12244 e Comissionamento Elétrico',
      },
    ],
    servicosConduzidos: [
      {
        id: 'srv-1',
        descricao:
          'Perfuração rotopneumática até 160,00 m, revestimento 6" (152,4 mm) Aço Carbono Sch 40, cimentação sanitária (0–24 m) e laje (1,50×1,50×0,15 m)',
        unidade: 'SV',
        quantidade: '1',
        status: 'Executado',
      },
      {
        id: 'srv-2',
        descricao:
          'Desenvolvimento hidrogeológico por Air-Lift (6 h) e Teste de Bombeamento Contínuo 24h a vazão constante (Q = 10,29 m³/h; NE = 22,40 m; ND = 64,10 m)',
        unidade: 'h',
        quantidade: '24',
        status: 'Executado',
      },
      {
        id: 'srv-3',
        descricao:
          'Instalação de motobomba Ebara 4BHS-15 7,5 CV 380V aos 84,00 m (acima do crivo, submergência 19,90 m) e comissionamento (380 V / 11,4 A)',
        unidade: 'UN',
        quantidade: '1',
        status: 'Executado',
      },
    ],
    materiaisAplicados: [
      {
        id: 'mat-1',
        descricao: 'Tubo de Revestimento Aço Carbono Schedule 40 Ø 6" (152,4 mm)',
        unidade: 'Metro',
        quantidade: '[DADO A PREENCHER EM CAMPO]',
        situacao: 'Aplicado',
      },
      {
        id: 'mat-2',
        descricao: 'Conjunto Motobomba Submerso Ebara 4BHS-15 7,5 CV Trifásica 380V (Posicionado a 84,00 m)',
        unidade: 'Unidade',
        quantidade: '1',
        situacao: 'Aplicado',
      },
      {
        id: 'mat-3',
        descricao: 'Cabo Elétrico Submersível PP 3x6,0 mm²',
        unidade: 'Metro',
        quantidade: '90',
        situacao: 'Aplicado',
      },
    ],
    checklist: criarChecklistPadrao(true),
    ocorrenciasCampo: {
      ocorrencias:
        'Saneamento de divergências documentais: eliminada a referência preliminar a 18,40 m³/h (ND 86,50 m) e 114,00 m de bomba constante em rascunho anterior, prevalecendo exclusivamente os dados auditados da Ficha e dos Anexos (NE = 22,40 m, ND = 64,10 m, Q = 10,29 m³/h, Bomba instalada a 84,00 m acima do topo do crivo).',
      pendencias:
        'Obra concluída sem pendências construtivas. Preencher em campo os dados cadastrais complementares sinalizados com [DADO A PREENCHER EM CAMPO] (coordenadas UTM, cota exata do topo do crivo e eletrodos).',
      recomendacoes: `1. Operar o Poço PT01 na vazão máxima recomendada de 10,29 m³/h em regime diário de 16 a 20 h/dia (produção de 164,64 a 205,80 m³/dia), mantendo o Nível Dinâmico estabilizado em 64,10 m e preservando a submergência de segurança de 19,90 m acima da bomba (instalada aos 84,00 m);\n2. Monitorar mensalmente o Nível Estático (NE), o Nível Dinâmico (ND), a vazão no hidrômetro totalizador e a corrente elétrica nas três fases (nominal de 11,4 A em 380 V);\n3. Realizar análises físico-químicas e microbiológicas semestrais da água bruta conforme Portaria GM/MS nº 888/2021 e manter a tampa hermética e a laje sanitária (1,50 × 1,50 × 0,15 m) limpas e desobstruídas;\n4. Executar manutenção preventiva eletromecânica e limpeza/desinfecção do poço a cada 12 meses.`,
      observacoesGerais:
        'Tensão nominal aferida no quadro de comando: 380 V trifásico | Corrente nominal balanceada: 11,4 A | Eficiência hidráulica do poço na vazão nominal: η = 73,8% | Transmissividade Cooper-Jacob: T = 2,38 m²/dia.',
    },
    fotos: fotosPlaceholdersReais,
    assinaturaResponsavel: {
      dataUrl: gerarAssinaturaDemo('Eng. Geólogo José Roberto Ribeiro', '#1B2A3B'),
      nomeSignatario: 'Eng. Geólogo / Hidrogeólogo José Roberto Ribeiro',
      documento: 'CREA [DADO A PREENCHER EM CAMPO] · ART [DADO A PREENCHER EM CAMPO]',
      funcao: 'Responsável Técnico — HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA.',
      dataRegistro: '13/03/2026',
    },
    assinaturaCliente: {
      dataUrl: '',
      nomeSignatario: '[DADO A PREENCHER EM CAMPO — Nome do Fiscal do Cliente]',
      documento: 'Cargo / Matrícula: [DADO A PREENCHER EM CAMPO]',
      funcao: 'Fiscal do Cliente — Agroindustrial Vale do Rio Pardo S/A',
      dataRegistro: '13/03/2026',
    },
    criadoEm: agora - 18000000,
    atualizadoEm: agora,
  };
}

/**
 * Cria um segundo relatório histórico anterior para o mesmo Poço PT01
 */
export function criarRelatorioHistoricoAnteriorPT01(): RelatorioTecnico {
  const passado = Date.now() - 86400000 * 180;
  return {
    ...criarRelatorioDemonstracao(),
    id: passado,
    uuid: 'demo-parecis-geoeste-000-historico',
    status: 'exportado',
    cabecalho: {
      ...criarRelatorioDemonstracao().cabecalho,
      contratoOS: 'OS-2025-0610 / CTR-119',
      tipoServico: 'Desenvolvimento Preliminar e Limpeza Air-Lift',
      dataExecucao: '2025-09-15',
    },
    dadosPoco: {
      ...criarRelatorioDemonstracao().dadosPoco,
      nivelEstatico: '22,80 m',
      nivelDinamico: '66,50 m',
      vazaoTeste: '9,80 m³/h',
    },
    fotos: [],
    criadoEm: passado,
    atualizadoEm: passado,
  };
}

/**
 * Cria um terceiro relatório histórico inaugural para o Poço PT01
 */
export function criarRelatorioInauguralPT01(): RelatorioTecnico {
  const passado = Date.now() - 86400000 * 365;
  return {
    ...criarRelatorioDemonstracao(),
    id: passado,
    uuid: 'demo-parecis-geoeste-000-inaugural',
    status: 'exportado',
    cabecalho: {
      ...criarRelatorioDemonstracao().cabecalho,
      contratoOS: 'OS-2025-0190 / CTR-119',
      tipoServico: 'Locação Hidrogeológica e Início de Perfuração',
      dataExecucao: '2025-03-10',
    },
    dadosPoco: {
      ...criarRelatorioDemonstracao().dadosPoco,
      nivelEstatico: '22,40 m',
      nivelDinamico: '65,00 m',
      vazaoTeste: '10,00 m³/h',
    },
    fotos: [],
    criadoEm: passado,
    atualizadoEm: passado,
  };
}



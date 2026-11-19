import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELOS_GEMINI_GRATUITOS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
] as const;

function aguardarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extrairDetalhesErroGemini(error: any): {
  statusCode: number;
  rawText: string;
  isQuotaDiaria: boolean;
  isRateLimitMinuto: boolean;
  isAuthErro: boolean;
} {
  const rawText = String(error?.message || error || '');
  const lower = rawText.toLowerCase();
  const statusFromErr = Number(error?.status || error?.code || 0);

  let statusCode = statusFromErr;
  if (!statusCode) {
    if (lower.includes('429') || lower.includes('resource_exhausted')) {
      statusCode = 429;
    } else if (
      lower.includes('403') ||
      lower.includes('permission_denied') ||
      lower.includes('api_key_invalid')
    ) {
      statusCode = 403;
    } else if (lower.includes('404') || lower.includes('not_found')) {
      statusCode = 404;
    } else if (lower.includes('503') || lower.includes('unavailable')) {
      statusCode = 503;
    } else {
      statusCode = 500;
    }
  }

  const isQuotaDiaria =
    statusCode === 429 &&
    (lower.includes('perday') ||
      lower.includes('per day') ||
      lower.includes('limit: 0'));
  const isRateLimitMinuto = statusCode === 429 && !isQuotaDiaria;
  const isAuthErro =
    statusCode === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied');

  return {
    statusCode,
    rawText,
    isQuotaDiaria,
    isRateLimitMinuto,
    isAuthErro,
  };
}

async function executarComRetryGemini<T>(
  operacao: () => Promise<T>,
  maxTentativas = 3
): Promise<T> {
  let ultimoErro: any = null;
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    try {
      return await operacao();
    } catch (err: any) {
      ultimoErro = err;
      const info = extrairDetalhesErroGemini(err);
      const deveTentarNovamente =
        (info.isRateLimitMinuto || info.statusCode === 503 || info.statusCode === 500) &&
        tentativa < maxTentativas - 1;
      if (!deveTentarNovamente) {
        throw err;
      }
      await aguardarMs(1500 * Math.pow(2, tentativa));
    }
  }
  throw ultimoErro;
}

function formatarErroGeminiParaCliente(
  error: any,
  mensagemPadrao: string
): { status: number; message: string } {
  const info = extrairDetalhesErroGemini(error);

  if (info.isQuotaDiaria) {
    return {
      status: 429,
      message:
        'Limite diário da cota gratuita da API Gemini atingido. Você pode conferir e preencher os campos manualmente ao lado do PDF, aguardar a renovação da cota ou selecionar uma chave com faturamento ativo em Settings > Secrets.',
    };
  }

  if (info.isRateLimitMinuto) {
    return {
      status: 429,
      message:
        'Limite temporário de requisições por minuto da API Gemini atingido. Aguarde alguns segundos e clique em tentar novamente, ou preencha manualmente ao lado do PDF.',
    };
  }

  if (info.isAuthErro) {
    return {
      status: 403,
      message:
        'Chave da API Gemini inválida ou sem permissão. Verifique a chave selecionada no painel Settings > Secrets.',
    };
  }

  // Evita expor blocos JSON brutos na interface
  const textoLimpo = info.rawText.trim().startsWith('{')
    ? mensagemPadrao
    : info.rawText || mensagemPadrao;

  return {
    status: info.statusCode >= 400 && info.statusCode < 600 ? info.statusCode : 500,
    message: textoLimpo,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Endpoint para leitura inteligente de Ordem de Serviço / Ficha de Campo (PDF ou Foto manuscrita)
  app.post('/api/extrair-os-campo', async (req, res) => {
    try {
      const { base64Data, mimeType, nomeArquivo } = req.body;

      if (!base64Data || !mimeType) {
        res.status(400).json({
          error: 'Arquivo não enviado. Envie um PDF ou imagem da Ordem de Serviço.',
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error:
            'Chave GEMINI_API_KEY não encontrada no servidor. Verifique o painel Settings > Secrets.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const cleanBase64 = base64Data.includes(';base64,')
        ? base64Data.split(';base64,')[1]
        : base64Data;

      const systemPrompt = `Você é um engenheiro hidrogeólogo e especialista em leitura de Ordens de Serviço (O.S.) e fichas de campo manuscritas de manutenção e perfuração de poços artesianos.
Analise todas as páginas do documento enviado (geralmente contém:
- Página 1: Ordem de Serviço impressa com anotações manuscritas e correções à caneta sobre dados do cliente, endereço, poço, bomba, painel, tubo edutor, produtos utilizados e serviços executados;
- Página 2: Termo de recebimento com Data de execução manuscrita, Nome do Cliente/Representante, Líder da Equipe, Auxiliar e Observações manuscritas ("Obs:");
- Página 3: Carimbo técnico de campo no verso com tabela INÍCIO/FIM e ANTES/DEPOIS contendo: VAZÃO, NE, ND, AMPERAGEM, TENSÃO, BOMBA, PAINEL NÍVEL, EDUTOR OU GALV., CABO (ES/EI), TUBO NÍVEL, ATERRAMENTO, CAVALETE e Ø POÇO).

REGRAS CRÍTICAS DE PRIORIDADE:
1. ANOTAÇÕES MANUSCRITAS TÊM PRIORIDADE ABSOLUTA sobre o texto impresso!
   - Se uma cidade, endereço, vazão, profundidade ou bomba impressa estiver riscada e houver um valor escrito à mão ao lado ou no topo (ex: "Sonora" escrito à mão substituindo "Guarantã do Norte", ou "8.000" substituindo "4000"), use o valor MANUSCRITO.
   - Se a Página 1 (frente da O.S.) e/ou a Página 3 (carimbo ANTES/DEPOIS) tiverem medições:
     * Preencha os campos "*Inicial" (nivelEstaticoInicial, nivelDinamicoInicial, vazaoInicial, crivoInicial, eletrodoSuperiorInicial, eletrodoInferiorInicial) com os valores ANTES da manutenção (coluna "ANTES" do carimbo na Página 3 ou os valores iniciais impressos na Página 1).
     * Preencha os campos principais/finais (nivelEstatico, nivelDinamico, vazaoTeste, crivo, eletrodoSuperior, eletrodoInferior) com os valores DEPOIS da manutenção (coluna "DEPOIS" do carimbo na Página 3 ou valor manuscrito final). Se só houver um valor medido, repita-o ou preencha no campo final.
2. FORMATAÇÃO DE UNIDADES:
   - Data de execução: converta a data manuscrita de execução/recebimento (da Página 2 ou 3, ex: "23/10/26", "16/10/26", "20/10/2026") para o formato ISO "YYYY-MM-DD" (ex: "2026-10-23"). Se não houver data manuscrita nas páginas 2/3, use a Dta. P/Execução da página 1.
   - Vazão: se estiver anotada como "2600", "4.100", "8.000" (litros/hora), formate de forma clara indicando em m³/h e L/h, ex: "2,60 m³/h (2.600 L/h)" ou "4,10 m³/h (4.100 L/h)".
   - Níveis e Profundidades (Prof., NE, ND, Crivo, El. Sup., El. Inf.): inclua a unidade "m" (ex: "200,00 m", "36,20 m", "116,80 m").
   - Diâmetro do Poço (Ø): ex: '6"' ou '4"'.
3. PRODUTOS E SERVIÇOS:
   - Liste todos os produtos de "Produtos a Serem Utilizados" com a quantidade planejada ou a anotação manuscrita da coluna "Usado" (ex: "10 litros", "10,00 KG").
   - Liste todos os "Serviços a Serem Executados", marcando como "Executado" aqueles que têm visto, "OK" ou marcação na coluna Executada.
4. EQUIPE:
   - Extraia o Líder (função: "Líder de Equipe / Sondador") e o Auxiliar (função: "Auxiliar Técnico de Campo") manuscritos na Página 2 (e/ou Equipe na Página 3).`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          numeroOS: {
            type: Type.STRING,
            description: 'Número da Ordem de Serviço (ex: 10260, 10235)',
          },
          contratoRef: {
            type: Type.STRING,
            description: 'Ano/Nº do Projeto ou Sub-Projeto ou Centro de Custo (ex: Projeto 2022 Nº 000001362 / Sub-Projeto MP00008979)',
          },
          tipoServico: {
            type: Type.STRING,
            description: 'Título/Análise do serviço (ex: MANUTENÇÃO PREVENTIVA - POÇO 03 - SEFAZ)',
          },
          cliente: {
            type: Type.STRING,
            description: 'Nome da Entidade / Cliente (ex: SECRETARIA DE ESTADO DE FAZENDA - SEFAZ)',
          },
          contatoLocal: {
            type: Type.STRING,
            description: 'Nome do contato na página 1 + Representante que assinou na página 2 (ex: SR. JOSÉ AUGUSTO / SR. PEDRO)',
          },
          telefoneContato: {
            type: Type.STRING,
            description: 'Telefone do contato (ex: (65) 9942-5998)',
          },
          localizacao: {
            type: Type.STRING,
            description: 'Endereço de execução da O.S. ou Logradouro (priorizando correção manuscrita se houver)',
          },
          cidadeUF: {
            type: Type.STRING,
            description: 'Cidade e UF onde o serviço foi executado (priorizando anotação manuscrita, ex: Cuiabá - MT, Sonora - MS/MT, Guarantã do Norte - MT)',
          },
          dataExecucaoISO: {
            type: Type.STRING,
            description: 'Data de execução no formato YYYY-MM-DD (priorizando a data manuscrita na página 2 ou 3)',
          },
          pocoTag: {
            type: Type.STRING,
            description: 'Identificação ou TAG do poço (ex: PT-03, PT-SONORA, PT-01)',
          },
          profundidadeTotal: {
            type: Type.STRING,
            description: 'Profundidade total do poço (ex: 200,00 m, 13,50 m)',
          },
          diametroRevestimento: {
            type: Type.STRING,
            description: 'Diâmetro do poço (ex: 6", 4 Polegadas)',
          },
          nivelEstaticoInicial: {
            type: Type.STRING,
            description: 'Nível Estático Inicial / ANTES da manutenção em metros (frente da O.S. ou coluna ANTES do carimbo)',
          },
          nivelEstatico: {
            type: Type.STRING,
            description: 'Nível Estático Final / DEPOIS da manutenção em metros (coluna DEPOIS do carimbo, ex: 36,20 m, 8,00 m)',
          },
          nivelDinamicoInicial: {
            type: Type.STRING,
            description: 'Nível Dinâmico Inicial / ANTES da manutenção em metros (frente da O.S. ou coluna ANTES do carimbo)',
          },
          nivelDinamico: {
            type: Type.STRING,
            description: 'Nível Dinâmico Final / DEPOIS da manutenção em metros (coluna DEPOIS do carimbo, ex: 116,80 m, 30,00 m)',
          },
          vazaoInicial: {
            type: Type.STRING,
            description: 'Vazão Inicial / ANTES da manutenção em m³/h e L/h (frente da O.S. ou coluna ANTES do carimbo)',
          },
          vazaoTeste: {
            type: Type.STRING,
            description: 'Vazão Final / DEPOIS da manutenção medida em m³/h e L/h (ex: 2,60 m³/h (2.600 L/h))',
          },
          crivoInicial: {
            type: Type.STRING,
            description: 'Posição do crivo Inicial / ANTES da manutenção em metros (ex: 180,00 m, 12,00 m)',
          },
          crivo: {
            type: Type.STRING,
            description: 'Posição do crivo Final / DEPOIS da manutenção em metros (ex: 180,00 m, 12,00 m)',
          },
          eletrodoSuperiorInicial: {
            type: Type.STRING,
            description: 'Eletrodo Superior Inicial / ANTES da manutenção (El. Sup. na frente da O.S. ou coluna ANTES)',
          },
          eletrodoSuperior: {
            type: Type.STRING,
            description: 'Eletrodo Superior Final / DEPOIS da manutenção (El. Sup. ou ES)',
          },
          eletrodoInferiorInicial: {
            type: Type.STRING,
            description: 'Eletrodo Inferior Inicial / ANTES da manutenção (El. Inf. na frente da O.S. ou coluna ANTES)',
          },
          eletrodoInferior: {
            type: Type.STRING,
            description: 'Eletrodo Inferior Final / DEPOIS da manutenção (El. Inf. ou EI)',
          },
          tuboEdutor: {
            type: Type.STRING,
            description: 'Tubo edutor ou galvanizado (ex: CRI 1 1/2", Geon DN 1 1/2", 1 1/4" Galv.)',
          },
          especificacaoBomba: {
            type: Type.STRING,
            description: 'Descrição da motobomba (incluindo marca/modelo anotado à mão, ex: Ebara, ESUB 4/9, 4BPS3F-11 1.5 HP)',
          },
          motobombaEstado: {
            type: Type.STRING,
            description: 'Estado da bomba: Usado ou Novo',
          },
          painelEletrico: {
            type: Type.STRING,
            description: 'Descrição do painel elétrico + tensão/amperagem/cabo anotados no verso (ex: Partida Direta | 220V | 11,4 A | Cabo 3x10 / 3x6)',
          },
          observacoesManuscritas: {
            type: Type.STRING,
            description: 'Observações manuscritas do campo "Obs:" da página 2 e anotações extras da ficha',
          },
          dadosCarimboVersoResumo: {
            type: Type.STRING,
            description: 'Resumo completo dos dados técnicos do carimbo da página 3 (Tensão, Amperagem, Cabo, Tubo de Nível, Aterramento, Cavalete, Antes/Depois)',
          },
          aterramentoStatus: {
            type: Type.STRING,
            description: 'Status do aterramento anotado no carimbo (ex: OK, Sim, Não, N/I)',
          },
          cavaleteStatus: {
            type: Type.STRING,
            description: 'Status do cavalete anotado no carimbo (ex: OK, Sim, Não, N/I)',
          },
          tuboNivelStatus: {
            type: Type.STRING,
            description: 'Tubo de nível anotado no carimbo (ex: Mangueira 3/4, Não, Sim)',
          },
          nomeRepresentanteCliente: {
            type: Type.STRING,
            description: 'Nome do cliente/representante que assinou na página 2',
          },
          equipe: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nome: { type: Type.STRING },
                funcao: { type: Type.STRING },
              },
            },
          },
          servicos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                descricao: { type: Type.STRING },
                unidade: {
                  type: Type.STRING,
                  description: 'Unidade de medida do serviço (ex: UN, SV, h, m, diária)',
                },
                quantidade: { type: Type.STRING },
                status: { type: Type.STRING },
              },
            },
          },
          materiais: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                descricao: { type: Type.STRING },
                unidade: { type: Type.STRING },
                quantidade: { type: Type.STRING },
                situacao: { type: Type.STRING },
              },
            },
          },
        },
      };

      // Utiliza modelos oficiais compatíveis com Free Tier do @google/genai
      let textResult = '';
      let ultimoErro: any = null;

      for (const modelo of MODELOS_GEMINI_GRATUITOS) {
        try {
          const response = await executarComRetryGemini(() =>
            ai.models.generateContent({
              model: modelo,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: `Extraia todos os dados impressos e manuscritos desta Ordem de Serviço de Campo (${nomeArquivo || 'documento'}) seguindo rigorosamente o schema JSON.`,
                  },
                ],
              },
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema,
              },
            })
          );

          textResult = (response.text ?? '').trim();
          if (textResult) {
            break;
          }
        } catch (err: any) {
          ultimoErro = err;
          continue;
        }
      }

      if (!textResult) {
        throw (
          ultimoErro ||
          new Error('Não foi possível obter resposta do extrator de documentos.')
        );
      }

      const parsed = JSON.parse(textResult);

      res.json({
        sucesso: true,
        dados: parsed,
      });
    } catch (error: any) {
      const erroFormatado = formatarErroGeminiParaCliente(
        error,
        'Erro ao processar o documento manuscrito. Tente novamente ou preencha manualmente.'
      );
      res.status(erroFormatado.status).json({
        error: erroFormatado.message,
      });
    }
  });

  // Endpoint de Auditoria Técnica Normativa (ABNT NBR 12.212 / NBR 12.244 / SEMA-MT) e Geração de Parecer Hidrogeológico
  app.post('/api/gerar-parecer-hidrogeologico', async (req, res) => {
    try {
      const payload = req.body || {};

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error:
            'Chave GEMINI_API_KEY não encontrada no servidor. Verifique o painel Settings > Secrets.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `Você é um Engenheiro Hidrogeólogo Sênior, especialista nas normas técnicas ABNT NBR 12.212 (Projeto de poço tubular para captação de água subterrânea) e ABNT NBR 12.244 (Construção de poço tubular para captação de água subterrânea), além de resoluções de órgãos gestores estaduais de recursos hídricos (ex.: SEMA-MT, SANEAGO/GO, ANA).

Sua tarefa é validar os dados de campo de manutenção preventiva em poço tubular profundo já outorgado, aplicar as regras de duração e estabilização do ensaio de vazão e estruturar o Relatório Técnico de Entrega de Serviços.

=== REGRAS DE DECISÃO DO TESTE DE VAZÃO ===
Analise a vazão de operação/teste (Q), o status da outorga e os dados de rebaixamento/nível dinâmico (ND) ao longo do tempo para classificar e justificar a duração do ensaio:

1. TESTE DE 12 HORAS (Manutenção Preventiva em Poço Outorgado)
   - Aplicação: Exclusivo para poços já outorgados, em serviço de manutenção preventiva/corretiva, com vazão de operação Q < 5,0 m³/h (5.000 L/h).
   - Condição obrigatória: Estabilização comprovada do Nível Dinâmico (ND) durante, no mínimo, as 6 horas finais do ensaio (variação <= 0,10 m/h ou critério específico do órgão gestor).
   - Ação em caso de falha: Se a variação do ND nas 6 h finais for > 0,10 m/h, emitir BLOQUEIO/ALERTA técnico recomendando o prolongamento imediato do ensaio para 24 horas.

2. TESTE DE 24 HORAS (Padrão Normativo NBR 12.244)
   - Aplicação: Regra geral da NBR 12.244; obrigatório quando Q >= 5,0 m³/h ou quando o ensaio de 12 h não atingir estabilização.
   - Condição obrigatória: Vazão constante e estabilização do ND nas 4 horas finais do ensaio.
   - Ação em caso de falha: Se não estabilizar em 24 h, recomendar redução de 20% na vazão de bombeamento e prolongamento por mais 12 h (totalizando 36 h) ou execução de ensaio de 48 h conforme exigência do órgão gestor.

3. TESTE DE 48 HORAS
   - Aplicação: Exigência expressa do órgão gestor local (ex.: SANEAGO/GO) ou ausência de estabilização após 24 h de bombeamento contínuo.
   - Condição obrigatória: Vazão constante e estabilização nas 6 horas finais.

4. TESTE DE 72 HORAS
   - Aplicação: Aquíferos de estabilização muito lenta (ex.: fraturados/cristalinos de baixa condutividade) ou exigência contratual/órgão gestor.
   - Distinção obrigatória: Diferencie explicitamente no texto se as 72 h referem-se ao ensaio hidrodinâmico de bombeamento ou apenas ao teste de operação contínua do conjunto motobomba instalado.

=== CORREÇÃO OBRIGATÓRIA: EQUAÇÃO DE JACOB-RORABAUGH ===
Na seção de interpretação hidrodinâmica/hidrogeológica, apresente a equação característica do poço de forma dimensionalmente rigorosa:
- Equação geral: s = B·Q + C·Q²
- Forma linearizada: s/Q = B + C·Q
- Unidades (SI/Hidrogeologia):
  * s = rebaixamento (m)
  * Q = vazão (m³/h ou m³/s)
  * B = coeficiente de perda laminar / formação (h/m² ou s/m²)
  * C = coeficiente de perda turbulenta / poço (h²/m⁵ ou s²/m⁵)
- PROIBIÇÃO ABSOLUTA: Nunca escreva s = B + C·Q.

=== TRAVAS DE CONSISTÊNCIA E AUDITORIA (BLOQUEIO) ===
Antes de liberar o relatório, audite os dados de entrada. Se detectar qualquer uma das falhas abaixo, defina statusAuditoria = "BLOQUEADO_INCONSISTENCIA" (ou "DADOS_INSUFICIENTES" se faltarem parâmetros obrigatórios), liste os erros em alertasBloqueio e NÃO invente dados faltantes:
1. Geometria incoerente: Profundidade da bomba > Profundidade total do poço, ou ND > Profundidade da bomba (bomba trabalhando a seco), ou ND < NE (nível dinâmico mais raso que o estático).
2. Divergência de duração: Título/cabeçalho indica uma duração (ex.: "12h") incompatível com a planilha de medições ou com Q >= 5 m³/h.
3. Teste de 12 h sem comprovação numérica de estabilização nas 6 horas finais.
4. Ensaio escalonado com etapas incompletas ou sem vazão/rebaixamento correspondente.
5. Contradição entre checklist de segurança e campo (ex.: Checklist "Aterramento: Conforme" vs. Carimbo de campo "Aterramento: Não").
6. Coordenadas geográficas/UTM incompatíveis com o Município/UF informado.
7. Vazão "Depois da manutenção" divergente da vazão recomendada sem justificativa técnica.
8. Ausência de parâmetros obrigatórios (NE, ND, Profundidade, Vazão ou Duração).`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          statusAuditoria: {
            type: Type.STRING,
            enum: ['APROVADO', 'BLOQUEADO_INCONSISTENCIA', 'DADOS_INSUFICIENTES'],
            description:
              'Bloqueia a emissão se houver incoerência geométrica, normativa ou falta de dados.',
          },
          alertasBloqueio: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Lista detalhada de inconsistências encontradas ou perguntas sobre dados ausentes antes de gerar o laudo.',
          },
          classificacaoEnsaio: {
            type: Type.OBJECT,
            properties: {
              duracaoSelecionadaHoras: { type: Type.NUMBER },
              enquadramentoNormativo: { type: Type.STRING },
              variacaoNDHorasFinais_m_h: { type: Type.NUMBER },
              estabilizacaoAtingida: { type: Type.BOOLEAN },
              justificativaTecnicaDuracao: { type: Type.STRING },
            },
            required: [
              'duracaoSelecionadaHoras',
              'enquadramentoNormativo',
              'estabilizacaoAtingida',
              'justificativaTecnicaDuracao',
            ],
          },
          relatorioSecoes: {
            type: Type.OBJECT,
            properties: {
              '1_identificacaoLocal': { type: Type.STRING },
              '2_dadosContratuaisRT': { type: Type.STRING },
              '3_geometriaConstrutivaPoco': { type: Type.STRING },
              '4_servicosManutencaoExecutados': { type: Type.STRING },
              '5_testeVazaoMetodologia': { type: Type.STRING },
              '6_interpretacaoHidrogeologicaJacobRorabaugh': {
                type: Type.STRING,
                description:
                  'Deve conter obrigatoriamente s = B·Q + C·Q² e s/Q = B + C·Q com unidades h/m² e h²/m⁵.',
              },
              '7_parecerVazaoRecomendada': { type: Type.STRING },
              '8_checklistConformidadeSeguranca': {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    status: {
                      type: Type.STRING,
                      enum: ['CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL'],
                    },
                    observacao: { type: Type.STRING },
                  },
                },
              },
              '9_listaAnexosObrigatorios': {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              '1_identificacaoLocal',
              '2_dadosContratuaisRT',
              '3_geometriaConstrutivaPoco',
              '4_servicosManutencaoExecutados',
              '5_testeVazaoMetodologia',
              '6_interpretacaoHidrogeologicaJacobRorabaugh',
              '7_parecerVazaoRecomendada',
              '8_checklistConformidadeSeguranca',
              '9_listaAnexosObrigatorios',
            ],
          },
        },
        required: [
          'statusAuditoria',
          'alertasBloqueio',
          'classificacaoEnsaio',
          'relatorioSecoes',
        ],
      };

      const userPrompt = `Analise os parâmetros técnicos abaixo referentes à manutenção preventiva de poço tubular profundo já outorgado e gere o Relatório Técnico conforme as instruções do sistema:

- Contratante / Órgão Gestor Local: ${payload.cliente || 'Não informado'} / ${payload.orgaoGestor || 'SEMA-MT'}
- Município / UF / Coordenadas UTM: ${payload.cidadeUF || 'Não informado'} / ${payload.coordenadas || 'Não informado'}
- Nº O.S. / Contrato / Responsável Técnico (CREA): ${payload.numeroOS || 'Não informado'} / ${payload.contrato || 'Não informado'} / ${payload.responsavelTecnico || 'José Roberto Ribeiro (CREA MT1561)'}
- Dados Construtivos: Poço ${payload.pocoTag || 'PT-01'} | Diâmetro ${payload.diametro || 'Não informado'} | Profundidade Total ${payload.profundidadeTotal || 'Não informado'} | Crivo/Filtros ${payload.crivo || 'Não informado'} | Tubo Edutor ${payload.tuboEdutor || 'Não informado'}
- Instalação Eletromecânica: Bomba ${payload.motobomba || 'Não informado'} instalada a ${payload.profundidadeBomba || 'Não informado'} | Painel ${payload.painel || 'Não informado'} | Aterramento: ${payload.aterramento || 'Não informado'} | Cavalete: ${payload.cavalete || 'Não informado'}
- Hidrodinâmica (Antes vs. Depois):
  * NE: ${payload.neAntes || 'Não informado'} -> ${payload.neDepois || 'Não informado'}
  * ND: ${payload.ndAntes || 'Não informado'} -> ${payload.ndDepois || 'Não informado'}
  * Vazão: ${payload.vazaoAntes || 'Não informado'} -> ${payload.vazaoDepois || 'Não informado'}
- Planilha do Teste de Bombeamento (Duração declarada: ${payload.duracaoTeste || '24'} h | Teste Ativo: ${payload.testeAtivo ? 'Sim' : 'Não'}):
  ${payload.dadosPlanilhaCampo || 'Sem planilha detalhada'}
- Serviços Executados e Materiais Aplicados:
  ${payload.listaServicosMateriais || 'Manutenção preventiva'}
- Observações e Anotações de Campo:
  ${payload.observacoesCampo || 'Sem observações adicionais'}
- Alertas já detectados pelo validador geométrico determinístico do sistema:
  ${
    payload.auditoriaLocalPrevia?.alertasBloqueio?.length > 0
      ? payload.auditoriaLocalPrevia.alertasBloqueio.join('\n  ')
      : 'Nenhum alerta determinístico prévio.'
  }`;

      let textResult = '';
      let ultimoErro: any = null;

      for (const modelo of MODELOS_GEMINI_GRATUITOS) {
        try {
          const response = await executarComRetryGemini(() =>
            ai.models.generateContent({
              model: modelo,
              contents: userPrompt,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
              },
            })
          );

          textResult = (response.text ?? '').trim();
          if (textResult) {
            break;
          }
        } catch (err: any) {
          ultimoErro = err;
          continue;
        }
      }

      if (!textResult) {
        throw (
          ultimoErro ||
          new Error('Não foi possível obter resposta do auditor hidrogeológico.')
        );
      }

      const parsed = JSON.parse(textResult);

      // Mescla eventuais alertas determinísticos obrigatórios para nunca deixar passar falha geométrica
      if (
        payload.auditoriaLocalPrevia?.alertasBloqueio?.length > 0 &&
        Array.isArray(parsed.alertasBloqueio)
      ) {
        const existentes = new Set(parsed.alertasBloqueio);
        for (const alerta of payload.auditoriaLocalPrevia.alertasBloqueio) {
          if (!existentes.has(alerta)) {
            parsed.alertasBloqueio.unshift(alerta);
          }
        }
        parsed.statusAuditoria = payload.auditoriaLocalPrevia.statusAuditoria;
      }

      res.json({
        sucesso: true,
        resultado: parsed,
      });
    } catch (error: any) {
      const erroFormatado = formatarErroGeminiParaCliente(
        error,
        'Erro ao executar a auditoria e geração do parecer hidrogeológico.'
      );
      res.status(erroFormatado.status).json({
        error: erroFormatado.message,
      });
    }
  });

  // Proxy de tiles OpenStreetMap / Esri Satélite para renderização sem CORS no PDF
  app.get('/api/osm-tile', async (req, res) => {
    try {
      const layer = String(req.query.layer ?? 'satellite');
      const z = parseInt(String(req.query.z ?? ''), 10);
      const x = parseInt(String(req.query.x ?? ''), 10);
      const y = parseInt(String(req.query.y ?? ''), 10);

      if (
        !Number.isInteger(z) ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        z < 0 ||
        z > 19 ||
        x < 0 ||
        y < 0
      ) {
        res.status(400).send('Invalid tile coordinates');
        return;
      }

      let tileUrl = '';
      if (layer === 'osm') {
        const sub = ['a', 'b', 'c'][(x + y) % 3];
        tileUrl = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
      } else if (layer === 'terrain') {
        const sub = ['a', 'b', 'c'][(x + y) % 3];
        tileUrl = `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`;
      } else if (layer === 'labels') {
        tileUrl = `https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;
      } else {
        tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      }

      const upstream = await fetch(tileUrl, {
        headers: {
          'User-Agent': 'RelatorPRO-Hidrogeologia/1.0 (https://vercel.app)',
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).send('Tile unavailable');
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error fetching tile');
    }
  });

  // Proxy da API Pública da ANA/SNIRH (Outorgas Estaduais Subterrâneas) para detecção de Aquífero / Formação Geológica
  app.get('/api/ana-aquifero', async (req, res) => {
    const SNIRH_URL =
      'https://portal1.snirh.gov.br/server/rest/services/Hosted/outorgas_estaduais_subterraneas/FeatureServer/0/query';
    const OUT_FIELDS = [
      'tap_ds',
      'ing_nm_municipio',
      'ing_sg_ufmunicipio',
      'int_nu_latitude',
      'int_nu_longitude',
      'asb_nu_profundidadefinal',
      'tst_nu_ne',
      'tst_nu_nd',
      'tst_vz_estabilizacao',
      'tnp_ds',
      'out_nu_ato',
    ].join(',');

    const removerAcentos = (texto: string) =>
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

    const sanitizarSql = (texto: string) =>
      texto
        .replace(/['";\\]/g, '')
        .replace(/--/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const paraNumero = (valor: unknown): number | null => {
      if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
      if (typeof valor === 'string' && valor.trim()) {
        const n = Number(valor.replace(',', '.'));
        if (Number.isFinite(n)) return n;
      }
      return null;
    };

    const isEspecifico = (nome: string): boolean => {
      const norm = removerAcentos(nome);
      if (!norm) return false;
      return ![
        'OUTRO',
        'OUTROS',
        'NAO INFORMADO',
        'SEM INFORMACAO',
        'INDEFINIDO',
        'DESCONHECIDO',
        'N/A',
        '-',
      ].includes(norm);
    };

    const consultarSnirh = async (params: Record<string, string>) => {
      const qs = new URLSearchParams({
        outFields: OUT_FIELDS,
        outSR: '4326',
        resultRecordCount: '150',
        f: 'json',
        ...params,
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const resp = await fetch(`${SNIRH_URL}?${qs.toString()}`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'RelatorPRO-Hidrogeologia/1.0',
          },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ao consultar API ANA/SNIRH`);
        }
        const data: any = await resp.json();
        if (data?.error) {
          throw new Error(
            data.error?.message || 'Erro retornado pelo serviço ArcGIS ANA/SNIRH'
          );
        }
        const features = Array.isArray(data?.features) ? data.features : [];
        return features.map((f: any) => {
          const a = f?.attributes || {};
          const g = f?.geometry || {};
          return {
            aquifero: typeof a.tap_ds === 'string' ? a.tap_ds.trim() : '',
            municipio:
              typeof a.ing_nm_municipio === 'string'
                ? a.ing_nm_municipio.trim()
                : '',
            uf:
              typeof a.ing_sg_ufmunicipio === 'string'
                ? a.ing_sg_ufmunicipio.trim().toUpperCase()
                : '',
            lat: paraNumero(a.int_nu_latitude) ?? paraNumero(g.y),
            lng: paraNumero(a.int_nu_longitude) ?? paraNumero(g.x),
            profundidadeM: paraNumero(a.asb_nu_profundidadefinal),
            neM: paraNumero(a.tst_nu_ne),
            ndM: paraNumero(a.tst_nu_nd),
            vazaoM3h: paraNumero(a.tst_vz_estabilizacao),
            tipoPoco: typeof a.tnp_ds === 'string' ? a.tnp_ds.trim() : '',
            numeroOutorga:
              typeof a.out_nu_ato === 'string' ? a.out_nu_ato.trim() : '',
          };
        });
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const latRaw = String(req.query.lat ?? '').trim();
      const lngRaw = String(req.query.lng ?? '').trim();
      const municipioRaw = String(req.query.municipio ?? '').trim();
      const ufRaw = String(req.query.uf ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2);

      const lat = latRaw ? Number(latRaw) : NaN;
      const lng = lngRaw ? Number(lngRaw) : NaN;
      const temCoordenadas =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001);

      const municipioLimpo = sanitizarSql(municipioRaw);

      if (!temCoordenadas && !municipioLimpo && !ufRaw) {
        res.status(400).json({
          sucesso: false,
          modoBusca: 'nenhum',
          raioKm: null,
          totalEncontrados: 0,
          pocos: [],
          aviso:
            'Informe Coordenadas (Lat/Long ou UTM) ou Município/UF para consultar os poços da ANA/SNIRH.',
        });
        return;
      }

      if (temCoordenadas) {
        const raios = [5, 15, 35];
        let melhorLista: any[] = [];
        let melhorRaio = 5;

        for (const raioKm of raios) {
          const encontrados = await consultarSnirh({
            where: '1=1',
            geometry: `${lng},${lat}`,
            geometryType: 'esriGeometryPoint',
            inSR: '4326',
            spatialRel: 'esriSpatialRelIntersects',
            distance: String(raioKm),
            units: 'esriSRUnit_Kilometer',
          });

          if (encontrados.length > melhorLista.length) {
            melhorLista = encontrados;
            melhorRaio = raioKm;
          }

          const especificos = encontrados.filter((p: any) =>
            isEspecifico(p.aquifero)
          );
          if (especificos.length >= 3) {
            melhorLista = encontrados;
            melhorRaio = raioKm;
            break;
          }
        }

        if (melhorLista.length > 0) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.status(200).json({
            sucesso: true,
            modoBusca: 'coordenadas',
            raioKm: melhorRaio,
            totalEncontrados: melhorLista.length,
            pocos: melhorLista,
          });
          return;
        }
      }

      if (municipioLimpo || ufRaw) {
        let pocosMunicipio: any[] = [];

        if (municipioLimpo) {
          const munUpper = municipioLimpo.toUpperCase();
          const filtroUf = ufRaw ? `ing_sg_ufmunicipio = '${ufRaw}' AND ` : '';

          pocosMunicipio = await consultarSnirh({
            where: `${filtroUf}UPPER(ing_nm_municipio) LIKE '%${munUpper}%'`,
          });

          if (pocosMunicipio.length === 0 && munUpper.length >= 3) {
            const munSemAcento = removerAcentos(munUpper);
            const padraoWildcard = munSemAcento.replace(/[AEIOUC]/g, '_');
            const candidatos = await consultarSnirh({
              where: `${filtroUf}UPPER(ing_nm_municipio) LIKE '%${padraoWildcard}%'`,
            });
            pocosMunicipio = candidatos.filter((p: any) =>
              removerAcentos(p.municipio).includes(munSemAcento)
            );
          }
        } else if (ufRaw) {
          pocosMunicipio = await consultarSnirh({
            where: `ing_sg_ufmunicipio = '${ufRaw}' AND tap_ds IS NOT NULL`,
          });
        }

        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).json({
          sucesso: true,
          modoBusca: 'municipio',
          raioKm: null,
          totalEncontrados: pocosMunicipio.length,
          pocos: pocosMunicipio,
          ...(pocosMunicipio.length === 0
            ? {
                aviso:
                  'Nenhum poço outorgado encontrado na base da ANA/SNIRH para esta região.',
              }
            : {}),
        });
        return;
      }

      res.status(200).json({
        sucesso: true,
        modoBusca: temCoordenadas ? 'coordenadas' : 'municipio',
        raioKm: temCoordenadas ? 35 : null,
        totalEncontrados: 0,
        pocos: [],
        aviso:
          'Nenhum poço encontrado na base da ANA/SNIRH num raio de até 35 km.',
      });
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      res.status(502).json({
        sucesso: false,
        modoBusca: 'erro',
        raioKm: null,
        totalEncontrados: 0,
        pocos: [],
        aviso: isTimeout
          ? 'A API pública da ANA/SNIRH demorou mais de 10 segundos para responder.'
          : err?.message || 'Erro ao consultar o serviço da ANA/SNIRH.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor RelatorPRO rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();

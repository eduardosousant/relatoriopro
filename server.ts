import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
   - Se a Página 3 (carimbo ANTES/DEPOIS) tiver medições preenchidas à mão (Vazão, NE, ND, Bomba, Painel, Edutor, Diâmetro do Poço, Amperagem, Tensão, Cabo), utilize os valores da coluna "DEPOIS" (ou o valor manuscrito da página 3) como os dados operacionais finais do poço, e registre também o comparativo na síntese técnica.
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
          nivelEstatico: {
            type: Type.STRING,
            description: 'Nível Estático (NE) em metros (ex: 36,20 m, 8,00 m, 4,50 m)',
          },
          nivelDinamico: {
            type: Type.STRING,
            description: 'Nível Dinâmico (ND) em metros (ex: 116,80 m, 30,00 m, 6,40 m)',
          },
          vazaoTeste: {
            type: Type.STRING,
            description: 'Vazão medida em m³/h e L/h (ex: 2,60 m³/h (2.600 L/h))',
          },
          crivo: {
            type: Type.STRING,
            description: 'Posição do crivo em metros (ex: 180,00 m, 12,00 m)',
          },
          eletrodoSuperior: {
            type: Type.STRING,
            description: 'Eletrodo Superior (El. Sup. ou ES) (ex: 3,00 m)',
          },
          eletrodoInferior: {
            type: Type.STRING,
            description: 'Eletrodo Inferior (El. Inf. ou EI) (ex: 11,50 m)',
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

      // Prioriza baixa latência (ThinkingLevel.LOW no 3.8-flash e 3.1-flash-lite ultra-rápido)
      const modelosDisponiveis = [
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
      ];

      let textResult = '';
      let ultimoErro: any = null;

      for (const modelo of modelosDisponiveis) {
        try {
          const response = await ai.models.generateContent({
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
              ...(modelo === 'gemini-3.8-flash'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

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
      res.status(500).json({
        error:
          error?.message ||
          'Erro ao processar o documento manuscrito. Tente novamente.',
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

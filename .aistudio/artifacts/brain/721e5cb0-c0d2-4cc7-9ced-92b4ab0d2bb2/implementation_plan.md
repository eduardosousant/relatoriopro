# RelatorPRO — Sistema Operacional de Relatórios Técnicos de Campo

Plataforma web offline-first projetada para engenheiros, hidrogeólogos e equipes técnicas de campo emitirem relatórios executivos de perfuração de poços artesianos, sondagens e obras civis, com recorte fotográfico 1:1, coleta de assinaturas em tela, persistência local em IndexedDB e geração de PDF A4 padronizado.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo consolidam suas escolhas confirmadas e definem o escopo completo para implementação:

- **Recursos Complementares Confirmados**:
  - **Upload de Logotipo da Empresa**: Suporte para anexar e persistir o logotipo institucional no cabeçalho do relatório e no PDF exportado.
  - **Parâmetros Técnicos de Poços Artesianos e Bombas**: Seção dedicada para registrar Profundidade Total (m), Nível Estático - NE (m), Nível Dinâmico - ND (m), Vazão de Teste (m³/h), Modelo/Potência da Bomba Submersa e Diâmetro de Revestimento.
  - **Templates Rápidos de Descrição de Serviço**: Botões de preenchimento inteligente para cenários recorrentes (Perfuração de Poço Tubular, Teste de Bombeamento e Vazão, Instalação/Manutenção de Conjunto Moto-Bomba, Sondagem SPT e Vistoria de Obra Civil).
- **Motor de Exportação PDF Confirmado**: Geração direta e download imediato do arquivo `.pdf` em formato A4 via **jsPDF**, desenhado programaticamente com precisão milimétrica (fotos 70 mm × 70 mm em 2 colunas, caixas técnicas com bordas sutis, assinaturas lado a lado e paginação automática).
- **Identidade Visual Confirmada**: Alternância fluida entre **Modo Claro (Alto Contraste Solar)** para operação em campo e **Modo Escuro Industrial** para ambientes internos ou noturnos.

---

## 1. Overview & Core Concept

- **O Que Faz**: Permite criar, salvar automaticamente em banco local (sem depender de internet em locais remotos), anexar fotos com corte quadrado 1:1 otimizado (800×800 px), coletar assinaturas manuscritas do responsável técnico e do cliente/fiscal na tela, visualizar a folha A4 em tempo real e baixar o PDF técnico finalizado.
- **Público-Alvo / Persona**: Engenheiros civis, geólogos, técnicos de perfuração de poços tubulares profundos e supervisores de obras que atuam em canteiros remotos usando smartphones, tablets ou notebooks.
- **Valor Principal**: Elimina o retrabalho de escritório pós-campo — o relatório sai assinado, diagramado e pronto em PDF diretamente do local da obra, mesmo sem conexão de rede.

---

## 2. User Experience & Visual Design

- **Fluxo Principal do Usuário**:
  1. **Painel Lateral / Gaveta de Relatórios (IndexedDB)**: O usuário visualiza relatórios salvos localmente (filtráveis por busca textual ou status `rascunho`, `finalizado`, `exportado`), cria um novo relatório ou carrega um documento de exemplo pré-preenchido para inspeção imediata.
  2. **Cabeçalho, Logotipo & Metadados da O.S.**: Preenchimento validado de Razão Social, CNPJ (com formatação automática), Logotipo da empresa, Cliente, Contrato/O.S., Localização/Coordenadas e Data de Execução.
  3. **Dados Técnicos de Poços Tubulares & Bombas**: Painel técnico estruturado com campos numéricos tabulares (Profundidade, Nível Estático, Nível Dinâmico, Vazão, Crivo/Revestimento e Especificação da Bomba).
  4. **Detalhamento Técnico & Templates Rápidos**: Seletor de modelos técnicos que insere estruturas de texto padronizadas no editor expansível de atividades executadas e observações.
  5. **Registro Fotográfico & Modal de Corte 1:1**: Seleção de múltiplas imagens (arquivo ou câmera mobile) que abre uma fila de recorte interativo 1:1 com controle de zoom, arraste (pan) por toque/mouse e compressão em Canvas HTML5 para JPEG 800×800 px. Na grade, cada foto possui edição inline de legenda técnica, reordenação (subir/descer) e exclusão.
  6. **Coleta de Assinaturas Digitais**: Dois blocos dedicados (**Responsável Técnico / Executor** com CPF ou CREA/CAU e **Cliente / Fiscal da Obra**), cada um com Canvas HTML5 de alta precisão (`PointerEvents` / `TouchEvents`), botões de limpar e confirmar, e carimbo automático de data/hora.
  7. **Pré-Visualização A4 Fiel & Download PDF (jsPDF)**: Alternância entre modo de Edição e Pré-Visualização A4 em escala real, com botão de ação principal para gerar e baixar o arquivo PDF executivo.

- **Visual Identity & Theme**:
  - *Direção Estética*: Utilitário Corporativo de Engenharia — superfícies planas de elevação única, divisórias de 1px precisas, ausência de elementos decorativos supérfluos e foco em legibilidade técnica.
  - *Paleta de Cores (Regra 60-30-10)*:
    - **Modo Claro (60% Canvas / 30% Superfície)**: Fundo principal em `#F8FAFC` (`slate-50`), painéis de formulário em `#FFFFFF` com bordas `#E2E8F0` (`slate-200`), texto principal em `#0F172A` (`slate-900`).
    - **Modo Escuro (60% Canvas / 30% Superfície)**: Fundo principal em `#0B0F17` (`slate-950`), painéis em `#111827` (`slate-900`) com bordas `#1E293B` (`slate-800`), texto principal em `#F8FAFC` (`slate-50`).
    - **Acento Técnico (10%)**: Azul Engenharia `#0284C7` (`sky-600` / `sky-500`) para ações primárias e estados ativos; Âmbar `#D97706` para status de rascunho; Verde Esmeralda `#16A34A` para relatórios finalizados/assinados; Vermelho `#DC2626` para alertas de validação.
  - *Tipografia & Hierarquia (Regra 2+1 Fontes)*:
    - **Display & Títulos**: `Plus Jakarta Sans` (SemiBold/Bold 600–700) para cabeçalhos institucionais e navegação.
    - **Corpo & Formulários**: `Public Sans` (Regular/Medium 400–500) para máxima clareza em rótulos e textos técnicos.
    - **Dados Numéricos & Códigos**: `JetBrains Mono` com `tabular-nums` para CNPJ, número de O.S., parâmetros de vazão/nível e timestamps.
  - *Layout & Composição Espacial*:
    - Barra superior seguindo o contrato de 3 zonas em linha única: Marca `RelatorPRO` à esquerda, links de navegação/modo ao centro (`Editor de Campo`, `Pré-Visualização A4`, `Meus Relatórios`) e ação primária (`Baixar PDF A4`) + seletor de tema à direita.
    - Desktop (1440 px): Layout de 2 colunas com barra lateral de rascunhos/histórico (`280px`) e área de trabalho principal ampla. Em dispositivos móveis, a barra lateral converte-se em gaveta deslizante acessível com alvos de toque de no mínimo `44px`.

- **Feedback Interativo & Estados**:
  - Indicador discreto de salvamento automático em texto limpo (`Salvo localmente às HH:MM:SS`) sempre que qualquer campo ou foto é modificado.
  - Tratamento de erros de armazenamento (ex.: cota de IndexedDB ou arquivo corrompido) com mensagens claras em banner contextual.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Geração Programática de PDF A4 com `jsPDF`**
  - *Abordagem Escolhida*: Construção vetorial direta do documento A4 (`210 mm × 297 mm`) usando a API nativa do `jsPDF`, combinada com um espelho visual A4 na tela de pré-visualização.
  - *Por Quê*: Garante que as fotos fiquem exatamente na escala de `70 mm × 70 mm` em 2 colunas, com bordas vetoriais nítidas, textos selecionáveis (não borrados como capturas de tela HTML) e quebra de página exata em qualquer smartphone ou desktop.
  - *Alternativas Consideradas*: Captura de DOM via `html2canvas` (descartada por gerar arquivos pesados e perder nitidez tipográfica em dispositivos móveis).

- **Decisão 2: Editor de Recorte 1:1 e Compressão Nativa em Canvas HTML5**
  - *Abordagem Escolhida*: Processamento em memória via `HTMLCanvasElement` renderizando um quadrado de `800×800 px` exportado com `canvas.toDataURL('image/jpeg', 0.82)`.
  - *Por Quê*: Fotos originais de smartphones modernos (4000×3000 px, 5–10 MB cada) estourariam rapidamente o armazenamento offline e deixariam o PDF lento. A normalização para 800×800 px JPEG mantém excelente nitidez para impressão de 70×70 mm (~290 DPI reais) reduzindo cada imagem para ~80–140 KB.

- **Decisão 3: Persistência Offline-First em IndexedDB Puro com Auto-Save**
  - *Abordagem Escolhida*: Wrapper assíncrono em TypeScript estrito sobre a API nativa `window.indexedDB` (`RelatorPRO_DB`, objectStore `relatorios` com `keyPath: 'uuid'` e índices para `atualizadoEm` e `status`).
  - *Por Quê*: Ao contrário do `localStorage` (limitado a ~5 MB), o `IndexedDB` suporta dezenas de relatórios ricos em imagens Base64 e assinaturas sem bloqueio da thread principal.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Diagrama de Arquitetura e Componentes

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         RelatorPRO Application Shell                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐  ┌───────────────────┐  │
│  │  Top Bar (3-Zone)   │  │ Theme Controller        │  │ Auto-Save Engine  │  │
│  │  Brand · Nav · PDF  │  │ (.dark + localStorage)  │  │ (Debounced 600ms) │  │
│  └──────────┬──────────┘  └────────────┬────────────┘  └─────────┬─────────┘  │
└─────────────┼──────────────────────────┼─────────────────────────┼────────────┘
              │                          │                         │
      ┌───────┴──────────────────────────┴─────────────────────────┴───────┐
      ▼                                                                    ▼
┌───────────────────────────────┐                  ┌────────────────────────────┐
│   Sidebar / Drawer Manager    │                  │   IndexedDB Pure Wrapper   │
│  - Lista de Relatórios        │◄────────────────►│  DB: RelatorPRO_DB (v1)    │
│  - Busca e Filtro por Status  │   CRUD Promises  │  Store: relatorios (uuid)  │
│  - Novo / Duplicar / Excluir  │                  │  Store: config (logo pad.) │
└───────────────┬───────────────┘                  └────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      Active Workspace Viewport (Tabs)                         │
│                                                                               │
│  ┌────────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │      1. Editor Operacional         │  │   2. Pré-Visualização A4 & PDF  │  │
│  │                                    │  │                                 │  │
│  │  ├─ Cabeçalho + Upload de Logo     │  │  ├─ Espelho A4 Fiel (210x297mm) │  │
│  │  ├─ Dados de Poço Tubular & Bomba  │  │  │   ├─ Cabeçalho Institucional │  │
│  │  ├─ Descrição + Templates Rápidos  │  │  │   ├─ Grid Metadados & Poço   │  │
│  │  ├─ Galeria Fotográfica 2 Colunas  │  │  │   ├─ Fotos 2 Col (70x70mm)   │  │
│  │  │   ├─ Modal Crop 1:1 (800x800px) │  │  │   └─ Assinaturas Lado a Lado │  │
│  │  │   └─ Legenda Inline & Ordem     │  │  │                              │  │
│  │  └─ Pads de Assinatura (Canvas)    │  │  └─ Motor jsPDF Export (.pdf)   │  │
│  │      ├─ Responsável (CREA/CPF)     │  │      └─ Paginação Automática    │  │
│  │      └─ Cliente / Fiscal da Obra   │  │                                 │  │
│  └────────────────────────────────────┘  └─────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Dados & Tipagem Estrita

A aplicação respeita integralmente as interfaces obrigatórias (`FotoRegistro`, `AssinaturaDigital`, `DadosCabecalho`, `RelatorioTecnico`) e estende de forma retrocompatível os metadados solicitados nas respostas de planejamento:

- **`DadosCabecalho`**: Mantém `razaoSocial`, `cnpj`, `cliente`, `contratoOS`, `localizacao`, `dataExecucao` e inclui `logoBase64?: string` para o logotipo personalizado da empresa.
- **`DadosPocoArtesiano` (Opcional integrado a `RelatorioTecnico`)**: Contém `incluirNoRelatorio: boolean`, `profundidadeTotal: string`, `nivelEstatico: string`, `nivelDinamico: string`, `vazaoTeste: string`, `diametroRevestimento: string` e `especificacaoBomba: string`.
- **`RelatorioTecnico`**: Preserva todos os campos exigidos (`id`, `uuid`, `status`, `cabecalho`, `descricaoServico`, `fotos`, `assinaturaResponsavel`, `assinaturaCliente`, `criadoEm`, `atualizadoEm`) adicionando o bloco opcional `dadosPoco?: DadosPocoArtesiano`.

### Mapeamento Interativo de Componentes e Estados

| Fluxo / Componente | Interação do Usuário | Mutação de Estado & Validação |
| :--- | :--- | :--- |
| **Gerenciador IndexedDB** | Criar novo, selecionar rascunho, filtrar por status/cliente ou excluir com confirmação inline. | Carrega o objeto `RelatorioTecnico` ativo; o hook de auto-save persiste alterações após `600ms` e atualiza `atualizadoEm`. |
| **Cabeçalho & Logo** | Digitação de CNPJ/O.S. e seleção de imagem de logotipo. | Formata máscara de CNPJ (`00.000.000/0000-00`), redimensiona o logo em Canvas para caber proporcionalmente no cabeçalho e salva como padrão reutilizável. |
| **Crop Fotográfico 1:1** | Upload de 1 ou mais fotos → ajuste de zoom (`1x` a `3x`) e posição `(offsetX, offsetY)` via arraste. | Renderiza o recorte no Canvas `800×800 px`, extrai `image/jpeg` Base64, anexa ao array `fotos` com `ordem` sequencial e avança para a próxima foto da fila. |
| **Galeria Fotográfica** | Editar legenda inline, mover foto para cima/baixo ou remover item. | Atualiza `legenda` em tempo real; recalcula o índice `ordem` de cada `FotoRegistro` ao reordenar ou excluir. |
| **Pad de Assinatura** | Desenho com dedo/stylus/mouse no Canvas, preenchimento de nome, CREA/CPF e função, clique em "Confirmar Assinatura". | Valida que o Canvas não está em branco e que o nome foi informado; exporta PNG transparente (`dataUrl`) e grava `dataRegistro` formatada. |
| **Exportador jsPDF** | Clique em "Baixar PDF A4". | Valida campos essenciais, desenha cabeçalho institucional, tabela técnica, grade de fotos `70 mm × 70 mm` em 2 colunas com caixas de legenda e rodapé de assinaturas, dispara o download do arquivo `.pdf` e atualiza `status` para `'exportado'`. |

-- ==============================================================================
-- SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS SUPABASE (PostgreSQL 15+)
-- Sistema de Gestão de Poços Tubulares, Testes de Bombeamento e Laudos Técnicos ABNT
-- ==============================================================================
-- Copie e cole este script no SQL Editor do seu projeto Supabase (https://supabase.com)
-- e clique em "RUN".
-- ==============================================================================

-- 1. Habilitar extensão para geração de UUID caso necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABELA: CADASTRO MESTRE DE POÇOS TUBULARES (pocos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pocos (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag VARCHAR(100) NOT NULL,
    nome_identificacao VARCHAR(255) NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    cliente_cnpj VARCHAR(50),
    endereco_local TEXT,
    cidade_uf VARCHAR(100),
    coordenadas_utm VARCHAR(100),
    contato_local VARCHAR(150),
    telefone_contato VARCHAR(50),
    profundidade_total VARCHAR(50),
    diametro_revestimento VARCHAR(100),
    data_perfuracao VARCHAR(50),
    numero_outorga VARCHAR(100),
    aquifero_litologia TEXT,
    crivo_padrao TEXT,
    tubo_edutor_padrao TEXT,
    eletrodo_superior_padrao TEXT,
    eletrodo_inferior_padrao TEXT,
    bomba_atual TEXT,
    painel_atual TEXT,
    observacoes_tecnicas TEXT,
    criado_em BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    atualizado_em BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Índices para buscas rápidas por TAG e Cliente
CREATE INDEX IF NOT EXISTS idx_pocos_tag ON public.pocos (tag);
CREATE INDEX IF NOT EXISTS idx_pocos_cliente ON public.pocos (cliente);

-- ==============================================================================
-- 3. TABELA: RELATÓRIOS TÉCNICOS E LAUDOS DE CAMPO (relatorios)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.relatorios (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poco_uuid UUID REFERENCES public.pocos(uuid) ON DELETE SET NULL,
    contrato_os VARCHAR(100),
    cliente VARCHAR(255),
    status VARCHAR(50) DEFAULT 'rascunho',
    data_execucao VARCHAR(50),
    
    -- Dados completos normalizados em JSONB de alta performance
    cabecalho JSONB NOT NULL DEFAULT '{}'::jsonb,
    dados_poco JSONB NOT NULL DEFAULT '{}'::jsonb,
    descricao_servico TEXT DEFAULT '',
    equipe JSONB NOT NULL DEFAULT '[]'::jsonb,
    servicos_conduzidos JSONB NOT NULL DEFAULT '[]'::jsonb,
    materiais_aplicados JSONB NOT NULL DEFAULT '[]'::jsonb,
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    ocorrencias_campo JSONB NOT NULL DEFAULT '{}'::jsonb,
    fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
    assinatura_responsavel JSONB,
    assinatura_cliente JSONB,
    
    criado_em BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    atualizado_em BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Índices de consulta rápida de relatórios
CREATE INDEX IF NOT EXISTS idx_relatorios_contrato_os ON public.relatorios (contrato_os);
CREATE INDEX IF NOT EXISTS idx_relatorios_poco_uuid ON public.relatorios (poco_uuid);
CREATE INDEX IF NOT EXISTS idx_relatorios_status ON public.relatorios (status);
CREATE INDEX IF NOT EXISTS idx_relatorios_atualizado_em ON public.relatorios (atualizado_em DESC);

-- ==============================================================================
-- 4. POLÍTICAS DE ACESSO (Row Level Security - RLS)
-- ==============================================================================
-- Por padrão, ativamos RLS com acesso irrestrito para anon (ou autenticado).
-- Você pode depois restringir por user_id caso ative login com Supabase Auth.
ALTER TABLE public.pocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;

-- Políticas para acesso anônimo com a chave pública VITE_SUPABASE_ANON_KEY
DROP POLICY IF EXISTS "Acesso total aos pocos" ON public.pocos;
CREATE POLICY "Acesso total aos pocos" ON public.pocos
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total aos relatorios" ON public.relatorios;
CREATE POLICY "Acesso total aos relatorios" ON public.relatorios
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 5. BUCKET DE STORAGE: EVIDÊNCIAS DE CAMPO E LOGOMARCAS (evidencias-campo)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias-campo', 'evidencias-campo', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública para o bucket de fotos
DROP POLICY IF EXISTS "Leitura publica de evidencias" ON storage.objects;
CREATE POLICY "Leitura publica de evidencias" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'evidencias-campo');

-- Política de upload para o bucket
DROP POLICY IF EXISTS "Upload livre de evidencias" ON storage.objects;
CREATE POLICY "Upload livre de evidencias" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'evidencias-campo');

DROP POLICY IF EXISTS "Atualizacao livre de evidencias" ON storage.objects;
CREATE POLICY "Atualizacao livre de evidencias" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'evidencias-campo');

DROP POLICY IF EXISTS "Exclusao livre de evidencias" ON storage.objects;
CREATE POLICY "Exclusao livre de evidencias" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'evidencias-campo');

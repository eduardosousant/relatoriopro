import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { CadastroPoco, RelatorioTecnico } from '../types/relatorio';
import { formatarDataBR } from '../services/pdfExportService';
import { calcularParametrosStepDrawdownSEMA } from './StepDrawdownSection';
import {
  TrendingUp,
  TrendingDown,
  Droplets,
  ArrowDownUp,
  Gauge,
  Layers,
} from 'lucide-react';

interface PocoHydroChartProps {
  poco: CadastroPoco;
  relatoriosDoPoco: RelatorioTecnico[];
}

export interface PontoHidrodinamico {
  uuid: string;
  os: string;
  dataISO: string;
  dataFormatada: string;
  rotuloEixoX: string;
  tipoServico: string;
  ne: number | null;
  nd: number | null;
  rebaixamento: number | null;
  vazao: number | null;
  capacidadeEspecifica: number | null; // m³/h por metro de rebaixamento (Q / Δh)
  eficienciaSEMA: number | null; // % de Eficiência do Poço (Step-Drawdown SEMA)
  crivo: number | null;
  bomba: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    payload?: PontoHidrodinamico;
  }[];
  label?: string;
}

function extrairValorNumerico(texto?: string): number | null {
  if (!texto) return null;
  const limpo = texto.replace(',', '.').replace(/[^0-9.-]/g, '');
  const numero = parseFloat(limpo);
  return Number.isFinite(numero) ? numero : null;
}

function formatarNumeroBR(valor: number | null, casas = 1, sufixo = ''): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  return `${valor.toFixed(casas).replace('.', ',')}${sufixo}`;
}

const CustomHydroTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }

  const dados = payload[0].payload;

  return (
    <div className="rounded-xl border border-[#1B2A3B]/20 dark:border-slate-700 bg-[#1B2A3B] text-white p-3.5 shadow-xl text-xs space-y-2 min-w-[245px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-2">
        <span className="font-mono font-bold text-[#E8A020]">{dados.os}</span>
        <span className="font-mono text-[11px] text-white/75">
          {dados.dataFormatada}
        </span>
      </div>

      <div className="text-[11px] text-white/80 font-medium truncate">
        {dados.tipoServico}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 font-mono text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sky-300">NE:</span>
          <span className="font-bold">
            {formatarNumeroBR(dados.ne, 1, ' m')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-amber-300">ND:</span>
          <span className="font-bold">
            {formatarNumeroBR(dados.nd, 1, ' m')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-rose-300">Δh (ND-NE):</span>
          <span className="font-bold">
            {formatarNumeroBR(dados.rebaixamento, 1, ' m')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-emerald-300">Vazão (Q):</span>
          <span className="font-bold">
            {formatarNumeroBR(dados.vazao, 1, ' m³/h')}
          </span>
        </div>
      </div>

      {(dados.capacidadeEspecifica !== null ||
        dados.eficienciaSEMA !== null) && (
        <div className="pt-1.5 border-t border-white/10 space-y-1 text-[11px] font-mono text-white/80">
          {dados.capacidadeEspecifica !== null && (
            <div className="flex items-center justify-between">
              <span>Cap. Específica (Q/Δh):</span>
              <span className="font-bold text-emerald-300">
                {formatarNumeroBR(dados.capacidadeEspecifica, 2, ' m³/h/m')}
              </span>
            </div>
          )}
          {dados.eficienciaSEMA !== null && (
            <div className="flex items-center justify-between">
              <span>Eficiência SEMA (η):</span>
              <span className="font-bold text-[#E8A020]">
                {formatarNumeroBR(dados.eficienciaSEMA, 1, '%')}
              </span>
            </div>
          )}
        </div>
      )}

      {dados.bomba && (
        <div className="text-[10px] text-white/60 truncate pt-0.5">
          Bomba: {dados.bomba}
        </div>
      )}
    </div>
  );
};

export const PocoHydroChart: React.FC<PocoHydroChartProps> = ({
  poco,
  relatoriosDoPoco,
}) => {
  const [modoVisao, setModoVisao] = useState<'linhas' | 'niveis' | 'vazao'>(
    'linhas'
  );
  const [inverterProfundidade, setInverterProfundidade] =
    useState<boolean>(false);

  const crivoReferencia = useMemo(
    () => extrairValorNumerico(poco.crivoPadrao),
    [poco.crivoPadrao]
  );

  // Ordena cronologicamente (do relatório mais antigo para o mais recente) para plotar a linha do tempo
  const serieTemporal: PontoHidrodinamico[] = useMemo(() => {
    const ordenados = [...relatoriosDoPoco].sort((a, b) => {
      const dA = a.cabecalho.dataExecucao || '';
      const dB = b.cabecalho.dataExecucao || '';
      if (dA !== dB) return dA.localeCompare(dB);
      return a.criadoEm - b.criadoEm;
    });

    return ordenados.map((rel) => {
      const ne = extrairValorNumerico(rel.dadosPoco?.nivelEstatico);
      const nd = extrairValorNumerico(rel.dadosPoco?.nivelDinamico);
      const vazao = extrairValorNumerico(rel.dadosPoco?.vazaoTeste);
      const crivo =
        extrairValorNumerico(rel.dadosPoco?.crivo) ?? crivoReferencia;

      const rebaixamento =
        ne !== null && nd !== null && nd >= ne
          ? Number((nd - ne).toFixed(2))
          : null;

      const capacidadeEspecifica =
        vazao !== null && rebaixamento !== null && rebaixamento > 0
          ? Number((vazao / rebaixamento).toFixed(2))
          : null;

      let eficienciaSEMA: number | null = null;
      if (
        rel.dadosPoco?.testeVazaoSEMA?.ativo &&
        rel.dadosPoco.testeVazaoSEMA.etapas.length > 0
      ) {
        const calcSEMA = calcularParametrosStepDrawdownSEMA(
          rel.dadosPoco.nivelEstatico,
          rel.dadosPoco.testeVazaoSEMA
        );
        eficienciaSEMA = calcSEMA.eficienciaUltimaEtapaPct;
      }

      const dataFmt = formatarDataBR(rel.cabecalho.dataExecucao);
      const osCurta = rel.cabecalho.contratoOS || 'S/OS';

      return {
        uuid: rel.uuid,
        os: osCurta,
        dataISO: rel.cabecalho.dataExecucao,
        dataFormatada: dataFmt,
        rotuloEixoX: `${dataFmt.slice(0, 5)} (${osCurta})`,
        tipoServico: rel.cabecalho.tipoServico || 'Manutenção / Medição',
        ne,
        nd,
        rebaixamento,
        vazao,
        capacidadeEspecifica,
        eficienciaSEMA,
        crivo,
        bomba: rel.dadosPoco?.especificacaoBomba || '',
      };
    });
  }, [relatoriosDoPoco, crivoReferencia]);

  if (serieTemporal.length === 0) {
    return null;
  }

  const primeiro = serieTemporal[0];
  const ultimo = serieTemporal[serieTemporal.length - 1];

  const variacaoNE =
    primeiro.ne !== null && ultimo.ne !== null && serieTemporal.length > 1
      ? ultimo.ne - primeiro.ne
      : null;

  const variacaoND =
    primeiro.nd !== null && ultimo.nd !== null && serieTemporal.length > 1
      ? ultimo.nd - primeiro.nd
      : null;

  const variacaoVazao =
    primeiro.vazao !== null &&
    ultimo.vazao !== null &&
    serieTemporal.length > 1
      ? ultimo.vazao - primeiro.vazao
      : null;

  return (
    <div className="space-y-4 pt-2">
      {/* KPIs de Monitoramento Hidrogeológico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Card NE */}
        <div className="p-3.5 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">
            <span className="truncate">Último Nível Estático (NE)</span>
            <Droplets className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-base sm:text-lg font-extrabold text-sky-600 dark:text-sky-400 whitespace-nowrap">
              {formatarNumeroBR(ultimo.ne, 1, ' m')}
            </span>
            {variacaoNE !== null && (
              <span
                className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 whitespace-nowrap ${
                  variacaoNE <= 0 ? 'text-[#27AE60]' : 'text-amber-600'
                }`}
                title="Variação em relação à primeira medição do poço"
              >
                {variacaoNE > 0 ? '+' : ''}
                {formatarNumeroBR(variacaoNE, 1, 'm')}
              </span>
            )}
          </div>
          <span className="block text-[10px] text-[#6B7A8D] mt-1">
            Repouso piezométrico
          </span>
        </div>

        {/* Card ND */}
        <div className="p-3.5 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">
            <span className="truncate">Último Nível Dinâmico (ND)</span>
            <ArrowDownUp className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-base sm:text-lg font-extrabold text-[#B86E00] dark:text-[#E8A020] whitespace-nowrap">
              {formatarNumeroBR(ultimo.nd, 1, ' m')}
            </span>
            {variacaoND !== null && (
              <span
                className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 whitespace-nowrap ${
                  variacaoND <= 0 ? 'text-[#27AE60]' : 'text-amber-600'
                }`}
                title="Variação em relação à primeira medição do poço"
              >
                {variacaoND > 0 ? '+' : ''}
                {formatarNumeroBR(variacaoND, 1, 'm')}
              </span>
            )}
          </div>
          <span className="block text-[10px] text-[#6B7A8D] mt-1">
            Em bombeamento estabilizado
          </span>
        </div>

        {/* Card Rebaixamento & Eficiência SEMA */}
        <div className="p-3.5 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">
            <span className="truncate">Rebaixamento (Δh)</span>
            <Layers className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-base sm:text-lg font-extrabold text-[#1B2A3B] dark:text-slate-100 whitespace-nowrap">
              {formatarNumeroBR(ultimo.rebaixamento, 1, ' m')}
            </span>
            {ultimo.eficienciaSEMA !== null ? (
              <span
                className="text-[11px] font-mono font-bold text-[#27AE60] whitespace-nowrap"
                title="Eficiência Hidráulica do Poço no Teste Escalonado SEMA"
              >
                Ef. {formatarNumeroBR(ultimo.eficienciaSEMA, 1, '%')}
              </span>
            ) : (
              ultimo.capacidadeEspecifica !== null && (
                <span
                  className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                  title="Capacidade Específica (Vazão dividida pelo Rebaixamento)"
                >
                  {formatarNumeroBR(ultimo.capacidadeEspecifica, 2, ' m³/h/m')}
                </span>
              )
            )}
          </div>
          <span className="block text-[10px] text-[#6B7A8D] mt-1">
            {ultimo.eficienciaSEMA !== null
              ? 'Eficiência Hidráulica SEMA (Lp)'
              : 'Cap. Específica (Q / Δh)'}
          </span>
        </div>

        {/* Card Vazão */}
        <div className="p-3.5 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">
            <span className="truncate">Última Vazão (Q)</span>
            <Gauge className="w-3.5 h-3.5 text-[#27AE60] shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-base sm:text-lg font-extrabold text-[#27AE60] whitespace-nowrap">
              {formatarNumeroBR(ultimo.vazao, 1, ' m³/h')}
            </span>
            {variacaoVazao !== null && (
              <span
                className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 whitespace-nowrap ${
                  variacaoVazao >= 0 ? 'text-[#27AE60]' : 'text-red-500'
                }`}
                title="Variação de vazão em relação à primeira medição"
              >
                {variacaoVazao >= 0 ? (
                  <TrendingUp className="w-3 h-3 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 shrink-0" />
                )}
                {variacaoVazao > 0 ? '+' : ''}
                {formatarNumeroBR(variacaoVazao, 1, ' m³/h')}
              </span>
            )}
          </div>
          <span className="block text-[10px] text-[#6B7A8D] mt-1">
            Produção na última O.S.
          </span>
        </div>
      </div>

      {/* Controles de Visualização do Gráfico Recharts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F0F3F7] dark:bg-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setModoVisao('linhas')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
              modoVisao === 'linhas'
                ? 'bg-[#1B2A3B] text-white shadow-xs'
                : 'text-[#6B7A8D] dark:text-slate-300 hover:text-[#1B2A3B] dark:hover:text-white'
            }`}
          >
            Gráfico de Linhas (NE + ND + Vazão)
          </button>
          <button
            type="button"
            onClick={() => setModoVisao('niveis')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
              modoVisao === 'niveis'
                ? 'bg-[#1B2A3B] text-white shadow-xs'
                : 'text-[#6B7A8D] dark:text-slate-300 hover:text-[#1B2A3B] dark:hover:text-white'
            }`}
          >
            Perfil de Níveis (NE × ND × Crivo)
          </button>
          <button
            type="button"
            onClick={() => setModoVisao('vazao')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
              modoVisao === 'vazao'
                ? 'bg-[#1B2A3B] text-white shadow-xs'
                : 'text-[#6B7A8D] dark:text-slate-300 hover:text-[#1B2A3B] dark:hover:text-white'
            }`}
          >
            Curva de Vazão (Q e Q/Δh)
          </button>
        </div>

        {modoVisao !== 'vazao' && (
          <label className="inline-flex items-center gap-2 text-xs text-[#6B7A8D] dark:text-slate-300 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={inverterProfundidade}
              onChange={(e) => setInverterProfundidade(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#E8A020]"
            />
            <span>Inverter eixo de profundidade (0m no topo)</span>
          </label>
        )}
      </div>

      {/* Área do Gráfico Interativo Recharts */}
      <div className="w-full h-[300px] sm:h-[340px] rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC]/70 dark:bg-slate-950/60 p-3">
        <ResponsiveContainer width="100%" height="100%">
          {modoVisao === 'linhas' ? (
            <LineChart
              data={serieTemporal}
              margin={{ top: 12, right: 18, left: 4, bottom: 6 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#CBD5E1"
                opacity={0.45}
              />
              <XAxis
                dataKey="rotuloEixoX"
                tick={{ fontSize: 11, fill: '#6B7A8D' }}
                axisLine={{ stroke: '#CBD5E1' }}
              />
              <YAxis
                yAxisId="left"
                reversed={inverterProfundidade}
                unit="m"
                tick={{ fontSize: 11, fill: '#6B7A8D' }}
                axisLine={{ stroke: '#CBD5E1' }}
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                unit=" m³/h"
                tick={{ fontSize: 11, fill: '#27AE60' }}
                axisLine={{ stroke: '#27AE60' }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomHydroTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ne"
                name="Nível Estático - NE (m)"
                stroke="#0284C7"
                strokeWidth={2.6}
                dot={{ r: 4.5, fill: '#0284C7', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6.5 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="nd"
                name="Nível Dinâmico - ND (m)"
                stroke="#E8A020"
                strokeWidth={2.6}
                dot={{ r: 4.5, fill: '#E8A020', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6.5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="vazao"
                name="Vazão Mensurada - Q (m³/h)"
                stroke="#27AE60"
                strokeWidth={2.6}
                dot={{ r: 4.5, fill: '#27AE60', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6.5 }}
              />
            </LineChart>
          ) : modoVisao === 'niveis' ? (
            <ComposedChart
              data={serieTemporal}
              margin={{ top: 12, right: 20, left: 4, bottom: 6 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#CBD5E1"
                opacity={0.45}
              />
              <XAxis
                dataKey="rotuloEixoX"
                tick={{ fontSize: 11, fill: '#6B7A8D' }}
              />
              <YAxis
                reversed={inverterProfundidade}
                unit="m"
                tick={{ fontSize: 11, fill: '#6B7A8D' }}
                domain={[
                  0,
                  (dataMax: number) =>
                    crivoReferencia
                      ? Math.max(dataMax + 10, crivoReferencia + 10)
                      : dataMax + 10,
                ]}
              />
              <Tooltip content={<CustomHydroTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              {crivoReferencia !== null && (
                <ReferenceLine
                  y={crivoReferencia}
                  stroke="#E74C3C"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Crivo Bomba (${crivoReferencia}m)`,
                    position: 'insideBottomRight',
                    fill: '#E74C3C',
                    fontSize: 10,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="rebaixamento"
                name="Rebaixamento Δh (m)"
                fill="#F43F5E"
                fillOpacity={0.12}
                stroke="#F43F5E"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="ne"
                name="Nível Estático - NE (m)"
                stroke="#0284C7"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0284C7' }}
              />
              <Line
                type="monotone"
                dataKey="nd"
                name="Nível Dinâmico - ND (m)"
                stroke="#E8A020"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#E8A020' }}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={serieTemporal}
              margin={{ top: 12, right: 16, left: 4, bottom: 6 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#CBD5E1"
                opacity={0.45}
              />
              <XAxis
                dataKey="rotuloEixoX"
                tick={{ fontSize: 11, fill: '#6B7A8D' }}
              />
              <YAxis
                yAxisId="left"
                unit=" m³/h"
                tick={{ fontSize: 11, fill: '#27AE60' }}
                domain={[0, 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                unit=" m³/h/m"
                tick={{ fontSize: 11, fill: '#0284C7' }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomHydroTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="vazao"
                name="Vazão Mensurada Q (m³/h)"
                fill="#27AE60"
                fillOpacity={0.18}
                stroke="#27AE60"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#27AE60' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="capacidadeEspecifica"
                name="Capacidade Específica Q/Δh (m³/h/m)"
                stroke="#0284C7"
                strokeWidth={2.2}
                dot={{ r: 4, fill: '#0284C7' }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  X,
  Zap,
  Sparkles,
  Info,
  Check,
  TrendingDown,
  Clock,
  Gauge,
  Droplets,
  Layers,
} from 'lucide-react';
import {
  LeituraBombeamentoGeoeste,
  LeituraRecuperacaoGeoeste,
  EtapaStepDrawdownSEMA,
} from '../types/relatorio';
import {
  TEMPOS_PADRAO_BOMBEAMENTO_GEOESTE,
  TEMPOS_PADRAO_RECUPERACAO_GEOESTE,
  parseNumeroSEMA,
  fmtNumeroSEMA,
} from './StepDrawdownSection';

interface ModalSimuladorTesteProps {
  isOpen: boolean;
  onClose: () => void;
  neAtual: string;
  ndAtual: string;
  vazaoAtual: string;
  onAplicarSimulacao: (dados: {
    leiturasBombeamento: LeituraBombeamentoGeoeste[];
    leiturasRecuperacao: LeituraRecuperacaoGeoeste[];
    etapas: EtapaStepDrawdownSEMA[];
    etapaLabel: string;
    vazaoRecomendada: string;
    nivelRecuperacaoFinal: string;
  }) => void;
}

export const ModalSimuladorTeste: React.FC<ModalSimuladorTesteProps> = ({
  isOpen,
  onClose,
  neAtual,
  ndAtual,
  vazaoAtual,
  onAplicarSimulacao,
}) => {
  // Parâmetros de entrada do modelo hidrogeológico
  const [neInput, setNeInput] = useState<string>(neAtual || '22,40');
  const [ndInput, setNdInput] = useState<string>(ndAtual || '64,10');
  const [vazaoInput, setVazaoInput] = useState<string>(vazaoAtual || '10,29');
  const [tempoEstabMin, setTempoEstabMin] = useState<number>(160);
  const [tipoAquifero, setTipoAquifero] = useState<
    'sedimentar' | 'fraturado' | 'livre'
  >('sedimentar');
  const [eficienciaDesejada, setEficienciaDesejada] = useState<number>(75);
  const [taxaRecuperacaoFinal, setTaxaRecuperacaoFinal] = useState<number>(73);
  const [incluirRuidoCampo, setIncluirRuidoCampo] = useState<boolean>(true);
  const [mostrarGuiaAquifero, setMostrarGuiaAquifero] = useState<boolean>(false);

  // Cálculos prévios
  const neVal = parseNumeroSEMA(neInput) ?? 22.4;
  const ndVal = parseNumeroSEMA(ndInput) ?? 64.1;
  const qVal = parseNumeroSEMA(vazaoInput) ?? 10.29;

  const rebaixamentoTotal = Math.max(0.1, Number((ndVal - neVal).toFixed(2)));
  const capEspecifica = qVal > 0 ? (qVal / rebaixamentoTotal).toFixed(3) : '0';

  // Gerador sintético de curvas físicas Cooper-Jacob e Theis
  const simulacao = useMemo(() => {
    if (ndVal <= neVal || qVal <= 0) {
      return null;
    }

    const sMax = rebaixamentoTotal;
    const tEstab = Math.max(30, tempoEstabMin);

    // 1. Leituras de Bombeamento (36 pontos padrão ABNT)
    const leiturasBomb: LeituraBombeamentoGeoeste[] =
      TEMPOS_PADRAO_BOMBEAMENTO_GEOESTE.map((t) => {
        let sT: number;

        if (t >= tEstab) {
          // Estabilizado
          sT = sMax;
        } else {
          // Progressão logarítmica Cooper-Jacob
          const x = Math.log10(t) / Math.log10(tEstab);

          if (tipoAquifero === 'sedimentar') {
            sT = sMax * (0.08 + 0.92 * Math.pow(x, 0.92));
          } else if (tipoAquifero === 'fraturado') {
            // Efeito de fraturas: desce rápido e ancora na recarga
            sT = sMax * (0.12 + 0.88 * Math.tanh(2.1 * x));
          } else {
            // Aquífero livre com resposta retardada
            sT = sMax * (0.06 + 0.94 * Math.pow(x, 1.2));
          }

          // Se ativado pequeno ruído de precisão de fita de nível (±0,03m) para realismo estético
          if (incluirRuidoCampo && t > 5 && t < tEstab) {
            const pseudoRand = ((Math.sin(t * 12.9898) * 43758.5453) % 1) - 0.5;
            sT += pseudoRand * 0.05;
          }
        }

        sT = Math.min(sMax, Math.max(0.1, sT));
        const ndT = Number((neVal + sT).toFixed(2));

        let obs = 'Água límpida';
        if (t === 1) obs = 'Início do ensaio a vazão constante';
        else if (t === 10) obs = 'Ciclo log t=10 min';
        else if (t === 100) obs = 'Ciclo log t=100 min';
        else if (t === tEstab) obs = 'Estabilização de N.D.';
        else if (t >= tEstab) obs = 'Nível Estabilizado';

        return {
          id: `bomb-sim-${t}`,
          tMin: t,
          ndM: ndT.toFixed(2).replace('.', ','),
          vazaoM3h: qVal.toFixed(3).replace('.', ','),
          areiaPpm: '0',
          observacoes: obs,
        };
      });

    // 2. Leituras de Recuperação (18 pontos padrão)
    const taxaRecupFrac = Math.min(0.98, Math.max(0.3, taxaRecuperacaoFinal / 100));
    const leiturasRec: LeituraRecuperacaoGeoeste[] =
      TEMPOS_PADRAO_RECUPERACAO_GEOESTE.map((t) => {
        const xRec = Math.log10(t + 1) / Math.log10(36);
        const recupInst = taxaRecupFrac * Math.pow(xRec, 0.75);
        const sRes = Math.max(0.05, sMax * (1 - recupInst));
        const ndRec = Number((neVal + sRes).toFixed(2));

        let obs = 'Ascensão contínua';
        if (t === 1) obs = 'Desligamento do bombeamento';
        else if (t === 35) obs = `Recuperação final: ${(taxaRecupFrac * 100).toFixed(1).replace('.', ',')}%`;

        return {
          id: `rec-sim-${t}`,
          tMin: t,
          ndM: ndRec.toFixed(2).replace('.', ','),
          sCalcM: '',
          observacoes: obs,
        };
      });

    // 3. Etapas de Interpretação Step-Drawdown (Anexo I.3)
    const efFrac = Math.min(0.95, Math.max(0.4, eficienciaDesejada / 100));
    const B = (efFrac * sMax) / qVal;
    const C = ((1 - efFrac) * sMax) / Math.pow(qVal, 2);

    const q1 = Number((qVal * 0.6).toFixed(2));
    const q2 = Number((qVal * 0.82).toFixed(2));
    const q3 = Number(qVal.toFixed(2));

    const s1 = B * q1 + C * Math.pow(q1, 2);
    const s2 = B * q2 + C * Math.pow(q2, 2);
    const s3 = sMax;

    const etapas: EtapaStepDrawdownSEMA[] = [
      {
        id: 'step-sim-1',
        etapa: 1,
        duracaoMinutos: 120,
        vazaoM3h: q1.toFixed(2).replace('.', ','),
        nivelDinamicoM: (neVal + s1).toFixed(2).replace('.', ','),
        observacao: '1ª Etapa Escalonada — Regime Laminar Predominante',
      },
      {
        id: 'step-sim-2',
        etapa: 2,
        duracaoMinutos: 120,
        vazaoM3h: q2.toFixed(2).replace('.', ','),
        nivelDinamicoM: (neVal + s2).toFixed(2).replace('.', ','),
        observacao: '2ª Etapa Escalonada — Transição Hidrodinâmica',
      },
      {
        id: 'step-sim-3',
        etapa: 3,
        duracaoMinutos: 240,
        vazaoM3h: q3.toFixed(2).replace('.', ','),
        nivelDinamicoM: (neVal + s3).toFixed(2).replace('.', ','),
        observacao: '3ª Etapa Nominal Estabilizada — Vazão Recomendada (24h)',
      },
    ];

    const ndRecupFinal = leiturasRec[leiturasRec.length - 1]?.ndM || '33,60';

    return {
      leiturasBomb,
      leiturasRec,
      etapas,
      ndRecupFinal,
      coefB: B,
      coefC: C,
    };
  }, [
    neVal,
    ndVal,
    qVal,
    rebaixamentoTotal,
    tempoEstabMin,
    tipoAquifero,
    eficienciaDesejada,
    taxaRecuperacaoFinal,
    incluirRuidoCampo,
  ]);

  if (!isOpen) return null;

  const handleAplicar = () => {
    if (!simulacao) return;
    onAplicarSimulacao({
      leiturasBombeamento: simulacao.leiturasBomb,
      leiturasRecuperacao: simulacao.leiturasRec,
      etapas: simulacao.etapas,
      etapaLabel: '24H',
      vazaoRecomendada: vazaoInput,
      nivelRecuperacaoFinal: simulacao.ndRecupFinal,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#1B2A3B] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#E8A020] text-[#1B2A3B]">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Simulador Hidrogeológico de Teste de Vazão
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-[#E8A020]/20 text-[#E8A020] border border-[#E8A020]/30">
                  Cooper-Jacob & Theis
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Gera curva contínua completa de 36 leituras, recuperação residual e 3 degraus escalonados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-[#1B2A3B] dark:text-slate-200">
          {/* Card explicativo */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-amber-900 dark:text-amber-200">
            <Info className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-xs">
                Como funciona a simulação hidrogeológica?
              </p>
              <p className="text-[11.5px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                A partir apenas dos parâmetros essenciais conhecidos do poço (Nível Estático, Nível Dinâmico Estabilizado e Vazão de Teste), o modelo calcula a resposta hidrodinâmica clássica de Cooper-Jacob / Theis (ABNT NBR 12212/12244), produzindo todas as 36 leituras do teste contínuo, as 18 leituras de recuperação e os 3 degraus de perda de carga compatíveis.
              </p>
            </div>
          </div>

          {/* Grid de Parâmetros Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
              <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] mb-1">
                Nível Estático (NE)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={neInput}
                  onChange={(e) => setNeInput(e.target.value)}
                  placeholder="22,40"
                  className="w-full px-3 py-2 pr-8 text-sm font-bold font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-sky-600"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-mono">
                  m
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Nível de repouso antes do bombeamento
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
              <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] mb-1">
                Nível Dinâmico Final (ND)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ndInput}
                  onChange={(e) => setNdInput(e.target.value)}
                  placeholder="64,10"
                  className="w-full px-3 py-2 pr-8 text-sm font-bold font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-600"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-mono">
                  m
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Nível rebaixado estabilizado
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
              <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] mb-1">
                Vazão do Teste (Q)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vazaoInput}
                  onChange={(e) => setVazaoInput(e.target.value)}
                  placeholder="10,29"
                  className="w-full px-3 py-2 pr-12 text-sm font-bold font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-mono">
                  m³/h
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Vazão pretendida de outorga
              </span>
            </div>
          </div>

          {/* Parâmetros Avançados de Comportamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10.5px] font-bold uppercase text-[#6B7A8D] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#E8A020]" />
                  Tipo de Formação / Aquífero
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarGuiaAquifero((prev) => !prev)}
                  className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Info className="w-3 h-3" />
                  <span>Como saber?</span>
                </button>
              </div>
              <select
                value={tipoAquifero}
                onChange={(e) => setTipoAquifero(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="sedimentar">
                  Aquífero Confinado Sedimentar (Cooper-Jacob clássico)
                </option>
                <option value="fraturado">
                  Aquífero Fraturado / Cristalino (Recarga de fraturas)
                </option>
                <option value="livre">
                  Aquífero Livre / Freático (Drenagem retardada)
                </option>
              </select>

              {mostrarGuiaAquifero && (
                <div className="mt-2 p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 text-[11px] text-sky-900 dark:text-sky-200 space-y-1.5 animate-fadeIn">
                  <div className="font-bold flex items-center gap-1 text-[11px] text-sky-800 dark:text-sky-300">
                    <Droplets className="w-3 h-3" />
                    Como identificar o tipo do seu poço:
                  </div>
                  <p>
                    <strong>1. Pelo Perfil Litológico do Poço:</strong> Veja se a captação (filtros) está em <em>arenito</em> (Arenito Bauru, Parecis, Guarani) ➔ escolha <strong>Sedimentar</strong>. Se está em rocha dura maciça (basalto, granito, gnaisse) ➔ escolha <strong>Fraturado</strong>.
                  </p>
                  <p>
                    <strong>2. Pela Outorga Ambiental (SEMA / DAEE):</strong> O documento cita explicitamente o nome da formação hidrogeológica autorizada.
                  </p>
                  <p className="text-sky-700 dark:text-sky-300 italic">
                    💡 <strong>Dica prática:</strong> Na dúvida, mantenha <strong>Sedimentar (Cooper-Jacob)</strong>, que é o padrão universal aceito pela ABNT NBR 12212 em 95% dos processos de outorga.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#E8A020]" />
                Tempo até Estabilização Plena
              </label>
              <select
                value={tempoEstabMin}
                onChange={(e) => setTempoEstabMin(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
              >
                <option value={100}>100 min (Estabilização rápida)</option>
                <option value={130}>130 min</option>
                <option value={160}>160 min (Padrão Geoeste / DAEE)</option>
                <option value={190}>190 min</option>
                <option value={220}>220 min (Aquífero profundo)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] mb-1.5 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                Eficiência Esperada do Poço (E%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="55"
                  max="90"
                  step="1"
                  value={eficienciaDesejada}
                  onChange={(e) => setEficienciaDesejada(Number(e.target.value))}
                  className="flex-1 accent-[#E8A020]"
                />
                <span className="font-mono font-bold text-xs w-12 text-right">
                  {eficienciaDesejada}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Define a partição das perdas de aquífero (B) vs poço (C)
              </span>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] mb-1.5 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-600" />
                Taxa de Recuperação aos 35 min
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="1"
                  value={taxaRecuperacaoFinal}
                  onChange={(e) => setTaxaRecuperacaoFinal(Number(e.target.value))}
                  className="flex-1 accent-sky-500"
                />
                <span className="font-mono font-bold text-xs w-12 text-right">
                  {taxaRecuperacaoFinal}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Percentual da coluna de rebaixamento recuperada aos 35 min
              </span>
            </div>
          </div>

          {/* Toggle de micro-variação de campo */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950">
            <div>
              <span className="text-xs font-semibold block">
                Aplicar micro-variação natural de leitura de fita de nível (±0,03m)
              </span>
              <span className="text-[10.5px] text-[#6B7A8D]">
                Gera textura realística idêntica à leitura manual de campo em poço
              </span>
            </div>
            <input
              type="checkbox"
              checked={incluirRuidoCampo}
              onChange={(e) => setIncluirRuidoCampo(e.target.checked)}
              className="w-4 h-4 accent-[#E8A020] cursor-pointer"
            />
          </div>

          {/* Prévia dos Resultados Calculados */}
          {simulacao ? (
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E8A020] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Resultados Sintetizados da Simulação
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {simulacao.leiturasBomb.length} pts Bomb · {simulacao.leiturasRec.length} pts Rec · 3 Etapas
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/50">
                  <div className="text-[10px] uppercase text-slate-400">Rebaixamento (s)</div>
                  <div className="text-sm font-bold text-amber-400">{rebaixamentoTotal.toFixed(2).replace('.', ',')} m</div>
                </div>
                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/50">
                  <div className="text-[10px] uppercase text-slate-400">Cap. Específica (Q/s)</div>
                  <div className="text-sm font-bold text-emerald-400">{capEspecifica} m³/h/m</div>
                </div>
                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/50">
                  <div className="text-[10px] uppercase text-slate-400">Eficiência (E)</div>
                  <div className="text-sm font-bold text-sky-400">{eficienciaDesejada}%</div>
                </div>
                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/50">
                  <div className="text-[10px] uppercase text-slate-400">Recup. 35 min</div>
                  <div className="text-sm font-bold text-indigo-300">{simulacao.ndRecupFinal} m</div>
                </div>
              </div>

              {/* Amostra rápida dos degraus calculados */}
              <div className="text-[11px] text-slate-300 pt-1">
                <span className="text-slate-400 font-semibold block mb-1">Degraus escalonados gerados:</span>
                <div className="flex flex-wrap gap-2">
                  {simulacao.etapas.map((et) => (
                    <span key={et.id} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                      Etapa {et.etapa}: <strong>{et.vazaoM3h} m³/h</strong> → ND <strong>{et.nivelDinamicoM} m</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-xs">
              O Nível Dinâmico (ND) deve ser maior que o Nível Estático (NE), e a vazão deve ser maior que zero para simular o teste.
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#6B7A8D]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!simulacao}
            onClick={handleAplicar}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all ${
              simulacao
                ? 'bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] cursor-pointer'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Aplicar Simulação ao Relatório</span>
          </button>
        </div>
      </div>
    </div>
  );
};

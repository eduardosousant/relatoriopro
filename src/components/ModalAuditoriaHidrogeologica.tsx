import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  X,
  FileDown,
  FileText,
  Wrench,
  Activity,
} from 'lucide-react';
import { ResultadoAuditoriaRelatorio } from '../utils/auditoriaRelatorio';

interface ModalAuditoriaHidrogeologicaProps {
  isOpen: boolean;
  onClose: () => void;
  resultado: ResultadoAuditoriaRelatorio | null;
  carregandoIA: boolean;
  modoBloqueioExportacao: boolean;
  onExecutarAuditoriaIA: () => void;
  onAplicarSecoesNoRelatorio: (resultado: ResultadoAuditoriaRelatorio) => void;
  onForcarExportacaoPDF?: () => void;
  onIrParaSecao?: (secao: 'poco' | 'checklist' | 'ocorrencias' | 'identificacao') => void;
}

export const ModalAuditoriaHidrogeologica: React.FC<
  ModalAuditoriaHidrogeologicaProps
> = ({
  isOpen,
  onClose,
  resultado,
  carregandoIA,
  modoBloqueioExportacao,
  onExecutarAuditoriaIA,
  onAplicarSecoesNoRelatorio,
  onForcarExportacaoPDF,
  onIrParaSecao,
}) => {
  if (!isOpen || !resultado) return null;

  const isAprovado = resultado.statusAuditoria === 'APROVADO';
  const isBloqueado = resultado.statusAuditoria === 'BLOQUEADO_INCONSISTENCIA';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div
          className={`px-5 py-4 flex items-center justify-between text-white ${
            isAprovado
              ? 'bg-[#1B2A3B]'
              : isBloqueado
              ? 'bg-red-800'
              : 'bg-amber-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isAprovado
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/15 text-amber-200'
              }`}
            >
              {isAprovado ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  {modoBloqueioExportacao && !isAprovado
                    ? 'Emissão Bloqueada — Inconsistência Técnica Detectada'
                    : 'Auditoria Técnica e Parecer Hidrogeológico (NBR 12.212 / 12.244)'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isAprovado
                      ? 'bg-emerald-500 text-slate-950'
                      : isBloqueado
                      ? 'bg-red-200 text-red-950'
                      : 'bg-amber-200 text-amber-950'
                  }`}
                >
                  {resultado.statusAuditoria}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                Validação geométrica do poço, regras de duração (12h/24h/48h/72h) e equação característica de Jacob-Rorabaugh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Alertas de Bloqueio (se houver) */}
          {resultado.alertasBloqueio.length > 0 ? (
            <div className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50/90 dark:bg-red-950/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-red-800 dark:text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Travas de Consistência Acionadas ({resultado.alertasBloqueio.length})
                </span>
                {onIrParaSecao && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onIrParaSecao('poco');
                      }}
                      className="px-2.5 py-1 rounded bg-red-800 hover:bg-red-900 text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Wrench className="w-3 h-3" />
                      Corrigir Dados do Poço
                    </button>
                  </div>
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-red-900 dark:text-red-200 list-disc pl-4">
                {resultado.alertasBloqueio.map((alerta, idx) => (
                  <li key={idx} className="leading-relaxed font-medium">
                    {alerta}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                <strong>Todas as 8 travas normativas aprovadas:</strong> Geometria coerente (ND ≥ NE e Bomba submersa abaixo do ND), duração compatível com a vazão e checklist consistente com o campo.
              </div>
            </div>
          )}

          {/* Classificação do Ensaio e Coeficientes Jacob-Rorabaugh */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 p-3.5 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A8D] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#E8A020]" />
                Classificação Normativa do Ensaio
              </div>
              <div className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100">
                {resultado.classificacaoEnsaio.enquadramentoNormativo}
              </div>
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                Duração: {resultado.classificacaoEnsaio.duracaoSelecionadaHoras}h | Variação ND final:{' '}
                {resultado.classificacaoEnsaio.variacaoNDHorasFinais_m_h
                  .toFixed(3)
                  .replace('.', ',')}{' '}
                m/h | Estabilizado:{' '}
                {resultado.classificacaoEnsaio.estabilizacaoAtingida
                  ? 'SIM (≤ 0,10 m/h)'
                  : 'NÃO (> 0,10 m/h)'}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                {resultado.classificacaoEnsaio.justificativaTecnicaDuracao}
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 p-3.5 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A8D]">
                Equação Característica (Jacob-Rorabaugh)
              </div>
              <div className="text-xs font-mono font-bold text-[#002299] dark:text-sky-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                s = B·Q + C·Q² &nbsp;⇒&nbsp; s/Q = B + C·Q
              </div>
              {resultado.coeficientesCalculados && (
                <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-0.5">
                  <div>
                    • Geral: <strong>{resultado.coeficientesCalculados.equacaoGeral}</strong>
                  </div>
                  <div>
                    • Linearizada: <strong>{resultado.coeficientesCalculados.equacaoLinearizada}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seções Estruturadas Geradas pela IA (se já executada) */}
          {resultado.relatorioSecoes ? (
            <div className="rounded-xl border border-[#2E75B6]/40 bg-[#F4F8FC] dark:bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#E8A020]" />
                  Seções Técnicas Redigidas pelo Auditor Hidrogeológico
                </span>
                <button
                  type="button"
                  onClick={() => onAplicarSecoesNoRelatorio(resultado)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#27AE60] hover:bg-[#219150] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Aplicar Textos no Relatório
                </button>
              </div>

              <div className="space-y-2.5 text-xs max-h-64 overflow-y-auto pr-1">
                <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-[#1B2A3B] dark:text-slate-200 mb-1">
                    3. Geometria Construtiva do Poço
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {resultado.relatorioSecoes['3_geometriaConstrutivaPoco']}
                  </p>
                </div>

                <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-[#1B2A3B] dark:text-slate-200 mb-1">
                    5 & 6. Metodologia do Ensaio + Interpretação Jacob-Rorabaugh (s = B·Q + C·Q²)
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {resultado.relatorioSecoes['5_testeVazaoMetodologia']}
                    {'\n\n'}
                    {
                      resultado.relatorioSecoes[
                        '6_interpretacaoHidrogeologicaJacobRorabaugh'
                      ]
                    }
                  </p>
                </div>

                <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-[#1B2A3B] dark:text-slate-200 mb-1">
                    7. Parecer Hidrogeológico e Vazão Recomendada
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {resultado.relatorioSecoes['7_parecerVazaoRecomendada']}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#2E75B6]/50 bg-[#F4F8FC]/60 dark:bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#1B2A3B] dark:text-slate-200">
                  Gerar Parecer Hidrogeológico Estruturado (NBR 12.212 / NBR 12.244)
                </div>
                <p className="text-[11px] text-[#6B7A8D] dark:text-slate-400 mt-0.5">
                  Redige automaticamente a Geometria Construtiva, Interpretação Jacob-Rorabaugh (s = B·Q + C·Q²) e Parecer de Vazão com os coeficientes B e C pré-calculados.
                </p>
              </div>
              <button
                type="button"
                disabled={carregandoIA}
                onClick={onExecutarAuditoriaIA}
                className="px-4 py-2.5 rounded-lg bg-[#1B2A3B] hover:bg-[#25394e] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 shrink-0"
              >
                <Sparkles className="w-4 h-4 text-[#E8A020]" />
                <span>
                  {carregandoIA
                    ? 'Auditando e Redigindo...'
                    : 'Gerar Parecer Normativo'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3.5 border-t border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Fechar e Revisar Dados
          </button>

          <div className="flex items-center gap-2">
            {modoBloqueioExportacao && !isAprovado && onForcarExportacaoPDF && (
              <button
                type="button"
                onClick={onForcarExportacaoPDF}
                className="px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 hover:bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200 text-xs font-bold flex items-center gap-1.5"
                title="Exportar como rascunho de conferência mesmo com alertas pendentes"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Exportar Rascunho Mesmo Assim</span>
              </button>
            )}

            {isAprovado && onForcarExportacaoPDF && (
              <button
                type="button"
                onClick={onForcarExportacaoPDF}
                className="px-4 py-2 rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] text-xs font-bold flex items-center gap-1.5"
              >
                <FileDown className="w-4 h-4" />
                <span>Exportar PDF A4 Agora</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

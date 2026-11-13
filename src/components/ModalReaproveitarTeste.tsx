import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Search,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Droplets,
  AlertCircle,
} from 'lucide-react';
import {
  RelatorioTecnico,
  DadosTesteVazaoSEMA,
} from '../types/relatorio';
import { parseNumeroSEMA } from './StepDrawdownSection';

interface ModalReaproveitarTesteProps {
  isOpen: boolean;
  onClose: () => void;
  relatoriosAnteriores?: RelatorioTecnico[];
  pocoIdAtual?: string;
  neAtualStr?: string;
  onReaproveitarTeste: (
    testeClonado: DadosTesteVazaoSEMA,
    resumoOrigem: string
  ) => void;
}

export const ModalReaproveitarTeste: React.FC<ModalReaproveitarTesteProps> = ({
  isOpen,
  onClose,
  relatoriosAnteriores = [],
  pocoIdAtual,
  neAtualStr = '22,40',
  onReaproveitarTeste,
}) => {
  const [busca, setBusca] = useState('');
  const [reajustarNE, setReajustarNE] = useState(true);

  const neAtualNum = parseNumeroSEMA(neAtualStr) ?? 22.4;

  // Filtra relatórios que possuem ensaio de bombeamento ativo e válido
  const relatoriosComTeste = useMemo(() => {
    return (relatoriosAnteriores || [])
      .filter((r) => {
        const teste = r.dadosPoco?.testeVazaoSEMA;
        return (
          teste &&
          teste.ativo !== false &&
          (teste.leiturasBombeamento?.length || 0) > 0
        );
      })
      .map((r) => {
        const teste = r.dadosPoco.testeVazaoSEMA!;
        const neAnterior = parseNumeroSEMA(r.dadosPoco.nivelEstatico) ?? 22.4;
        const ndAnterior =
          parseNumeroSEMA(r.dadosPoco.nivelDinamico) ??
          parseNumeroSEMA(teste.nivelRecuperacaoFinalM) ??
          64.1;
        const vazaoAnterior =
          teste.vazaoOutorgaRecomendadaM3h || r.dadosPoco.vazaoTeste || '10,29';
        const isMesmoPoco =
          Boolean(pocoIdAtual) &&
          Boolean(r.dadosPoco.pocoId) &&
          r.dadosPoco.pocoId.trim().toUpperCase() === pocoIdAtual?.trim().toUpperCase();

        return {
          relatorio: r,
          teste,
          neAnterior,
          ndAnterior,
          vazaoAnterior,
          isMesmoPoco,
          leiturasBombQtd: teste.leiturasBombeamento?.length || 0,
          leiturasRecQtd: teste.leiturasRecuperacao?.length || 0,
          etapasQtd: teste.etapas?.length || 0,
        };
      })
      .sort((a, b) => {
        // Prioriza o mesmo poço primeiro, depois data mais recente
        if (a.isMesmoPoco && !b.isMesmoPoco) return -1;
        if (!a.isMesmoPoco && b.isMesmoPoco) return 1;
        return (b.relatorio.atualizadoEm || 0) - (a.relatorio.atualizadoEm || 0);
      });
  }, [relatoriosAnteriores, pocoIdAtual]);

  // Filtro de texto da busca
  const filtrados = useMemo(() => {
    if (!busca.trim()) return relatoriosComTeste;
    const termo = busca.toLowerCase();
    return relatoriosComTeste.filter((item) => {
      const os = item.relatorio.cabecalho.contratoOS?.toLowerCase() || '';
      const cli = item.relatorio.cabecalho.cliente?.toLowerCase() || '';
      const poco = item.relatorio.dadosPoco.pocoId?.toLowerCase() || '';
      const local = item.relatorio.cabecalho.localizacao?.toLowerCase() || '';
      return (
        os.includes(termo) ||
        cli.includes(termo) ||
        poco.includes(termo) ||
        local.includes(termo)
      );
    });
  }, [relatoriosComTeste, busca]);

  if (!isOpen) return null;

  const aplicarReaproveitamento = (item: (typeof relatoriosComTeste)[0]) => {
    const original = item.teste;
    const neOrigNum = item.neAnterior;
    const diffNE = reajustarNE ? Number((neAtualNum - neOrigNum).toFixed(2)) : 0;

    // Clona e reajusta as cotas se necessário
    const leiturasBombClonadas = (original.leiturasBombeamento || []).map(
      (l, idx) => {
        const ndVal = parseNumeroSEMA(l.ndM);
        const novoND =
          ndVal !== null
            ? (ndVal + diffNE).toFixed(2).replace('.', ',')
            : l.ndM;
        return {
          ...l,
          id: `bomb-reaproveitado-${Date.now()}-${idx}`,
          ndM: novoND,
        };
      }
    );

    const leiturasRecClonadas = (original.leiturasRecuperacao || []).map(
      (l, idx) => {
        const ndVal = parseNumeroSEMA(l.ndM);
        const novoND =
          ndVal !== null
            ? (ndVal + diffNE).toFixed(2).replace('.', ',')
            : l.ndM;
        return {
          ...l,
          id: `rec-reaproveitado-${Date.now()}-${idx}`,
          ndM: novoND,
        };
      }
    );

    const etapasClonadas = (original.etapas || []).map((et, idx) => {
      const ndVal = parseNumeroSEMA(et.nivelDinamicoM);
      const novoND =
        ndVal !== null
          ? (ndVal + diffNE).toFixed(2).replace('.', ',')
          : et.nivelDinamicoM;
      return {
        ...et,
        id: `step-reaproveitado-${Date.now()}-${idx}`,
        nivelDinamicoM: novoND,
      };
    });

    const testeClonado: DadosTesteVazaoSEMA = {
      ...original,
      ativo: true,
      leiturasBombeamento: leiturasBombClonadas,
      leiturasRecuperacao: leiturasRecClonadas,
      etapas: etapasClonadas,
    };

    const resumo = `O.S. ${item.relatorio.cabecalho.contratoOS || 'Anterior'} (Poço ${item.relatorio.dadosPoco.pocoId || 'Ref.'})`;
    onReaproveitarTeste(testeClonado, resumo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#1B2A3B] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#E8A020] text-[#1B2A3B]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Reaproveitar Teste de Vazão Anterior
              </h3>
              <p className="text-xs text-slate-300">
                Copie ensaios completos já realizados para este poço ou histórico de outros clientes
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

        {/* Barra de Filtro e Opções */}
        <div className="p-4 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6B7A8D]" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por O.S., Cliente, TAG do Poço ou Localização..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reajustarNE}
                onChange={(e) => setReajustarNE(e.target.checked)}
                className="w-4 h-4 accent-[#E8A020] rounded"
              />
              <span className="font-semibold text-[#1B2A3B] dark:text-slate-200">
                Ajustar níveis para o N.E. atual deste relatório ({neAtualNum.toFixed(2).replace('.', ',')} m)
              </span>
            </label>
            <span className="text-[11px] text-[#6B7A8D]">
              {filtrados.length} ensaio(s) encontrado(s)
            </span>
          </div>
        </div>

        {/* Lista de Ensaios Anteriores */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtrados.length === 0 ? (
            <div className="p-6 text-center text-[#6B7A8D] space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs font-semibold">
                Nenhum teste de vazão anterior encontrado.
              </p>
              <p className="text-[11.5px] max-w-sm mx-auto">
                Assim que você criar ou salvar relatórios que possuam o teste de bombeamento preenchido, eles aparecerão nesta lista para clonagem rápida.
              </p>
            </div>
          ) : (
            filtrados.map((item) => {
              const rel = item.relatorio;
              const isMesmo = item.isMesmoPoco;

              return (
                <div
                  key={rel.uuid}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isMesmo
                      ? 'border-[#E8A020] bg-amber-50/40 dark:bg-amber-950/20 shadow-xs'
                      : 'border-[#DDE3EC] dark:border-slate-800 hover:border-slate-400 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-[#1B2A3B] dark:text-slate-100 font-mono">
                          {rel.cabecalho.contratoOS || 'S/N'}
                        </span>
                        <span className="text-[11px] font-semibold text-[#E8A020] bg-[#1B2A3B] px-2 py-0.5 rounded">
                          Poço: {rel.dadosPoco.pocoId || 'PT01'}
                        </span>
                        {isMesmo && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#E8A020] text-[#1B2A3B]">
                            Mesmo Poço
                          </span>
                        )}
                        <span className="text-[11px] text-[#6B7A8D] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {rel.cabecalho.dataExecucao || 'Data recente'}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[#1B2A3B] dark:text-slate-200">
                        {rel.cabecalho.cliente || 'Cliente'} — {rel.cabecalho.localizacao || 'Local'}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#6B7A8D] dark:text-slate-400 pt-0.5">
                        <span>Q = <strong className="text-emerald-600">{item.vazaoAnterior} m³/h</strong></span>
                        <span>NE = <strong className="text-sky-600">{item.neAnterior.toFixed(2).replace('.', ',')} m</strong></span>
                        <span>ND = <strong className="text-amber-600">{item.ndAnterior.toFixed(2).replace('.', ',')} m</strong></span>
                        <span>{item.leiturasBombQtd} pts bomb</span>
                        <span>{item.leiturasRecQtd} pts rec</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => aplicarReaproveitamento(item)}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#25374d] text-[#E8A020] flex items-center gap-1.5 whitespace-nowrap self-end sm:self-center transition-colors cursor-pointer shadow-xs"
                    >
                      <span>Reaproveitar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3.5 border-t border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-[#6B7A8D]">
            Dica: você também pode salvar o arquivo em CSV para reaproveitar em qualquer computador.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#6B7A8D]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

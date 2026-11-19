import React, { useState, useMemo } from 'react';
import {
  Layers,
  Loader2,
  MapPin,
  Database,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Compass,
} from 'lucide-react';
import { CadastroPoco, RelatorioTecnico } from '../types/relatorio';
import {
  consultarAquiferoEReferencia,
  extrairMunicipioEUF,
  ResultadoConsultaAquifero,
} from '../services/anaAquiferoService';
import { extrairCoordenadasGeograficas } from '../utils/coordenadasParser';

interface DetectorAquiferoCardProps {
  value: string;
  onChange: (novoValor: string) => void;
  coordenadasGeograficas?: string;
  coordenadasUTM?: string;
  cidadeUF?: string;
  endereco?: string;
  pocosSupabase: CadastroPoco[];
  relatoriosSupabase?: RelatorioTecnico[];
  pocoIgnorarUuid?: string;
  label?: string;
  placeholder?: string;
  compacto?: boolean;
  onNotificar?: (mensagem: string, tipo: 'success' | 'info' | 'error') => void;
}

function formatarNumeroBR(valor: number | null, sufixo: string): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} ${sufixo}`;
}

export const DetectorAquiferoCard: React.FC<DetectorAquiferoCardProps> = ({
  value,
  onChange,
  coordenadasGeograficas,
  coordenadasUTM,
  cidadeUF,
  endereco,
  pocosSupabase,
  relatoriosSupabase = [],
  pocoIgnorarUuid,
  label = 'Aquífero / Formação Geológica',
  placeholder = 'Ex: Sistema Aquífero Parecis (Arenito)',
  compacto = false,
  onNotificar,
}) => {
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsultaAquifero | null>(
    null
  );
  const [expandido, setExpandido] = useState(true);
  const [aplicadoAutomaticamente, setAplicadoAutomaticamente] = useState(false);

  const contextoBusca = useMemo(() => {
    const coord = extrairCoordenadasGeograficas(
      coordenadasGeograficas,
      coordenadasUTM
    );
    const { municipio, uf } = extrairMunicipioEUF(cidadeUF, endereco);
    if (coord) {
      return {
        pronto: true,
        texto: `Busca espacial via coordenadas (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}) + poços vizinhos`,
        modo: 'coordenadas' as const,
      };
    }
    if (municipio || uf) {
      const regiao = [municipio, uf].filter(Boolean).join(' - ');
      return {
        pronto: true,
        texto: `Sem coordenadas: estimativa regional por ${regiao} (ANA + Supabase)`,
        modo: 'municipio' as const,
      };
    }
    return {
      pronto: false,
      texto:
        'Informe Coordenadas (Lat/Long ou UTM) ou Cidade / UF para detectar o aquífero via ANA/SNIRH.',
      modo: 'nenhum' as const,
    };
  }, [coordenadasGeograficas, coordenadasUTM, cidadeUF, endereco]);

  const handleDetectar = async () => {
    setConsultando(true);
    setAplicadoAutomaticamente(false);

    try {
      const res = await consultarAquiferoEReferencia({
        coordenadasGeograficas,
        coordenadasUTM,
        cidadeUF,
        endereco,
        pocosSupabase,
        relatoriosSupabase,
        pocoIgnorarUuid,
      });

      setResultado(res);
      setExpandido(true);

      if (res.aquiferoSugerido) {
        if (!value.trim()) {
          onChange(res.aquiferoSugerido);
          setAplicadoAutomaticamente(true);
          onNotificar?.(
            `Aquífero sugerido aplicado: ${res.aquiferoSugerido} (${res.totalPocosAnalisados} poços analisados).`,
            'success'
          );
        } else {
          onNotificar?.(
            `Análise concluída (${res.totalPocosAnalisados} poços). Clique na sugestão para aplicar se desejar substituir o valor atual.`,
            'info'
          );
        }
      } else if (res.aviso) {
        onNotificar?.(res.aviso, res.sucesso ? 'info' : 'error');
      }
    } finally {
      setConsultando(false);
    }
  };

  const handleAplicarAquifero = (nomeAquifero: string) => {
    onChange(nomeAquifero);
    setAplicadoAutomaticamente(false);
    onNotificar?.(`Aquífero definido como "${nomeAquifero}".`, 'success');
  };

  const badgeConfianca = (confianca: ResultadoConsultaAquifero['confianca']) => {
    if (confianca === 'alta') {
      return {
        label: 'Confiança Alta',
        classes:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    }
    if (confianca === 'media') {
      return {
        label: 'Confiança Média',
        classes:
          'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
      };
    }
    return {
      label: 'Estimativa Regional',
      classes:
        'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
    };
  };

  const textoOrigemBusca = (res: ResultadoConsultaAquifero) => {
    const partesFonte: string[] = [];
    if (res.totalAna > 0) partesFonte.push(`${res.totalAna} ANA/SNIRH`);
    if (res.totalSupabase > 0) partesFonte.push(`${res.totalSupabase} Supabase`);
    const fontesStr =
      partesFonte.length > 0 ? partesFonte.join(' + ') : 'Sem registros';

    if (res.modoBusca === 'coordenadas') {
      return `Raio ${res.raioKm ?? 35} km via ${res.coordenadasUtilizadas?.origem || 'GPS'} · ${fontesStr}`;
    }
    if (res.modoBusca === 'municipio') {
      const local = [res.municipioConsultado, res.ufConsultada]
        .filter(Boolean)
        .join(' - ');
      return `Estimativa Municipal (${local || 'Região'}) · ${fontesStr}`;
    }
    if (res.modoBusca === 'supabase_apenas') {
      return `Estimativa via Cadastro Supabase · ${fontesStr}`;
    }
    return fontesStr;
  };

  const temResumoHidrodinamico =
    resultado &&
    (resultado.resumoHidrodinamico.profundidadeM !== null ||
      resultado.resumoHidrodinamico.neM !== null ||
      resultado.resumoHidrodinamico.ndM !== null ||
      resultado.resumoHidrodinamico.vazaoM3h !== null);

  return (
    <div className="space-y-2">
      {/* Cabeçalho do Campo + Botão Detectar ANA */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className={
            compacto
              ? 'block text-[11px] font-bold uppercase text-[#6B7A8D]'
              : 'block text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7A8D] dark:text-slate-400'
          }
        >
          {label}
        </label>

        <button
          type="button"
          onClick={handleDetectar}
          disabled={consultando || !contextoBusca.pronto}
          title={contextoBusca.texto}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md border border-[#1B2A3B]/25 dark:border-amber-500/40 bg-[#1B2A3B] hover:bg-[#24384E] dark:bg-[#E8A020] dark:hover:bg-[#d89217] text-white dark:text-[#1B2A3B] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          {consultando ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Compass className="w-3.5 h-3.5" />
          )}
          <span>
            {consultando
              ? 'Consultando ANA...'
              : contextoBusca.modo === 'municipio'
                ? 'Estimar Aquífero (ANA)'
                : 'Detectar Aquífero (ANA)'}
          </span>
        </button>
      </div>

      {/* Input Editável do Aquífero */}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setAplicadoAutomaticamente(false);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={
          compacto
            ? 'w-full px-3 py-2 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-[#E8A020] focus:outline-none'
            : 'w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-[#E8A020] focus:outline-none'
        }
      />

      {/* Dica de contexto antes da primeira consulta */}
      {!resultado && (
        <p className="text-[11px] text-[#6B7A8D] dark:text-slate-400 flex items-center gap-1.5">
          <MapPin className="w-3 h-3 shrink-0 text-[#E8A020]" />
          <span>{contextoBusca.texto}</span>
        </p>
      )}

      {/* Card Comparativo de Referência (Somente Leitura) */}
      {resultado && (
        <div className="rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900/90 overflow-hidden">
          {/* Barra superior do Card */}
          <div className="px-3 py-2 bg-[#1B2A3B]/5 dark:bg-slate-800/80 border-b border-[#DDE3EC] dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Layers className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
              <span className="text-[11px] font-bold text-[#1B2A3B] dark:text-slate-100">
                {textoOrigemBusca(resultado)}
              </span>
              {resultado.sucesso && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${badgeConfianca(resultado.confianca).classes}`}
                >
                  {badgeConfianca(resultado.confianca).label}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B7A8D] hover:text-[#1B2A3B] dark:text-slate-400 dark:hover:text-white"
            >
              <span>{expandido ? 'Recolher' : 'Ver detalhes'}</span>
              {expandido ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {expandido && (
            <div className="p-3 space-y-3">
              {/* Aviso / Erro quando aplicável */}
              {resultado.aviso && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11.5px] text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>{resultado.aviso}</span>
                </div>
              )}

              {/* Distribuição e Sugestões de Aquífero (clique para aplicar) */}
              {resultado.ranking.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                      Aquíferos Identificados na Região (clique para aplicar)
                    </span>
                    {aplicadoAutomaticamente && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <Check className="w-3 h-3" />
                        Sugestão principal aplicada
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {resultado.ranking.map((item) => {
                      const selecionado =
                        value.trim().toLowerCase() === item.nome.toLowerCase();
                      return (
                        <button
                          key={item.nome}
                          type="button"
                          onClick={() => handleAplicarAquifero(item.nome)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                            selecionado
                              ? 'bg-[#1B2A3B] text-white border-[#1B2A3B] dark:bg-[#E8A020] dark:text-[#1B2A3B] dark:border-[#E8A020]'
                              : 'bg-white dark:bg-slate-950 text-[#1B2A3B] dark:text-slate-200 border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020]'
                          }`}
                        >
                          {selecionado && <Check className="w-3 h-3 shrink-0" />}
                          <span>{item.nome}</span>
                          <span
                            className={`text-[10.5px] font-mono ${
                              selecionado
                                ? 'text-[#E8A020] dark:text-[#1B2A3B]/80'
                                : 'text-[#6B7A8D] dark:text-slate-400'
                            }`}
                          >
                            {item.percentual}% ({item.ocorrencias})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resumo Hidrodinâmico dos Poços Vizinhos (Somente Referência) */}
              {temResumoHidrodinamico && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400">
                      Resumo Hidrodinâmico dos Poços Vizinhos
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-[#6B7A8D] dark:text-slate-400">
                      <Info className="w-3 h-3 text-[#E8A020]" />
                      Apenas referência — não altera os dados do seu poço
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 rounded-md bg-white dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400">
                        Profundidade Média
                      </div>
                      <div className="text-xs font-mono font-bold text-[#1B2A3B] dark:text-slate-100 mt-0.5">
                        {resultado.resumoHidrodinamico.profundidadeM
                          ? formatarNumeroBR(
                              resultado.resumoHidrodinamico.profundidadeM.media,
                              'm'
                            )
                          : '—'}
                      </div>
                      {resultado.resumoHidrodinamico.profundidadeM && (
                        <div className="text-[10px] font-mono text-[#6B7A8D] dark:text-slate-500">
                          {resultado.resumoHidrodinamico.profundidadeM.min}–
                          {resultado.resumoHidrodinamico.profundidadeM.max} m (n=
                          {resultado.resumoHidrodinamico.profundidadeM.amostras})
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded-md bg-white dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400">
                        NE Médio
                      </div>
                      <div className="text-xs font-mono font-bold text-[#1B2A3B] dark:text-slate-100 mt-0.5">
                        {resultado.resumoHidrodinamico.neM
                          ? formatarNumeroBR(
                              resultado.resumoHidrodinamico.neM.media,
                              'm'
                            )
                          : '—'}
                      </div>
                      {resultado.resumoHidrodinamico.neM && (
                        <div className="text-[10px] font-mono text-[#6B7A8D] dark:text-slate-500">
                          {resultado.resumoHidrodinamico.neM.min}–
                          {resultado.resumoHidrodinamico.neM.max} m (n=
                          {resultado.resumoHidrodinamico.neM.amostras})
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded-md bg-white dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400">
                        ND Médio
                      </div>
                      <div className="text-xs font-mono font-bold text-[#1B2A3B] dark:text-slate-100 mt-0.5">
                        {resultado.resumoHidrodinamico.ndM
                          ? formatarNumeroBR(
                              resultado.resumoHidrodinamico.ndM.media,
                              'm'
                            )
                          : '—'}
                      </div>
                      {resultado.resumoHidrodinamico.ndM && (
                        <div className="text-[10px] font-mono text-[#6B7A8D] dark:text-slate-500">
                          {resultado.resumoHidrodinamico.ndM.min}–
                          {resultado.resumoHidrodinamico.ndM.max} m (n=
                          {resultado.resumoHidrodinamico.ndM.amostras})
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded-md bg-white dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400">
                        Vazão Média (Q)
                      </div>
                      <div className="text-xs font-mono font-bold text-[#1B2A3B] dark:text-slate-100 mt-0.5">
                        {resultado.resumoHidrodinamico.vazaoM3h
                          ? formatarNumeroBR(
                              resultado.resumoHidrodinamico.vazaoM3h.media,
                              'm³/h'
                            )
                          : '—'}
                      </div>
                      {resultado.resumoHidrodinamico.vazaoM3h && (
                        <div className="text-[10px] font-mono text-[#6B7A8D] dark:text-slate-500">
                          {resultado.resumoHidrodinamico.vazaoM3h.min}–
                          {resultado.resumoHidrodinamico.vazaoM3h.max} (n=
                          {resultado.resumoHidrodinamico.vazaoM3h.amostras})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela Compacta dos Poços Vizinhos (Top 5) */}
              {resultado.pocosReferencia.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7A8D] dark:text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-[#E8A020]" />
                    <span>
                      Poços de Referência Mais Próximos (Top{' '}
                      {Math.min(5, resultado.pocosReferencia.length)} de{' '}
                      {resultado.totalPocosAnalisados})
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#F1F5F9] dark:bg-slate-900 text-[#6B7A8D] dark:text-slate-400 border-b border-[#DDE3EC] dark:border-slate-800">
                          <th className="py-1.5 px-2 font-bold uppercase">Fonte</th>
                          <th className="py-1.5 px-2 font-bold uppercase">
                            Aquífero
                          </th>
                          <th className="py-1.5 px-2 font-bold uppercase">
                            Município / Ref.
                          </th>
                          <th className="py-1.5 px-2 font-bold uppercase text-right">
                            Dist.
                          </th>
                          <th className="py-1.5 px-2 font-bold uppercase text-right">
                            Prof.
                          </th>
                          <th className="py-1.5 px-2 font-bold uppercase text-right">
                            NE / ND
                          </th>
                          <th className="py-1.5 px-2 font-bold uppercase text-right">
                            Vazão
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F7] dark:divide-slate-800/80">
                        {resultado.pocosReferencia.slice(0, 5).map((poco) => (
                          <tr
                            key={poco.id}
                            className="hover:bg-[#F8FAFC] dark:hover:bg-slate-900/60"
                          >
                            <td className="py-1.5 px-2 whitespace-nowrap">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  poco.fonte === 'Supabase'
                                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                    : 'bg-[#1B2A3B]/10 text-[#1B2A3B] dark:bg-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {poco.fonte}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-semibold text-[#1B2A3B] dark:text-slate-100 max-w-[160px] truncate">
                              {poco.aquifero || '—'}
                            </td>
                            <td className="py-1.5 px-2 text-[#475569] dark:text-slate-400 max-w-[150px] truncate">
                              {poco.fonte === 'Supabase'
                                ? poco.identificacao
                                : [poco.municipio, poco.uf]
                                    .filter(Boolean)
                                    .join(' - ') || poco.identificacao}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-right text-[#475569] dark:text-slate-300 whitespace-nowrap">
                              {poco.distanciaKm !== null
                                ? `${poco.distanciaKm.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })} km`
                                : '—'}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-right text-[#1B2A3B] dark:text-slate-200 whitespace-nowrap">
                              {formatarNumeroBR(poco.profundidadeM, 'm')}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-right text-[#475569] dark:text-slate-300 whitespace-nowrap">
                              {poco.neM !== null || poco.ndM !== null
                                ? `${poco.neM !== null ? poco.neM.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'} / ${poco.ndM !== null ? poco.ndM.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'} m`
                                : '—'}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-right font-semibold text-[#1B2A3B] dark:text-slate-100 whitespace-nowrap">
                              {formatarNumeroBR(poco.vazaoM3h, 'm³/h')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

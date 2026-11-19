import React, { useState, useMemo, useRef } from 'react';
import {
  DadosDimensionamentoBomba,
  DadosPocoArtesiano,
  ModeloCatalogoBomba,
} from '../types/relatorio';
import {
  calcularDimensionamentoBomba,
  criarDimensionamentoBombaPadrao,
  excluirModeloCatalogoBomba,
  gerarTemplateCSVBombas,
  importarCatalogoBombasTexto,
  listarCatalogoBombas,
  salvarModeloCatalogoBomba,
} from '../utils/dimensionamentoBomba';
import { fmtNumeroSEMA } from './StepDrawdownSection';
import {
  Calculator,
  Zap,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  Database,
  Upload,
  Plus,
  Trash2,
  Download,
  X,
  ArrowRight,
  Gauge,
} from 'lucide-react';

interface DimensionamentoBombaSectionProps {
  dadosPoco: DadosPocoArtesiano;
  onChangeDimensionamento: (novo: DadosDimensionamentoBomba) => void;
  onAplicarBombaSelecionada: (payload: {
    especificacaoBomba: string;
    painelEletrico: string;
    tuboEdutor?: string;
    profundidadeBomba?: string;
    modeloId: string;
  }) => void;
  showToast: (msg: string, tipo?: 'success' | 'error') => void;
}

export const DimensionamentoBombaSection: React.FC<
  DimensionamentoBombaSectionProps
> = ({
  dadosPoco,
  onChangeDimensionamento,
  onAplicarBombaSelecionada,
  showToast,
}) => {
  const dim: DadosDimensionamentoBomba = useMemo(
    () => ({
      ...criarDimensionamentoBombaPadrao(),
      ...(dadosPoco.dimensionamentoBomba || {}),
    }),
    [dadosPoco.dimensionamentoBomba]
  );

  const [modalBancoAberto, setModalBancoAberto] = useState(false);
  const [versaoCatalogo, setVersaoCatalogo] = useState(0);
  const [textoImportacao, setTextoImportacao] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado para cadastro manual rápido de modelo de bomba
  const [novoFabricante, setNovoFabricante] = useState('Ebara');
  const [novoModelo, setNovoModelo] = useState('');
  const [novoDiamPoco, setNovoDiamPoco] = useState('4');
  const [novaPotenciaCV, setNovaPotenciaCV] = useState('3.0');
  const [novosEstagios, setNovosEstagios] = useState('16');
  const [novaQMin, setNovaQMin] = useState('2.0');
  const [novaQNom, setNovaQNom] = useState('4.5');
  const [novaQMax, setNovaQMax] = useState('6.0');
  const [novaAmtMin, setNovaAmtMin] = useState('50');
  const [novaAmtNom, setNovaAmtNom] = useState('90');
  const [novaAmtMax, setNovaAmtMax] = useState('120');
  const [novoBocal, setNovoBocal] = useState('1.1/2"');

  const resultado = useMemo(
    () => calcularDimensionamentoBomba(dadosPoco),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dadosPoco, versaoCatalogo]
  );

  const catalogoCompleto = useMemo(
    () => listarCatalogoBombas(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versaoCatalogo]
  );

  const atualizarCampo = <K extends keyof DadosDimensionamentoBomba>(
    campo: K,
    valor: DadosDimensionamentoBomba[K]
  ) => {
    onChangeDimensionamento({
      ...dim,
      [campo]: valor,
    });
  };

  const handleSelecionarBombaCatalogo = (bomba: ModeloCatalogoBomba) => {
    const tensao = dim.tensaoAlimentacao || '220V Trifásico';
    const bitolaStr = `3x${fmtNumeroSEMA(
      resultado.bitolaCaboRecomendadaMm2,
      1
    ).replace(',0', '')} mm²`;
    const correnteStr = fmtNumeroSEMA(resultado.correnteEstimadaA, 1);

    onAplicarBombaSelecionada({
      especificacaoBomba: `Motobomba Submersa ${bomba.fabricante} ${
        bomba.modelo
      } — ${fmtNumeroSEMA(bomba.potenciaCV, 1).replace(',0', '')} CV (${
        bomba.estagios
      } estágios | Ø mín. ${bomba.diametroMinPocoPol}" | Recalque ${
        bomba.bocalRecalquePol
      })`,
      painelEletrico: `Quadro de Comando ${fmtNumeroSEMA(
        bomba.potenciaCV,
        1
      ).replace(',0', '')} CV | ${tensao} | I ≈ ${correnteStr} A | Cabo PP Submersível ${bitolaStr} (ΔV = ${fmtNumeroSEMA(
        resultado.quedaTensaoCalculadaPercent,
        2
      )}%)`,
      tuboEdutor:
        dadosPoco.tuboEdutor ||
        `${dim.diametroEdutorPol} ${dim.materialEdutor.split(' ')[0]}`,
      modeloId: bomba.id,
    });
  };

  const handleAdicionarManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoModelo.trim()) {
      showToast('Informe o código/modelo da bomba.', 'error');
      return;
    }
    const num = (v: string, fb: number) => {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : fb;
    };
    salvarModeloCatalogoBomba({
      fabricante: novoFabricante.trim() || 'Fabricante',
      modelo: novoModelo.trim(),
      diametroMinPocoPol: num(novoDiamPoco, 4),
      potenciaCV: num(novaPotenciaCV, 3.0),
      estagios: Math.round(num(novosEstagios, 12)),
      vazaoMinM3h: num(novaQMin, 2.0),
      vazaoNominalM3h: num(novaQNom, 4.0),
      vazaoMaxM3h: num(novaQMax, 6.0),
      amtMinMca: num(novaAmtMin, 50),
      amtNominalMca: num(novaAmtNom, 85),
      amtMaxMca: num(novaAmtMax, 110),
      bocalRecalquePol: novoBocal.trim() || '1.1/2"',
      rendimentoNominalPercent: 60,
    });
    setNovoModelo('');
    setVersaoCatalogo((v) => v + 1);
    showToast('Modelo adicionado ao banco de dados de bombas!', 'success');
  };

  const handleUploadArquivoCatalogo = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const conteudo = String(reader.result || '');
      const res = importarCatalogoBombasTexto(conteudo);
      if (res.sucesso) {
        setVersaoCatalogo((v) => v + 1);
        showToast(res.mensagem, 'success');
      } else {
        showToast(res.mensagem, 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleImportarTextoColado = () => {
    const res = importarCatalogoBombasTexto(textoImportacao);
    if (res.sucesso) {
      setTextoImportacao('');
      setVersaoCatalogo((v) => v + 1);
      showToast(res.mensagem, 'success');
    } else {
      showToast(res.mensagem, 'error');
    }
  };

  const handleBaixarModeloCSV = () => {
    const csv = gerarTemplateCSVBombas();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_banco_bombas_submersas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border-2 border-[#2E75B6]/40 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5 shadow-xs">
      {/* Cabeçalho com Toggle de Inclusão no Relatório + Botão do Banco de Bombas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DDE3EC] dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-lg bg-[#2E75B6]/15 text-[#2E75B6] dark:text-sky-400">
              <Calculator className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#1B2A3B] dark:text-slate-100 uppercase tracking-wide">
              Dimensionamento Hidráulico e Elétrico da Motobomba (AMT, CV e Cabo PP)
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#2E75B6]/15 text-[#2E75B6] dark:text-sky-300">
              ABNT NBR 12.244 / Hazen-Williams
            </span>
          </div>
          <p className="text-xs text-[#6B7A8D] dark:text-slate-400">
            Calcula automaticamente a Altura Manométrica Total (AMT), Potência em CV, Velocidade no Edutor, Bitola do Cabo PP e sugere modelos do catálogo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setModalBancoAberto(true)}
            className="px-3 py-2 text-xs font-bold rounded-lg border border-[#2E75B6] bg-[#F4F8FC] dark:bg-slate-800 text-[#1B2A3B] dark:text-sky-300 hover:bg-[#2E75B6] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span>
              Banco de Bombas ({catalogoCompleto.length} modelos)
            </span>
          </button>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(dim.ativo)}
              onChange={(e) => atualizarCampo('ativo', e.target.checked)}
              className="w-4 h-4 accent-[#E8A020] rounded cursor-pointer"
            />
            <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-200">
              Exibir no Relatório / PDF
            </span>
          </label>
        </div>
      </div>

      {/* Entradas Complementares para Cálculo da AMT e Cabo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            1. Diâmetro do Tubo Edutor
          </label>
          <select
            value={dim.diametroEdutorPol}
            onChange={(e) =>
              atualizarCampo('diametroEdutorPol', e.target.value)
            }
            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
          >
            <option value='1"'>1" (DN 25 mm)</option>
            <option value='1.1/4"'>1.1/4" (DN 32 mm)</option>
            <option value='1.1/2"'>1.1/2" (DN 40 mm)</option>
            <option value='2"'>2" (DN 50 mm)</option>
            <option value='2.1/2"'>2.1/2" (DN 65 mm)</option>
            <option value='3"'>3" (DN 75 mm)</option>
            <option value='4"'>4" (DN 100 mm)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            2. Material do Edutor (Rugosidade C)
          </label>
          <select
            value={dim.materialEdutor}
            onChange={(e) =>
              atualizarCampo(
                'materialEdutor',
                e.target.value as DadosDimensionamentoBomba['materialEdutor']
              )
            }
            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
          >
            <option value="Galvanizado (C=120)">Aço Galvanizado (C=120)</option>
            <option value="PVC Geomecânico (C=140)">
              PVC Geomecânico Aditivado (C=140)
            </option>
            <option value="PEAD (C=140)">PEAD / Mangueira (C=140)</option>
            <option value="Aço Inox (C=140)">Aço Inox (C=140)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            3. Desnível Boca Poço → Reservatório (m)
          </label>
          <input
            type="text"
            value={dim.desnivelExternoM}
            onChange={(e) => atualizarCampo('desnivelExternoM', e.target.value)}
            placeholder="Ex: 15,00"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            4. Distância Horizontal Adutora (m)
          </label>
          <input
            type="text"
            value={dim.distanciaAdutoraM}
            onChange={(e) =>
              atualizarCampo('distanciaAdutoraM', e.target.value)
            }
            placeholder="Ex: 50,00"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            5. Ø Adutora Externa (mm) / Pressão Residual
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={dim.diametroAdutoraMm}
              onChange={(e) =>
                atualizarCampo('diametroAdutoraMm', e.target.value)
              }
              placeholder="Ø mm (50)"
              title="Diâmetro da adutora externa em milímetros (ex: 50 mm)"
              className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
            />
            <input
              type="text"
              value={dim.pressaoResidualMca}
              onChange={(e) =>
                atualizarCampo('pressaoResidualMca', e.target.value)
              }
              placeholder="Pres (3 mca)"
              title="Pressão residual na chegada ao reservatório (m.c.a.)"
              className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            6. Tensão Elétrica de Alimentação
          </label>
          <select
            value={dim.tensaoAlimentacao}
            onChange={(e) =>
              atualizarCampo(
                'tensaoAlimentacao',
                e.target.value as DadosDimensionamentoBomba['tensaoAlimentacao']
              )
            }
            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:border-[#E8A020] focus:outline-none"
          >
            <option value="220V Monofásico">220V Monofásico</option>
            <option value="254V Monofásico">254V Monofásico (Rural)</option>
            <option value="220V Trifásico">220V Trifásico</option>
            <option value="380V Trifásico">380V Trifásico</option>
            <option value="440V Trifásico">440V Trifásico</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            7. Rendimento Bomba η (%)
          </label>
          <input
            type="text"
            value={dim.rendimentoBombaPercent}
            onChange={(e) =>
              atualizarCampo('rendimentoBombaPercent', e.target.value)
            }
            placeholder="Ex: 58"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
            8. Distância Quadro → Boca Poço (m)
          </label>
          <input
            type="text"
            value={dim.distanciaQuadroBocaM}
            onChange={(e) =>
              atualizarCampo('distanciaQuadroBocaM', e.target.value)
            }
            placeholder="Ex: 10,00"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
          />
        </div>
      </div>

      {/* Painel de Resultados de Engenharia em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: AMT Total */}
        <div className="rounded-xl border border-[#2E75B6]/30 bg-[#F4F8FC] dark:bg-slate-950 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-bold uppercase text-[#2E75B6] dark:text-sky-400">
            <span>Altura Manométrica (AMT)</span>
            <Gauge className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold font-mono text-[#1B2A3B] dark:text-white">
            {fmtNumeroSEMA(resultado.amtTotalMca, 2)} m.c.a.
          </div>
          <div className="text-[10.5px] text-[#6B7A8D] dark:text-slate-400 leading-tight">
            Hgeo: {fmtNumeroSEMA(resultado.alturaGeometricaTotalM, 1)}m (ND{' '}
            {fmtNumeroSEMA(resultado.nivelDinamicoM, 1)}m + Ext{' '}
            {fmtNumeroSEMA(resultado.desnivelExternoM, 1)}m) | Perdas:{' '}
            {fmtNumeroSEMA(
              resultado.perdaCargaEdutorMca +
                resultado.perdaCargaAdutoraMca +
                resultado.perdaCargaLocalizadaMca,
              2
            )}{' '}
            m.c.a.
          </div>
        </div>

        {/* Card 2: Potência Recomendada */}
        <div className="rounded-xl border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-950 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-bold uppercase text-[#B86E00] dark:text-[#E8A020]">
            <span>Potência Recomendada</span>
            <Zap className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold font-mono text-[#1B2A3B] dark:text-white">
            {fmtNumeroSEMA(resultado.potenciaMotorRecomendadaCV, 1).replace(
              ',0',
              ''
            )}{' '}
            CV{' '}
            <span className="text-xs font-semibold text-slate-500">
              ({fmtNumeroSEMA(resultado.potenciaMotorRecomendadaKW, 2)} kW)
            </span>
          </div>
          <div className="text-[10.5px] text-[#6B7A8D] dark:text-slate-400 leading-tight">
            P(hid) calculada: {fmtNumeroSEMA(resultado.potenciaHidraulicaCV, 2)}{' '}
            CV para Q = {fmtNumeroSEMA(resultado.vazaoProjetoM3h, 2)} m³/h (η ={' '}
            {Math.round(resultado.rendimentoDecimal * 100)}%)
          </div>
        </div>

        {/* Card 3: Cabo Elétrico PP e Corrente */}
        <div className="rounded-xl border border-emerald-500/35 bg-[#F4FBF7] dark:bg-slate-950 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
            <span>Cabo PP Submersível & Corrente</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold font-mono text-[#1B2A3B] dark:text-white">
            3 ×{' '}
            {fmtNumeroSEMA(resultado.bitolaCaboRecomendadaMm2, 1).replace(
              ',0',
              ''
            )}{' '}
            mm²
          </div>
          <div className="text-[10.5px] text-[#6B7A8D] dark:text-slate-400 leading-tight">
            I ≈ {fmtNumeroSEMA(resultado.correnteEstimadaA, 1)} A (
            {dim.tensaoAlimentacao}) | Cabo:{' '}
            {fmtNumeroSEMA(resultado.comprimentoTotalCaboM, 0)} m | ΔV ={' '}
            {fmtNumeroSEMA(resultado.quedaTensaoCalculadaPercent, 2)}%
          </div>
        </div>

        {/* Card 4: Escoamento no Edutor */}
        <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-bold uppercase text-[#1B2A3B] dark:text-slate-300">
            <span>Escoamento no Edutor</span>
            <Droplets className="w-4 h-4 text-[#2E75B6]" />
          </div>
          <div className="text-base font-extrabold font-mono text-[#1B2A3B] dark:text-white">
            v = {fmtNumeroSEMA(resultado.velocidadeEdutorMs, 2)} m/s
          </div>
          <div className="text-[10.5px] text-[#6B7A8D] dark:text-slate-400 leading-tight">
            Crivo / Posição da Bomba: {fmtNumeroSEMA(resultado.profundidadeBombaM, 1)} m
          </div>
        </div>
      </div>

      {/* Sugestões Automáticas do Banco de Dados de Bombas */}
      <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-950/60 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#E8A020]" />
              Modelos Recomendados no Banco de Bombas para Q ={' '}
              {fmtNumeroSEMA(resultado.vazaoProjetoM3h, 2)} m³/h × AMT ={' '}
              {fmtNumeroSEMA(resultado.amtTotalMca, 1)} m.c.a.
            </h4>
            <p className="text-[11px] text-[#6B7A8D] dark:text-slate-400">
              Clique em <strong>"Aplicar ao Poço"</strong> para preencher automaticamente o modelo da bomba, quadro elétrico e cabo submersível no relatório.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {resultado.modelosRecomendados.map(
            ({ bomba, scoreCompatibilidade, faixaIdeaisTexto }) => {
              const selecionado = dim.modeloSelecionadoId === bomba.id;
              return (
                <div
                  key={bomba.id}
                  className={`rounded-lg border p-3 flex flex-col justify-between gap-2.5 transition-all ${
                    selecionado
                      ? 'border-2 border-[#27AE60] bg-[#F4FBF7] dark:bg-emerald-950/20'
                      : 'border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#E8A020]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#1B2A3B] dark:text-white">
                        {bomba.fabricante} — {bomba.modelo}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          scoreCompatibilidade >= 75
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {scoreCompatibilidade}% compatível
                      </span>
                    </div>
                    <div className="text-[11px] font-mono font-semibold text-[#2E75B6] dark:text-sky-400">
                      {fmtNumeroSEMA(bomba.potenciaCV, 1).replace(',0', '')} CV •{' '}
                      {bomba.estagios} estágios • Ø mín. {bomba.diametroMinPocoPol}" • Bocal{' '}
                      {bomba.bocalRecalquePol}
                    </div>
                    <div className="text-[10.5px] text-[#6B7A8D] dark:text-slate-400">
                      {faixaIdeaisTexto}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelecionarBombaCatalogo(bomba)}
                    className={`w-full px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      selecionado
                        ? 'bg-[#27AE60] text-white'
                        : 'bg-[#1B2A3B] hover:bg-[#2E4260] text-white'
                    }`}
                  >
                    <span>
                      {selecionado
                        ? '✓ Bomba Aplicada ao Relatório'
                        : 'Aplicar Bomba e Cabo ao Poço'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Modal de Gerenciamento e Upload do Banco de Dados de Bombas */}
      {modalBancoAberto && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 bg-[#1B2A3B] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#E8A020] text-[#1B2A3B]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Banco de Dados de Modelos de Bombas Submersas
                  </h3>
                  <p className="text-xs text-slate-300">
                    Suba sua planilha CSV/JSON de curvas de bombas (Ebara, Leão, Schneider, CRI) ou cadastre modelos manualmente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalBancoAberto(false)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Bloco 1: Importar CSV / JSON */}
              <div className="rounded-xl border border-[#2E75B6]/40 bg-[#F4F8FC] dark:bg-slate-950 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold uppercase text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#2E75B6]" />
                    Importar Planilha CSV ou JSON de Modelos de Bombas
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBaixarModeloCSV}
                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-[#E8A020]" />
                      <span>Baixar Planilha Modelo (.CSV)</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.json"
                      onChange={handleUploadArquivoCatalogo}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-[#2E75B6] hover:bg-[#1B2A3B] text-white flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir Arquivo CSV / JSON</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={textoImportacao}
                    onChange={(e) => setTextoImportacao(e.target.value)}
                    placeholder='Ou cole aqui linhas do Excel/CSV no formato: fabricante;modelo;diametroPocoPol;potenciaCV;estagios;vazaoMinM3h;vazaoNominalM3h;vazaoMaxM3h;amtMinMca;amtNominalMca;amtMaxMca;bocalPol;rendimentoPercent'
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#E8A020] focus:outline-none"
                  />
                  {textoImportacao.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportarTextoColado}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A]"
                    >
                      Importar Linhas Coladas
                    </button>
                  )}
                </div>
              </div>

              {/* Bloco 2: Cadastro Rápido Manual */}
              <form
                onSubmit={handleAdicionarManual}
                className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#FAFBFD] dark:bg-slate-950 p-4 space-y-3"
              >
                <div className="text-xs font-extrabold uppercase text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#E8A020]" />
                  Cadastrar Novo Modelo de Bomba Manualmente
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Fabricante
                    </label>
                    <input
                      type="text"
                      value={novoFabricante}
                      onChange={(e) => setNovoFabricante(e.target.value)}
                      placeholder="Ex: Ebara"
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Modelo / Código
                    </label>
                    <input
                      type="text"
                      value={novoModelo}
                      onChange={(e) => setNovoModelo(e.target.value)}
                      placeholder="Ex: 4BPS5F-15"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Potência (CV)
                    </label>
                    <input
                      type="text"
                      value={novaPotenciaCV}
                      onChange={(e) => setNovaPotenciaCV(e.target.value)}
                      placeholder="3.0"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Estágios
                    </label>
                    <input
                      type="text"
                      value={novosEstagios}
                      onChange={(e) => setNovosEstagios(e.target.value)}
                      placeholder="16"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Ø Poço / Bocal
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="text"
                        value={novoDiamPoco}
                        onChange={(e) => setNovoDiamPoco(e.target.value)}
                        placeholder='4"'
                        className="w-full px-2 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      <input
                        type="text"
                        value={novoBocal}
                        onChange={(e) => setNovoBocal(e.target.value)}
                        placeholder='1.1/2"'
                        className="w-full px-2 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Q Mín (m³/h)
                    </label>
                    <input
                      type="text"
                      value={novaQMin}
                      onChange={(e) => setNovaQMin(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Q Nominal (m³/h)
                    </label>
                    <input
                      type="text"
                      value={novaQNom}
                      onChange={(e) => setNovaQNom(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      Q Máx (m³/h)
                    </label>
                    <input
                      type="text"
                      value={novaQMax}
                      onChange={(e) => setNovaQMax(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      AMT Mín (mca)
                    </label>
                    <input
                      type="text"
                      value={novaAmtMin}
                      onChange={(e) => setNovaAmtMin(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      AMT Nom (mca)
                    </label>
                    <input
                      type="text"
                      value={novaAmtNom}
                      onChange={(e) => setNovaAmtNom(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                      AMT Máx (mca)
                    </label>
                    <input
                      type="text"
                      value={novaAmtMax}
                      onChange={(e) => setNovaAmtMax(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Salvar Modelo no Catálogo</span>
                  </button>
                </div>
              </form>

              {/* Bloco 3: Tabela de Modelos Cadastrados */}
              <div>
                <h4 className="text-xs font-extrabold uppercase text-[#1B2A3B] dark:text-slate-200 mb-2">
                  Modelos Disponíveis no Catálogo ({catalogoCompleto.length})
                </h4>
                <div className="overflow-x-auto border border-[#DDE3EC] dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1B2A3B] text-white text-[10.5px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Fabricante / Modelo</th>
                        <th className="py-2 px-2 text-center">Potência</th>
                        <th className="py-2 px-2 text-center">Estágios</th>
                        <th className="py-2 px-2 text-center">Faixa Q (m³/h)</th>
                        <th className="py-2 px-2 text-center">Faixa AMT (m.c.a.)</th>
                        <th className="py-2 px-2 text-center">Bocal</th>
                        <th className="py-2 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                      {catalogoCompleto.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-2 px-3 font-bold text-[#1B2A3B] dark:text-slate-100">
                            {b.fabricante} — {b.modelo}
                            {b.isCustom && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] rounded bg-amber-100 text-amber-800">
                                Custom
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold">
                            {b.potenciaCV} CV
                          </td>
                          <td className="py-2 px-2 text-center font-mono">
                            {b.estagios}
                          </td>
                          <td className="py-2 px-2 text-center font-mono">
                            {b.vazaoMinM3h} – {b.vazaoMaxM3h} (Nom: {b.vazaoNominalM3h})
                          </td>
                          <td className="py-2 px-2 text-center font-mono">
                            {b.amtMinMca} – {b.amtMaxMca} (Nom: {b.amtNominalMca})
                          </td>
                          <td className="py-2 px-2 text-center font-mono">
                            {b.bocalRecalquePol}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelecionarBombaCatalogo(b);
                                  setModalBancoAberto(false);
                                }}
                                className="px-2 py-1 text-[10.5px] font-bold rounded bg-[#2E75B6] text-white hover:bg-[#1B2A3B]"
                              >
                                Usar
                              </button>
                              {b.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    excluirModeloCatalogoBomba(b.id);
                                    setVersaoCatalogo((v) => v + 1);
                                  }}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                  title="Excluir modelo customizado"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Rodapé Modal */}
            <div className="p-4 border-t border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setModalBancoAberto(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#1B2A3B] text-white hover:bg-[#2E4260]"
              >
                Fechar Catálogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

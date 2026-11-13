import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AssinaturaDigital } from '../types/relatorio';
import { Eraser, Check, PenTool, RotateCcw, Upload, Image as ImageIcon } from 'lucide-react';

interface SignaturePadCardProps {
  tituloSlot: string;
  subtituloSlot: string;
  placeholderNome: string;
  placeholderDoc: string;
  placeholderFuncao: string;
  assinaturaAtual?: AssinaturaDigital;
  onSalvarAssinatura: (assinatura: AssinaturaDigital | undefined) => void;
}

const SignaturePadCard: React.FC<SignaturePadCardProps> = ({
  tituloSlot,
  subtituloSlot,
  placeholderNome,
  placeholderDoc,
  placeholderFuncao,
  assinaturaAtual,
  onSalvarAssinatura,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [desenhando, setDesenhando] = useState<boolean>(false);
  const [possuiTracos, setPossuiTracos] = useState<boolean>(false);
  const [imagemCarregadaBase64, setImagemCarregadaBase64] = useState<string | null>(null);
  const [modoEdicaoCanvas, setModoEdicaoCanvas] = useState<boolean>(
    !assinaturaAtual?.dataUrl
  );

  const [nomeSignatario, setNomeSignatario] = useState<string>(
    assinaturaAtual?.nomeSignatario || ''
  );
  const [documento, setDocumento] = useState<string>(
    assinaturaAtual?.documento || ''
  );
  const [funcao, setFuncao] = useState<string>(assinaturaAtual?.funcao || '');
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Sincroniza quando o relatório selecionado muda
  useEffect(() => {
    setNomeSignatario(assinaturaAtual?.nomeSignatario || '');
    setDocumento(assinaturaAtual?.documento || '');
    setFuncao(assinaturaAtual?.funcao || '');
    setModoEdicaoCanvas(!assinaturaAtual?.dataUrl);
    setPossuiTracos(false);
    setImagemCarregadaBase64(null);
    setMensagemErro(null);
  }, [assinaturaAtual]);

  const prepararCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0F172A';
  }, []);

  useEffect(() => {
    if (modoEdicaoCanvas) {
      const timer = window.setTimeout(prepararCanvas, 40);
      return () => window.clearTimeout(timer);
    }
  }, [modoEdicaoCanvas, prepararCanvas]);

  const obterCoordenadas = (
    evento:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in evento) {
      if (evento.touches.length === 0) return null;
      return {
        x: evento.touches[0].clientX - rect.left,
        y: evento.touches[0].clientY - rect.top,
      };
    }

    return {
      x: evento.clientX - rect.left,
      y: evento.clientY - rect.top,
    };
  };

  const iniciarTraco = (
    evento:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const coords = obterCoordenadas(evento);
    const canvas = canvasRef.current;
    if (!coords || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    setDesenhando(true);
    setPossuiTracos(true);
    setMensagemErro(null);
  };

  const desenharTraco = (
    evento:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!desenhando) return;
    const coords = obterCoordenadas(evento);
    const canvas = canvasRef.current;
    if (!coords || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const encerrarTraco = () => {
    if (!desenhando) return;
    setDesenhando(false);
  };

  const handleUploadPNG = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMensagemErro('Por favor, selecione um arquivo de imagem válido (PNG, JPEG ou WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      setImagemCarregadaBase64(dataUrl);
      setPossuiTracos(true);
      setMensagemErro(null);

      // Renderiza a imagem no canvas com transparência
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const maxW = (canvas.width / dpr) - 30;
        const maxH = (canvas.height / dpr) - 30;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const posX = ((canvas.width / dpr) - drawW) / 2;
        const posY = ((canvas.height / dpr) - drawH) / 2;

        ctx.drawImage(img, posX, posY, drawW, drawH);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setPossuiTracos(false);
    setImagemCarregadaBase64(null);
    setMensagemErro(null);
  };

  const confirmarAssinatura = () => {
    if (!nomeSignatario.trim()) {
      setMensagemErro('Informe o nome completo do signatário antes de confirmar.');
      return;
    }

    let dataUrlFinal = assinaturaAtual?.dataUrl || '';

    if (modoEdicaoCanvas) {
      if (imagemCarregadaBase64) {
        dataUrlFinal = imagemCarregadaBase64;
      } else if (possuiTracos && canvasRef.current) {
        dataUrlFinal = canvasRef.current.toDataURL('image/png');
      }
    }

    const novaAssinatura: AssinaturaDigital = {
      dataUrl: dataUrlFinal,
      nomeSignatario: nomeSignatario.trim(),
      documento: documento.trim() || undefined,
      funcao: funcao.trim() || 'Representante Técnico',
      dataRegistro: new Date().toLocaleString('pt-BR'),
    };

    onSalvarAssinatura(novaAssinatura);
    setModoEdicaoCanvas(false);
    setMensagemErro(null);
  };

  const refazerAssinatura = () => {
    onSalvarAssinatura(undefined);
    setModoEdicaoCanvas(true);
    setPossuiTracos(false);
    setImagemCarregadaBase64(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Cabeçalho do Slot */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {tituloSlot}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtituloSlot}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {assinaturaAtual?.dataUrl ? 'Confirmada' : 'Pendente'}
          </span>
        </div>

        {/* Dados do Signatário */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome Completo do Signatário *
            </label>
            <input
              type="text"
              value={nomeSignatario}
              onChange={(e) => setNomeSignatario(e.target.value)}
              placeholder={placeholderNome}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Documento (CPF ou CREA/CAU)
            </label>
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder={placeholderDoc}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Cargo / Função na Obra
            </label>
            <input
              type="text"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              placeholder={placeholderFuncao}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Área do Canvas HTML5 ou Assinatura Gravada */}
        <div className="pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handleUploadPNG}
          />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 font-medium">
              <PenTool className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Quadro de Assinatura (Toque, Mouse ou Upload PNG)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11.5px] text-blue-600 hover:text-blue-700 dark:text-sky-400 font-semibold flex items-center gap-1 hover:underline"
                title="Carregar imagem PNG da assinatura"
              >
                <Upload className="w-3 h-3" />
                <span>Upload PNG</span>
              </button>
              {assinaturaAtual?.dataRegistro && (
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  {assinaturaAtual.dataRegistro}
                </span>
              )}
            </div>
          </div>

          {modoEdicaoCanvas ? (
            <div className="relative rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={iniciarTraco}
                onMouseMove={desenharTraco}
                onMouseUp={encerrarTraco}
                onMouseLeave={encerrarTraco}
                onTouchStart={iniciarTraco}
                onTouchMove={desenharTraco}
                onTouchEnd={encerrarTraco}
                className="w-full h-36 block cursor-crosshair touch-none"
              />
              <div className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-slate-300" />
              {!possuiTracos && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 select-none p-4 text-center">
                  <span>Assine aqui utilizando o dedo, caneta touch ou mouse</span>
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 font-medium">
                    ou clique no botão "Upload PNG" para anexar o arquivo da assinatura
                  </span>
                </div>
              )}
              {imagemCarregadaBase64 && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold shadow-xs">
                  PNG Carregado
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white p-3 flex flex-col items-center justify-center min-h-36">
              {assinaturaAtual?.dataUrl && (
                <img
                  src={assinaturaAtual.dataUrl}
                  alt={`Assinatura de ${assinaturaAtual.nomeSignatario}`}
                  className="max-h-24 object-contain"
                />
              )}
              <div className="w-4/5 border-t border-slate-300 mt-1 pt-1 text-center">
                <p className="text-xs font-semibold text-slate-800">
                  {assinaturaAtual?.nomeSignatario}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {[assinaturaAtual?.funcao, assinaturaAtual?.documento]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {mensagemErro && (
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            {mensagemErro}
          </p>
        )}
      </div>

      {/* Botões de Ação do Pad */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {modoEdicaoCanvas ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={limparCanvas}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Eraser className="w-3.5 h-3.5" />
                Limpar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                Upload PNG
              </button>
            </div>
            <button
              type="button"
              onClick={confirmarAssinatura}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Confirmar Assinatura
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={refazerAssinatura}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar / Alterar Assinatura
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                Substituir por PNG
              </button>
              <button
                type="button"
                onClick={confirmarAssinatura}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-sky-600 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                Atualizar Dados
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface SignatureSectionProps {
  assinaturaResponsavel?: AssinaturaDigital;
  assinaturaCliente?: AssinaturaDigital;
  onChangeResponsavel: (assinatura: AssinaturaDigital | undefined) => void;
  onChangeCliente: (assinatura: AssinaturaDigital | undefined) => void;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({
  assinaturaResponsavel,
  assinaturaCliente,
  onChangeResponsavel,
  onChangeCliente,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SignaturePadCard
        tituloSlot="Responsável Técnico"
        subtituloSlot="Engenheiro Geólogo / Hidrogeólogo habilitado responsável pelo poço e ensaio"
        placeholderNome="Ex.: Eng. Geólogo José Roberto Ribeiro"
        placeholderDoc="Ex.: CREA 5068912410/D"
        placeholderFuncao="Ex.: Responsável Técnico — Engenheiro Geólogo / Hidrogeólogo"
        assinaturaAtual={assinaturaResponsavel}
        onSalvarAssinatura={onChangeResponsavel}
      />

      <SignaturePadCard
        tituloSlot="Responsável pela Elaboração do Relatório"
        subtituloSlot="Profissional ou departamento técnico encarregado da redação, cálculos e consolidação do laudo"
        placeholderNome="Ex.: Departamento Técnico de Hidrogeologia / Geól. Ana Paula"
        placeholderDoc="Ex.: CREA / Matrícula / Registro (opcional)"
        placeholderFuncao="Ex.: Responsável pela Elaboração do Relatório Técnico"
        assinaturaAtual={assinaturaCliente}
        onSalvarAssinatura={onChangeCliente}
      />
    </div>
  );
};

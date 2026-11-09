import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Move,
  Check,
  X,
  RotateCcw,
  RotateCw,
  Crop,
  ChevronRight,
} from 'lucide-react';

export interface ArquivoParaCorte {
  id: string;
  nomeArquivo: string;
  dataUrlOriginal: string;
}

interface ImageCropModalProps {
  filaArquivos: ArquivoParaCorte[];
  indiceInicialNumeroFoto: number;
  onConfirmarFotoCortada: (urlBase64: string, legenda: string) => void;
  onFecharModal: () => void;
}

const TAMANHO_SAIDA_PX = 800; // 800x800px conforme especificação
const TAMANHO_VIEWPORT_PX = 340;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  filaArquivos,
  indiceInicialNumeroFoto,
  onConfirmarFotoCortada,
  onFecharModal,
}) => {
  const [indiceAtual, setIndiceAtual] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [rotacao, setRotacao] = useState<number>(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState<boolean>(false);
  const [inicioArraste, setInicioArraste] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [legenda, setLegenda] = useState<string>('');
  const [erroLegenda, setErroLegenda] = useState<string | null>(null);
  const [imagemCarregada, setImagemCarregada] =
    useState<HTMLImageElement | null>(null);
  const [erroImagem, setErroImagem] = useState<string | null>(null);

  const canvasPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const itemAtual = filaArquivos[indiceAtual];
  const numeroFotoRelatorio = indiceInicialNumeroFoto + indiceAtual;

  useEffect(() => {
    if (!itemAtual) return;
    setErroImagem(null);
    setErroLegenda(null);
    setZoom(1);
    setRotacao(0);
    setOffset({ x: 0, y: 0 });
    setLegenda('');

    const img = new Image();
    img.onload = () => {
      setImagemCarregada(img);
    };
    img.onerror = () => {
      setErroImagem('Não foi possível decodificar o arquivo de imagem selecionado.');
    };
    img.src = itemAtual.dataUrlOriginal;
  }, [itemAtual]);

  const desenharNoCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      tamanhoAlvo: number,
      exibirGradeAuxiliar: boolean
    ) => {
      if (!imagemCarregada) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, tamanhoAlvo, tamanhoAlvo);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, tamanhoAlvo, tamanhoAlvo);

      const radianos = (rotacao * Math.PI) / 180;
      const trocouEixos = Math.abs(rotacao % 180) === 90;
      const imgW = trocouEixos ? imagemCarregada.height : imagemCarregada.width;
      const imgH = trocouEixos ? imagemCarregada.width : imagemCarregada.height;

      const escalaBase = Math.max(tamanhoAlvo / imgW, tamanhoAlvo / imgH);
      const escalaFinal = escalaBase * zoom;

      const fatorProporcao = tamanhoAlvo / TAMANHO_VIEWPORT_PX;
      const deslocamentoX = offset.x * fatorProporcao;
      const deslocamentoY = offset.y * fatorProporcao;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(
        tamanhoAlvo / 2 + deslocamentoX,
        tamanhoAlvo / 2 + deslocamentoY
      );
      ctx.rotate(radianos);
      ctx.scale(escalaFinal, escalaFinal);
      ctx.drawImage(
        imagemCarregada,
        -imagemCarregada.width / 2,
        -imagemCarregada.height / 2
      );
      ctx.restore();

      if (exibirGradeAuxiliar) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        const terco = tamanhoAlvo / 3;
        ctx.beginPath();
        ctx.moveTo(terco, 0);
        ctx.lineTo(terco, tamanhoAlvo);
        ctx.moveTo(terco * 2, 0);
        ctx.lineTo(terco * 2, tamanhoAlvo);
        ctx.moveTo(0, terco);
        ctx.lineTo(tamanhoAlvo, terco);
        ctx.moveTo(0, terco * 2);
        ctx.lineTo(tamanhoAlvo, terco * 2);
        ctx.stroke();
      }
    },
    [imagemCarregada, zoom, rotacao, offset]
  );

  useEffect(() => {
    if (canvasPreviewRef.current && imagemCarregada) {
      desenharNoCanvas(canvasPreviewRef.current, TAMANHO_VIEWPORT_PX, true);
    }
  }, [desenharNoCanvas, imagemCarregada]);

  const iniciarArraste = (clientX: number, clientY: number) => {
    setArrastando(true);
    setInicioArraste({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const moverArraste = (clientX: number, clientY: number) => {
    if (!arrastando) return;
    const limite = 260 * zoom;
    const novoX = Math.max(
      -limite,
      Math.min(limite, clientX - inicioArraste.x)
    );
    const novoY = Math.max(
      -limite,
      Math.min(limite, clientY - inicioArraste.y)
    );
    setOffset({ x: novoX, y: novoY });
  };

  const finalizarArraste = () => {
    setArrastando(false);
  };

  const rotacionar = (graus: number) => {
    setRotacao((atual) => (atual + graus + 360) % 360);
  };

  const confirmarCorteAtual = () => {
    if (!imagemCarregada) return;

    const legendaLimpa = legenda.trim();
    if (!legendaLimpa) {
      setErroLegenda('Digite uma breve legenda técnica para a foto antes de confirmar!');
      return;
    }

    const canvasSaida = document.createElement('canvas');
    canvasSaida.width = TAMANHO_SAIDA_PX;
    canvasSaida.height = TAMANHO_SAIDA_PX;
    desenharNoCanvas(canvasSaida, TAMANHO_SAIDA_PX, false);

    const base64Jpeg = canvasSaida.toDataURL('image/jpeg', 0.88);
    onConfirmarFotoCortada(base64Jpeg, legendaLimpa);

    if (indiceAtual + 1 < filaArquivos.length) {
      setIndiceAtual((prev) => prev + 1);
    } else {
      onFecharModal();
    }
  };

  if (!itemAtual) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Crop className="w-5 h-5 text-[#E8A020] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#1B2A3B] dark:text-slate-100 truncate">
                Enquadrar Evidência Técnica (1:1 Quadrado)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Arraste e use os botões para posicionar ({indiceAtual + 1} de {filaArquivos.length}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFecharModal}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {erroImagem ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {erroImagem}
            </div>
          ) : (
            <div className="flex flex-col items-center bg-[#111] rounded-xl p-2.5 sm:p-3">
              <div
                className="relative w-full max-w-[340px] aspect-square rounded-lg overflow-hidden border-2 border-[#E8A020] bg-slate-950 cursor-grab active:cursor-grabbing touch-none select-none"
                onMouseDown={(e) => iniciarArraste(e.clientX, e.clientY)}
                onMouseMove={(e) => moverArraste(e.clientX, e.clientY)}
                onMouseUp={finalizarArraste}
                onMouseLeave={finalizarArraste}
                onTouchStart={(e) => {
                  if (e.touches.length === 1) {
                    iniciarArraste(
                      e.touches[0].clientX,
                      e.touches[0].clientY
                    );
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches.length === 1) {
                    moverArraste(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
                onTouchEnd={finalizarArraste}
              >
                <canvas
                  ref={canvasPreviewRef}
                  width={TAMANHO_VIEWPORT_PX}
                  height={TAMANHO_VIEWPORT_PX}
                  className="block w-full h-full"
                />
                <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded bg-slate-950/80 text-[11px] text-slate-200 font-mono">
                  <span className="flex items-center gap-1">
                    <Move className="w-3.5 h-3.5 text-[#E8A020]" /> Arraste para mover
                  </span>
                  <span>800×800px (1:1)</span>
                </div>
              </div>
            </div>
          )}

          {/* Barra de Ferramentas do Cropper (Zoom In, Zoom Out, -90°, +90°) */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(3.5, +(z + 0.15).toFixed(2)))
              }
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] hover:text-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ZoomIn className="w-4 h-4" />
              Zoom In
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.8, +(z - 0.15).toFixed(2)))
              }
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] hover:text-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ZoomOut className="w-4 h-4" />
              Zoom Out
            </button>
            <button
              type="button"
              onClick={() => rotacionar(-90)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] hover:text-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              -90°
            </button>
            <button
              type="button"
              onClick={() => rotacionar(90)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#1B2A3B] dark:text-slate-200 hover:border-[#E8A020] hover:text-[#E8A020] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCw className="w-4 h-4" />
              +90°
            </button>
          </div>

          {/* Campo de Legenda Técnica Obrigatória */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1.5">
              Legenda Técnica da Foto #{numeroFotoRelatorio}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={legenda}
              onChange={(e) => {
                setLegenda(e.target.value);
                if (erroLegenda) setErroLegenda(null);
              }}
              placeholder="Ex: Vista da motobomba instalada e teste de vazão"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#E8A020] focus:ring-2 focus:ring-[#E8A020]/20"
            />
            {erroLegenda && (
              <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">
                {erroLegenda}
              </p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-4">
          <button
            type="button"
            onClick={onFecharModal}
            className="px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-[#1B2A3B] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!!erroImagem || !imagemCarregada}
            onClick={confirmarCorteAtual}
            className="px-5 py-2.5 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {indiceAtual + 1 < filaArquivos.length ? (
              <>
                <span>Confirmar e Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmar Foto</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

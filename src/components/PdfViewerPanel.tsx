import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  Loader2,
  AlertCircle,
  UploadCloud,
} from 'lucide-react';

// Configura o Web Worker local empacotado pelo Vite (sem dependência de CDN externo)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfViewerPanelProps {
  blob?: Blob;
  nomeArquivo?: string;
  mimeType?: string;
  onDropArquivos?: (files: FileList) => void;
  onSelecionarPdfs?: () => void;
}

export const PdfViewerPanel: React.FC<PdfViewerPanelProps> = ({
  blob,
  nomeArquivo,
  mimeType,
  onDropArquivos,
  onSelecionarPdfs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [numPaginas, setNumPaginas] = useState<number>(0);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.15);
  const [rotacao, setRotacao] = useState<number>(0);
  const [carregandoDoc, setCarregandoDoc] = useState<boolean>(false);
  const [renderizandoPag, setRenderizandoPag] = useState<boolean>(false);
  const [erroViewer, setErroViewer] = useState<string>('');
  const [imageObjectUrl, setImageObjectUrl] = useState<string>('');
  const [arrastandoSobre, setArrastandoSobre] = useState<boolean>(false);

  const ehImagem =
    Boolean(mimeType && mimeType.startsWith('image/')) ||
    Boolean(nomeArquivo && /\.(jpe?g|png|webp|gif|bmp)$/i.test(nomeArquivo));

  // Carrega o PDF ou URL de imagem quando o blob muda
  useEffect(() => {
    let cancelado = false;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }

    if (pdfDocRef.current) {
      const docAntigo = pdfDocRef.current as unknown as {
        cleanup?: () => Promise<void>;
        destroy?: () => Promise<void>;
      };
      docAntigo.destroy?.().catch(() => {});
      docAntigo.cleanup?.().catch(() => {});
      pdfDocRef.current = null;
    }

    setErroViewer('');
    setNumPaginas(0);
    setPaginaAtual(1);
    setRotacao(0);

    if (!blob) {
      setImageObjectUrl('');
      return;
    }

    if (ehImagem) {
      const objUrl = URL.createObjectURL(blob);
      setImageObjectUrl(objUrl);
      setNumPaginas(1);
      return () => {
        URL.revokeObjectURL(objUrl);
      };
    }

    setImageObjectUrl('');
    setCarregandoDoc(true);

    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    blob
      .arrayBuffer()
      .then((buffer) => {
        if (cancelado) return;
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        return loadingTask.promise;
      })
      .then((doc) => {
        if (!doc || cancelado) {
          const docCancelado = doc as unknown as {
            cleanup?: () => Promise<void>;
            destroy?: () => Promise<void>;
          };
          docCancelado?.destroy?.().catch(() => {});
          docCancelado?.cleanup?.().catch(() => {});
          return;
        }
        pdfDocRef.current = doc;
        setNumPaginas(doc.numPages);
        setPaginaAtual(1);
        setCarregandoDoc(false);
      })
      .catch((err) => {
        if (cancelado) return;
        console.warn('Erro ao carregar PDF para visualização:', err);
        setErroViewer(
          'Não foi possível renderizar este PDF visualmente. Você ainda pode editar os dados ao lado.'
        );
        setCarregandoDoc(false);
      });

    return () => {
      cancelado = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [blob, ehImagem]);

  // Renderiza a página atual no canvas quando página, zoom, rotação ou doc mudam
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || ehImagem || numPaginas === 0) return;

    let cancelado = false;

    const renderizarPagina = async () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }

      setRenderizandoPag(true);
      try {
        const page = await doc.getPage(paginaAtual);
        if (cancelado) return;

        const baseRotation = (page.rotate || 0) + rotacao;
        const viewport = page.getViewport({
          scale: zoom,
          rotation: ((baseRotation % 360) + 360) % 360,
        });

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const task = page.render({
          canvasContext: context,
          viewport,
          transform,
        } as Parameters<typeof page.render>[0]);

        renderTaskRef.current = task;
        await task.promise;
        if (!cancelado) {
          setRenderizandoPag(false);
        }
      } catch (err: unknown) {
        const nomeErro = (err as { name?: string })?.name;
        if (nomeErro === 'RenderingCancelledException' || cancelado) {
          return;
        }
        console.warn('Erro ao renderizar página do PDF:', err);
        if (!cancelado) {
          setRenderizandoPag(false);
        }
      }
    };

    renderizarPagina();

    return () => {
      cancelado = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [paginaAtual, zoom, rotacao, numPaginas, ehImagem, carregandoDoc]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastandoSobre(true);
  };

  const handleDragLeave = () => {
    setArrastandoSobre(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastandoSobre(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0 && onDropArquivos) {
      onDropArquivos(e.dataTransfer.files);
    }
  };

  if (!blob) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`h-full min-h-[480px] flex flex-col items-center justify-center p-8 text-center rounded-xl border-2 border-dashed transition-colors ${
          arrastandoSobre
            ? 'border-[#E8A020] bg-[#E8A020]/10'
            : 'border-[#CBD5E1] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950/60'
        }`}
      >
        <div className="p-4 rounded-2xl bg-[#1B2A3B]/10 dark:bg-slate-800 text-[#1B2A3B] dark:text-[#E8A020] mb-3">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
          Nenhum PDF selecionado no lote
        </h3>
        <p className="text-xs text-[#6B7A8D] dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          Arraste e solte arquivos PDF (ou fotos) de Ordens de Serviço aqui, ou
          use os botões acima para selecionar múltiplos PDFs ou uma pasta inteira.
        </p>
        {onSelecionarPdfs && (
          <button
            type="button"
            onClick={onSelecionarPdfs}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-bold bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A] transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <FileText className="w-4 h-4" />
            Selecionar PDFs de Campo
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full rounded-xl border overflow-hidden bg-slate-800 dark:bg-slate-950 ${
        arrastandoSobre
          ? 'border-[#E8A020] ring-2 ring-[#E8A020]/40'
          : 'border-[#DDE3EC] dark:border-slate-800'
      }`}
    >
      {/* Barra de Controles do Visualizador */}
      <div className="px-3 py-2 bg-[#1B2A3B] text-white border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[#E8A020] shrink-0" />
          <span
            className="text-xs font-semibold truncate max-w-[180px] sm:max-w-[240px]"
            title={nomeArquivo}
          >
            {nomeArquivo || 'Documento PDF'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Navegação de Páginas */}
          {!ehImagem && numPaginas > 0 && (
            <div className="flex items-center bg-white/10 rounded-lg px-1 py-0.5 gap-1">
              <button
                type="button"
                disabled={paginaAtual <= 1}
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                title="Página Anterior"
                className="p-1 rounded hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 whitespace-nowrap">
                Pág. {paginaAtual} / {numPaginas}
              </span>
              <button
                type="button"
                disabled={paginaAtual >= numPaginas}
                onClick={() => setPaginaAtual((p) => Math.min(numPaginas, p + 1))}
                title="Próxima Página"
                className="p-1 rounded hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Controles de Zoom */}
          <div className="flex items-center bg-white/10 rounded-lg px-1 py-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
              title="Diminuir Zoom (-)"
              className="p-1 rounded hover:bg-white/15 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.15)}
              title="Restaurar Zoom Padrão"
              className="px-1.5 text-[11px] font-mono font-bold hover:text-[#E8A020] transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
              title="Aumentar Zoom (+)"
              className="p-1 rounded hover:bg-white/15 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotação */}
          <button
            type="button"
            onClick={() => setRotacao((r) => (r + 90) % 360)}
            title="Girar 90° em sentido horário"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#E8A020]" />
            <span className="hidden sm:inline">{rotacao}°</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setZoom(1.0);
              setRotacao(0);
            }}
            title="Ajustar visualização"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Área de Renderização com Scroll */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-700/90 dark:bg-slate-950 relative min-h-[460px] max-h-[74vh]">
        {(carregandoDoc || renderizandoPag) && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/85 text-white text-[11px] font-semibold shadow-md">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E8A020]" />
            <span>Renderizando...</span>
          </div>
        )}

        {erroViewer ? (
          <div className="m-auto max-w-sm rounded-xl bg-white/95 dark:bg-slate-900 p-5 text-center space-y-2 shadow-lg">
            <AlertCircle className="w-7 h-7 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {erroViewer}
            </p>
          </div>
        ) : ehImagem && imageObjectUrl ? (
          <div className="flex items-center justify-center p-2">
            <img
              src={imageObjectUrl}
              alt={nomeArquivo || 'Ficha de campo'}
              style={{
                transform: `scale(${zoom}) rotate(${rotacao}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 150ms ease',
              }}
              className="max-w-full rounded shadow-2xl bg-white"
            />
          </div>
        ) : (
          <div className="inline-block shadow-2xl bg-white rounded-xs overflow-hidden">
            <canvas ref={canvasRef} className="block" />
          </div>
        )}
      </div>
    </div>
  );
};

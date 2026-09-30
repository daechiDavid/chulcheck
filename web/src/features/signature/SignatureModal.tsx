import { useEffect, useRef } from "react";
import SignaturePad from "signature_pad";
import { Button } from "../../shared/ui.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: (dataUrl: string) => void;
};

export function SignatureModal({ open, onClose, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, {
      penColor: "#1c1712",
      minWidth: 1.4,
      maxWidth: 3.2,
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      const data = pad.toData();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const context = canvas.getContext("2d");
      context?.scale(ratio, ratio);
      pad.clear();
      if (data.length) pad.fromData(data);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-ink/25 md:grid md:place-items-center md:p-6">
      <div
        className="flex min-h-dvh w-full flex-col bg-paper pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:h-[min(80dvh,48rem)] md:min-h-[min(80dvh,48rem)] md:max-w-4xl md:rounded-3xl md:shadow-xl md:pt-0 md:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div>
            <p id="sign-title" className="font-display text-2xl">
              보호자 서명
            </p>
            <p className="text-sm text-muted">화면을 가로로 돌리면 더 넓게 서명할 수 있습니다.</p>
          </div>
          <Button variant="ghost" type="button" onClick={onClose}>
            닫기
          </Button>
        </div>
        <div className="mx-4 my-1 min-h-[160px] flex-1 overflow-hidden rounded-3xl border border-dashed border-line bg-white md:mx-6">
          <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="서명 패드" />
        </div>
        <div className="sticky bottom-0 flex shrink-0 gap-3 border-t border-line bg-paper/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur md:rounded-b-3xl md:px-6 md:pb-4">
          <Button
            variant="line"
            type="button"
            className="flex-1"
            onClick={() => padRef.current?.clear()}
          >
            지우기
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              const pad = padRef.current;
              const canvas = canvasRef.current;
              if (!pad || !canvas || pad.isEmpty()) return;
              const trimmed = trimCanvas(canvas);
              onDone(trimmed.toDataURL("image/png"));
            }}
          >
            완료
          </Button>
        </div>
      </div>
    </div>
  );
}

function trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const context = source.getContext("2d");
  if (!context) return source;
  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 10) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) return source;
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const scale = Math.min(600 / cropWidth, 300 / cropHeight, 1);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(cropWidth * scale));
  output.height = Math.max(1, Math.round(cropHeight * scale));
  output.getContext("2d")?.drawImage(source, left, top, cropWidth, cropHeight, 0, 0, output.width, output.height);
  return output;
}

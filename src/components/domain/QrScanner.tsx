import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onScan: (text: string) => void;
  className?: string;
}

/** Camera QR scanner. Starts on demand (browsers need a user gesture + permission). */
export function QrScanner({ onScan, className }: Props) {
  const rawId = useId();
  const regionId = `qr-${rawId.replace(/:/g, "")}`;
  const scanner = useRef<Html5Qrcode | null>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const cb = useRef(onScan);
  cb.current = onScan;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setRunning(false);
  };

  const start = async () => {
    setError(null);
    try {
      const s = new Html5Qrcode(regionId, { verbose: false });
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }) },
        (text) => {
          const now = Date.now();
          if (text === last.current.text && now - last.current.at < 3000) return; // de-bounce repeats
          last.current = { text, at: now };
          cb.current(text);
        },
        () => undefined,
      );
      setRunning(true);
    } catch (e) {
      scanner.current = null;
      const msg = e instanceof Error ? e.message : String(e);
      setError(/permission|denied|NotAllowed/i.test(msg) ? "Camera permission was denied. Allow camera access in your browser settings, or use manual entry below." : "Couldn't start the camera on this device. Use manual entry below.");
    }
  };

  useEffect(() => () => { void stop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className={cn("overflow-hidden rounded-xl bg-[#0B1326]", className)}>
      <div className="relative aspect-square w-full sm:aspect-[4/3]">
        <div id={regionId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10">{error ? <CameraOff className="h-8 w-8" /> : <Camera className="h-8 w-8" />}</span>
            <p className="max-w-xs text-base text-white/85">{error ?? "Point the camera at a student's boarding pass."}</p>
            <Button size="lg" className="bg-white text-[#14307A] hover:bg-white/90" onClick={start}>
              <Camera className="h-5 w-5" /> {error ? "Try again" : "Start camera"}
            </Button>
          </div>
        )}
        {running && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-white/80" />
            <Button variant="secondary" size="sm" className="absolute bottom-3 right-3" onClick={() => void stop()}>
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, X, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { playSound } from '../utils/audio';

interface CameraBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    // List video devices
    navigator.mediaDevices?.enumerateDevices()
      .then((devices) => {
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          // Prefer back camera ('environment')
          const backCam = videoDevices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[videoDevices.length - 1].deviceId);
        }
      })
      .catch((err) => {
        console.error('Error listing devices:', err);
      });

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    if (activeTrackRef.current) {
      activeTrackRef.current.stop();
      activeTrackRef.current = null;
    }
  };

  useEffect(() => {
    if (!selectedCameraId && cameras.length === 0) return;

    let isMounted = true;
    const codeReader = codeReaderRef.current || new BrowserMultiFormatReader();

    const startScanning = async () => {
      try {
        setError(null);
        if (videoRef.current) {
          await codeReader.decodeFromVideoDevice(
            selectedCameraId || null,
            videoRef.current,
            (result, err) => {
              if (!isMounted) return;
              if (result) {
                const text = result.getText();
                if (text) {
                  playSound('scan');
                  onScan(text);
                }
              }
              if (err && !(err instanceof NotFoundException)) {
                // Not found exception is normal frame scanning
              }
            }
          );

          // Check for torch capability
          const stream = videoRef.current.srcObject as MediaStream;
          if (stream) {
            const track = stream.getVideoTracks()[0];
            activeTrackRef.current = track;
            const capabilities = track.getCapabilities?.() as { torch?: boolean };
            if (capabilities && capabilities.torch) {
              setHasTorch(true);
            }
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Camera scan error:', err);
        setError(`Unable to start camera: ${msg}. Check camera permissions or enter barcode manually.`);
      }
    };

    startScanning();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [selectedCameraId]);

  const toggleTorch = async () => {
    if (!activeTrackRef.current || !hasTorch) return;
    try {
      const nextState = !torchEnabled;
      // @ts-expect-error torch is experimental MediaTrackConstraint
      await activeTrackRef.current.applyConstraints({ advanced: [{ torch: nextState }] });
      setTorchEnabled(nextState);
    } catch (e) {
      console.error('Torch toggle error:', e);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    stopScanner();
    setSelectedCameraId(cameras[nextIndex].deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900/90 border-b border-slate-800 text-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600/30 text-purple-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Live Camera Barcode Scanner</h3>
              <p className="text-[11px] text-slate-400">Align barcode inside the laser target</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          {error ? (
            <div className="p-6 text-center text-rose-300 max-w-xs">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-rose-400" />
              <p className="text-xs font-medium leading-relaxed">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setSelectedCameraId(cameras[0]?.deviceId || '');
                }}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Viewfinder Target Graphic */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="relative w-full max-w-[260px] h-44 border-2 border-purple-400/80 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Glowing Laser Scanline */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse"
                    style={{
                      animation: 'scanline 2s ease-in-out infinite alternate',
                    }}
                  />

                  {/* Corner Accents */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-purple-400 rounded-tl-sm" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-purple-400 rounded-tr-sm" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-purple-400 rounded-bl-sm" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-purple-400 rounded-br-sm" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Switch Cam</span>
              </button>
            )}

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition ${
                  torchEnabled
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Torch</span>
              </button>
            )}
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            EAN-13 · Code 128 · QR
          </span>
        </div>
      </div>
    </div>
  );
};

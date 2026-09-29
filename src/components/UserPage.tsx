import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Camera,
  CheckCircle,
  XCircle,
  PackageCheck,
  Layers,
} from 'lucide-react';
import type { Article } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { WrongCorrectionModal } from './WrongCorrectionModal';

interface UserPageProps {
  articles: Article[];
  onRecordAudit: (
    article: Article,
    result: 'CORRECT' | 'WRONG',
    correctedDays?: number,
    notes?: string
  ) => Promise<void>;
  onUpdateShelfLife: (articleId: string, articleCode: string, newDays: number) => Promise<void>;
}

export const UserPage: React.FC<UserPageProps> = ({
  articles,
  onRecordAudit,
  onUpdateShelfLife,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isWrongModalOpen, setIsWrongModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Helper to check if an article has already been done by user
  const isArticleCompleted = (art: Article): boolean => {
    if (art.status === 'verified' || art.status === 'corrected') return true;
    try {
      const saved = localStorage.getItem('shelflife_completed_articles');
      if (saved) {
        const completedIds: string[] = JSON.parse(saved);
        if (
          completedIds.includes(art.id) ||
          completedIds.includes(art.articleCode) ||
          completedIds.includes(art.barcode)
        ) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  };

  // Only show pending items!
  const pendingArticles = articles.filter((a) => !isArticleCompleted(a));
  const activeArticle = pendingArticles[currentIndex] || null;

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= pendingArticles.length && pendingArticles.length > 0) {
      setCurrentIndex(0);
    }
  }, [pendingArticles.length, currentIndex]);

  // USB Barcode Scanner keydown listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          const scannedCode = buffer.trim();
          buffer = '';
          handleScanOrSearch(scannedCode);
        }
      } else if (e.key.length === 1) {
        if (diff > 120) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingArticles]);

  const handleScanOrSearch = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return;

    setMessage(null);

    // Look for item in pending list
    const foundIdx = pendingArticles.findIndex(
      (a) =>
        a.barcode.toLowerCase() === trimmed ||
        a.articleCode.toLowerCase() === trimmed ||
        a.articleDescription.toLowerCase().includes(trimmed)
    );

    if (foundIdx !== -1) {
      setCurrentIndex(foundIdx);
      setBarcodeInput('');
      return;
    }

    // Check if it's already done
    const doneItem = articles.find(
      (a) =>
        isArticleCompleted(a) &&
        (a.barcode.toLowerCase() === trimmed || a.articleCode.toLowerCase() === trimmed)
    );

    if (doneItem) {
      setMessage(`Item ${doneItem.articleCode} is already completed.`);
    } else {
      setMessage(`Barcode "${query}" not found in catalog.`);
    }

    setTimeout(() => setMessage(null), 3500);
  };

  const handleBarcodeInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleScanOrSearch(barcodeInput.trim());
    }
  };

  // Mark article ID as permanently completed in localStorage
  const markCompletedLocally = (art: Article) => {
    try {
      const saved = localStorage.getItem('shelflife_completed_articles');
      const list: string[] = saved ? JSON.parse(saved) : [];
      list.push(art.id, art.articleCode, art.barcode);
      localStorage.setItem('shelflife_completed_articles', JSON.stringify(Array.from(new Set(list))));
    } catch {
      // ignore
    }
  };

  // CORRECT action
  const handleCorrect = async () => {
    if (!activeArticle) return;
    const item = activeArticle;

    markCompletedLocally(item);

    try {
      await onRecordAudit(item, 'CORRECT');
    } catch (err) {
      console.error('Failed to log audit:', err);
    }
  };

  // WRONG action
  const handleWrong = () => {
    if (!activeArticle) return;
    setIsWrongModalOpen(true);
  };

  // Save wrong correction
  const handleSaveWrongCorrection = async (newDays: number, notes?: string) => {
    if (!activeArticle) return;
    const item = activeArticle;

    markCompletedLocally(item);

    try {
      await onRecordAudit(item, 'WRONG', newDays, notes);
      await onUpdateShelfLife(item.id, item.articleCode, newDays);
    } catch (err) {
      console.error('Failed to save correction:', err);
    }
  };

  const advanceToPrev = () => {
    if (pendingArticles.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + pendingArticles.length) % pendingArticles.length);
  };

  const advanceToNext = () => {
    if (pendingArticles.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % pendingArticles.length);
  };

  return (
    // Mobile compact container: perfectly sized, no scrolling required
    <div className="max-w-md mx-auto p-3 sm:p-4 flex flex-col gap-2.5 min-h-[calc(100dvh-4.5rem)] justify-center select-none">
      {/* Top Banner Message if any */}
      {message && (
        <div className="px-3 py-2 rounded-xl bg-purple-100 text-purple-900 text-xs font-semibold text-center shrink-0 shadow-xs animate-in fade-in">
          {message}
        </div>
      )}

      {/* Unified Inspection Box */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 gap-3">
        {/* 1. Barcode Input Strip arranged INSIDE the Inspection Box */}
        <form onSubmit={handleBarcodeInputSubmit} className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-purple-50/60 border border-purple-200 focus-within:border-purple-600 focus-within:bg-white transition shrink-0">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Scan className="w-4 h-4" />
          </div>

          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Scan or type barcode..."
            className="flex-1 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none bg-transparent px-1"
          />

          {/* Camera Scanner Button */}
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="p-2 rounded-xl bg-white hover:bg-purple-100 text-slate-700 hover:text-purple-800 transition shrink-0 shadow-2xs border border-slate-200 cursor-pointer"
            title="Scan with Camera"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Scan Button */}
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer"
          >
            <span>Scan</span>
          </button>
        </form>

        {pendingArticles.length === 0 ? (
          // All items completed state inside the box
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <PackageCheck className="w-9 h-9" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg mb-1">
              All Items Completed!
            </h3>
            <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
              {articles.length > 0
                ? `Great job! All ${articles.length} articles in the catalog have been verified.`
                : 'No articles currently in the catalog. Ask Admin to upload an Excel file.'}
            </p>
          </div>
        ) : activeArticle ? (
          <>
            {/* 2. Header Strip: Active dot and Barcode */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-black">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-800 uppercase tracking-wide">INSPECTION BOX</span>
              </div>
              <div className="text-xs sm:text-sm font-mono font-black text-emerald-600 tracking-wide">
                {activeArticle.barcode}
              </div>
            </div>

            {/* 3. Data Cards */}
            <div className="space-y-2.5 flex-1 flex flex-col justify-center">
              {/* Top Row: ARTICLE Code and SHELVE LIFE (Side by Side) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Card 1: ARTICLE */}
                <div className="bg-purple-50/80 border border-purple-200/90 rounded-2xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
                    ARTICLE
                  </span>
                  <div className="font-mono font-black text-xl sm:text-2xl text-purple-950 truncate my-0.5">
                    {activeArticle.articleCode}
                  </div>
                  <div className="text-[10px] text-purple-700 font-semibold truncate flex items-center gap-1">
                    <Layers className="w-3 h-3 shrink-0" />
                    <span className="truncate">{activeArticle.category || 'General'}</span>
                  </div>
                </div>

                {/* Card 2: SHELVE LIFE */}
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                      SHELVE LIFE
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-mono">
                      Days
                    </span>
                  </div>
                  <div className="font-mono font-black text-xl sm:text-2xl text-emerald-700 my-0.5">
                    {activeArticle.shelfLifeDays} Days
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    Admin Master
                  </div>
                </div>
              </div>

              {/* Bottom Row: ARTICLE DES - FULL WIDTH so full description is 100% visible! */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    ARTICLE DES
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {activeArticle.articleDescription.length}/40
                  </span>
                </div>
                {/* Full Description with generous room - NO truncating or line clamping */}
                <div className="font-extrabold text-sm sm:text-base text-slate-900 uppercase leading-snug break-words">
                  {activeArticle.articleDescription}
                </div>
              </div>
            </div>

            {/* 4. Two Big Decision Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* CORRECT Button */}
              <button
                type="button"
                onClick={handleCorrect}
                className="py-4 sm:py-4.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition active:scale-[0.98] cursor-pointer"
              >
                <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                <span>CORRECT</span>
              </button>

              {/* WRONG Button */}
              <button
                type="button"
                onClick={handleWrong}
                className="py-4 sm:py-4.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 shadow-md shadow-rose-600/30 transition active:scale-[0.98] cursor-pointer"
              >
                <XCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                <span>WRONG</span>
              </button>
            </div>

            {/* 5. Bottom Navigation: Prev, Item Counter, Next */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs shrink-0">
              <button
                type="button"
                onClick={advanceToPrev}
                disabled={pendingArticles.length <= 1}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition disabled:opacity-40 cursor-pointer"
              >
                &lt; Prev
              </button>

              <span className="font-extrabold text-slate-700 font-mono text-xs">
                Item {currentIndex + 1} of {pendingArticles.length} (Pending)
              </span>

              <button
                type="button"
                onClick={advanceToNext}
                disabled={pendingArticles.length <= 1}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition disabled:opacity-40 cursor-pointer"
              >
                Next &gt;
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Camera Barcode Scanner Modal */}
      {isCameraOpen && (
        <CameraBarcodeScanner
          onScan={(scanned) => {
            setIsCameraOpen(false);
            handleScanOrSearch(scanned);
          }}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Wrong Shelf Life Modal */}
      {activeArticle && isWrongModalOpen && (
        <WrongCorrectionModal
          article={activeArticle}
          isOpen={isWrongModalOpen}
          onClose={() => setIsWrongModalOpen(false)}
          onSaveCorrection={handleSaveWrongCorrection}
        />
      )}
    </div>
  );
};

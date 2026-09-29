import React, { useState } from 'react';
import { X, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import type { Article } from '../types';

interface WrongCorrectionModalProps {
  article: Article;
  isOpen: boolean;
  onClose: () => void;
  onSaveCorrection: (newDays: number, notes?: string) => Promise<void>;
}

const PRESET_DAYS = [3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 180, 365];

export const WrongCorrectionModal: React.FC<WrongCorrectionModalProps> = ({
  article,
  isOpen,
  onClose,
  onSaveCorrection,
}) => {
  const [correctDays, setCorrectDays] = useState<number>(article.shelfLifeDays || 10);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctDays || correctDays < 1) return;
    try {
      setSaving(true);
      await onSaveCorrection(correctDays, notes);
      onClose();
    } catch (err) {
      console.error('Error saving correction:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-600 to-red-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Correct Shelf Life</h3>
              <p className="text-[11px] text-rose-100">Submit correction and advance to next</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Article Info Strip */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="font-mono text-purple-700 font-bold">{article.articleCode}</span>
              <span className="font-mono">{article.barcode}</span>
            </div>
            <div className="font-bold text-slate-800 uppercase tracking-tight text-sm line-clamp-1">
              {article.articleDescription}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <span className="text-slate-500">Admin Uploaded Shelf Life:</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold font-mono">
                {article.shelfLifeDays} Days
              </span>
            </div>
          </div>

          {/* New Shelf Life Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Set Correct Shelf Life (Days)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={9999}
                required
                autoFocus
                value={correctDays}
                onChange={(e) => setCorrectDays(parseInt(e.target.value, 10) || 1)}
                className="w-32 px-4 py-3 rounded-2xl border-2 border-rose-300 focus:border-rose-600 focus:ring-4 focus:ring-rose-100 text-center font-mono font-extrabold text-xl text-slate-900 outline-none"
              />
              <span className="text-sm font-semibold text-slate-500">Days</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_DAYS.map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => setCorrectDays(days)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition ${
                    correctDays === days
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Reason / Notes (optional) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Inspection Note / Reason (Optional)
            </label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g. Supplier printed label mismatch, revised policy"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-200 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save & Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

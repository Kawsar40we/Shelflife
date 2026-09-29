import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import type { Article } from '../types';
import { parseExcelFile, downloadExcelTemplate, exportCatalogToExcel } from '../utils/excel';
import { ConfirmModal } from './ConfirmModal';

interface AdminPageProps {
  articles: Article[];
  onUploadCatalog: (articles: Partial<Article>[]) => Promise<void>;
  onDeleteArticle: (id: string) => Promise<void>;
  onDeleteManyArticles: (ids: string[]) => Promise<void>;
  onClearCatalog: () => Promise<void>;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  articles,
  onUploadCatalog,
  onDeleteArticle,
  onDeleteManyArticles,
  onClearCatalog,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [articles.length]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccessMessage(null);

      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        throw new Error('No valid articles found in spreadsheet.');
      }

      await onUploadCatalog(parsed);
      setUploadSuccessMessage(`Successfully uploaded ${parsed.length} articles from "${file.name}"`);
      setTimeout(() => setUploadSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse Excel file.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const filteredArticles = articles.filter((art) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      art.articleCode.toLowerCase().includes(q) ||
      art.articleDescription.toLowerCase().includes(q) ||
      art.barcode.toLowerCase().includes(q) ||
      art.category.toLowerCase().includes(q)
    );
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredArticles.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await onDeleteManyArticles(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsDeleteSelectedConfirmOpen(false);
    } catch (err) {
      console.error('Error deleting selected items:', err);
    }
  };

  const handleDeleteSingleRow = async (id: string) => {
    try {
      await onDeleteArticle(id);
    } catch (err) {
      console.error('Error deleting article:', err);
    }
  };

  const handleClearAllConfirm = async () => {
    try {
      await onClearCatalog();
      setIsClearConfirmOpen(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error clearing catalog:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
        className="hidden"
      />

      {/* Clean Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-slate-800">
            Catalog: <span className="font-mono text-purple-700">{articles.length}</span> Items
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Excel */}
          <button
            onClick={triggerUploadClick}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading...' : 'Upload Excel'}</span>
          </button>

          {/* Download Template */}
          <button
            onClick={() => downloadExcelTemplate()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Template (.xlsx)</span>
          </button>

          {/* Export Excel */}
          {articles.length > 0 && (
            <button
              onClick={() => exportCatalogToExcel(articles)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          )}

          {/* Clear / Delete All Data */}
          {articles.length > 0 && (
            <button
              onClick={() => setIsClearConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {uploadSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{uploadSuccessMessage}</span>
          </div>
          <button onClick={() => setUploadSuccessMessage(null)} className="font-bold px-1">✕</button>
        </div>
      )}

      {uploadError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="font-bold px-1">✕</button>
        </div>
      )}

      {/* Main Content Area */}
      {articles.length === 0 ? (
        // Simple Empty State Upload Box
        <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-300 text-center shadow-xs">
          <div
            onClick={triggerUploadClick}
            className="max-w-md mx-auto p-8 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/80 cursor-pointer transition flex flex-col items-center justify-center text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 shadow-sm">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 mb-1">
              Click to Upload Excel Sheet or Drag &amp; Drop
            </h4>
            <p className="text-xs text-slate-500">
              Select your prepared .xlsx, .xls, or .csv file
            </p>
          </div>
        </div>
      ) : (
        // Catalog Table
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-3">
          {/* Search bar & Delete Selected */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:border-purple-600 text-xs text-slate-800 outline-none"
              />
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsDeleteSelectedConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredArticles.length > 0 &&
                        filteredArticles.every((a) => selectedIds.has(a.id))
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded text-purple-600 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Articles</th>
                  <th className="py-2.5 px-3">Articles Description</th>
                  <th className="py-2.5 px-3">Barcode</th>
                  <th className="py-2.5 px-3 text-center">Shleflfe (Admin)</th>
                  {/* Additional column showing what user entered on WRONG without touching admin uploaded data */}
                  <th className="py-2.5 px-3 text-center bg-purple-50 text-purple-900">
                    User Updated (Days)
                  </th>
                  <th className="py-2.5 px-3">catgory</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredArticles.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      No articles match your search.
                    </td>
                  </tr>
                ) : (
                  filteredArticles.map((art) => {
                    const isSelected = selectedIds.has(art.id);
                    return (
                      <tr
                        key={art.id}
                        className={`hover:bg-slate-50 transition ${
                          isSelected ? 'bg-purple-50/50' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(art.id)}
                            className="rounded text-purple-600 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-purple-900 whitespace-nowrap">
                          {art.articleCode}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-semibold uppercase max-w-xs truncate">
                          {art.articleDescription}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {art.barcode}
                        </td>
                        {/* Admin uploaded shelf life - untouched! */}
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                          {art.shelfLifeDays} Days
                        </td>
                        {/* User updated shelf life - additional column */}
                        <td className="py-2 px-3 text-center font-mono font-bold whitespace-nowrap bg-purple-50/40">
                          {art.userUpdatedShelfLifeDays !== undefined ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black">
                              {art.userUpdatedShelfLifeDays} Days
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[120px]">
                          {art.category}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {art.status === 'verified' ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Verified
                            </span>
                          ) : art.status === 'corrected' ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                              User Corrected
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteSingleRow(art.id)}
                            className="px-2 py-1 rounded text-rose-600 hover:bg-rose-50 font-bold text-xs transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="Delete All Data?"
        message="This will permanently delete all articles from the catalog across all connected devices and server storage."
        confirmText="Yes, Delete All"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleClearAllConfirm}
        onCancel={() => setIsClearConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isDeleteSelectedConfirmOpen}
        title={`Delete ${selectedIds.size} Selected Items?`}
        message={`Are you sure you want to remove the ${selectedIds.size} selected articles?`}
        confirmText="Yes, Delete Selected"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteSelected}
        onCancel={() => setIsDeleteSelectedConfirmOpen(false)}
      />
    </div>
  );
};

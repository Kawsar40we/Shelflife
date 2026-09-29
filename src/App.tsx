import React, { useState, useEffect } from 'react';
import type { Article, AuditRecord } from './types';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { AdminPage } from './components/AdminPage';
import { UserPage } from './components/UserPage';
import { exportCatalogToExcel } from './utils/excel';
import {
  subscribeToCatalog,
  uploadCatalogToFirestore,
  updateArticleInFirestore,
  deleteArticleFromFirestore,
  deleteMultipleArticlesFromFirestore,
  clearAllCatalogInFirestore,
  recordAuditInFirestore,
  INITIAL_DEFAULT_ARTICLES,
} from './services/firebase';

export default function App() {
  const [role, setRole] = useState<'ADMIN' | 'USER' | null>(() => {
    try {
      const saved = localStorage.getItem('shelflife_user_role');
      if (saved === 'ADMIN' || saved === 'USER') return saved;
    } catch {
      // ignore
    }
    return null;
  });

  const [articles, setArticles] = useState<Article[]>(() => {
    try {
      const isInit = localStorage.getItem('shelflife_catalog_initialized');
      const cached = localStorage.getItem('shelflife_catalog_cache');
      if (isInit === 'true' && cached !== null) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_DEFAULT_ARTICLES;
  });

  const [isLiveSynced, setIsLiveSynced] = useState<boolean>(true);

  const handleSelectRole = (newRole: 'ADMIN' | 'USER') => {
    setRole(newRole);
    try {
      localStorage.setItem('shelflife_user_role', newRole);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setRole(null);
    try {
      localStorage.removeItem('shelflife_user_role');
    } catch {
      // ignore
    }
  };

  /**
   * Real-Time Firebase Synchronization across ALL devices
   * Connects via cloud WebSocket listener so all computers, barcode scanners,
   * iPhones, and Android phones stay 100% in sync at the same second.
   * When data is deleted, empty list [] is honored and permanently stays deleted.
   */
  useEffect(() => {
    const unsubscribe = subscribeToCatalog((realtimeArticles) => {
      setArticles(realtimeArticles);
      setIsLiveSynced(true);
      try {
        localStorage.setItem('shelflife_catalog_cache', JSON.stringify(realtimeArticles));
        localStorage.setItem('shelflife_catalog_initialized', 'true');
      } catch {
        // ignore
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Admin Upload Catalog - Syncs to Cloud Instantly for All Devices
  const handleUploadCatalog = async (uploaded: Partial<Article>[]) => {
    const sanitized: Article[] = uploaded.map((item, idx) => ({
      id: item.id || `art-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      articleCode: String(item.articleCode || `ART-${idx + 1}`).trim(),
      articleDescription: String(item.articleDescription || '').slice(0, 40).trim(),
      barcode: String(item.barcode || '').trim(),
      shelfLifeDays: Number(item.shelfLifeDays) || 1,
      userUpdatedShelfLifeDays: undefined,
      category: String(item.category || 'General').slice(0, 40).trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    }));

    // Optimistic local state update
    setArticles(sanitized);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(sanitized));
      localStorage.setItem('shelflife_catalog_initialized', 'true');
      localStorage.removeItem('shelflife_completed_articles');
    } catch {
      // ignore
    }

    // Sync to Firebase Cloud Firestore for real-time distribution across all devices
    try {
      await uploadCatalogToFirestore(sanitized);
    } catch (err) {
      console.error('Failed to sync upload to Firestore cloud:', err);
    }

    // Also update server backend if in dev mode
    try {
      await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: sanitized }),
      });
    } catch {
      // ignore
    }
  };

  // Delete Single Article Permanently
  const handleDeleteArticle = async (id: string) => {
    const nextArticles = articles.filter((a) => a.id !== id && a.articleCode !== id);
    setArticles(nextArticles);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(nextArticles));
      localStorage.setItem('shelflife_catalog_initialized', 'true');
    } catch {
      // ignore
    }

    try {
      await deleteArticleFromFirestore(id);
    } catch (err) {
      console.error('Failed to delete from Firestore cloud:', err);
    }

    try {
      await fetch(`/api/catalog/article/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
  };

  // Delete Multiple Selected Articles Permanently
  const handleDeleteManyArticles = async (ids: string[]) => {
    const idSet = new Set(ids);
    const nextArticles = articles.filter((a) => !idSet.has(a.id) && !idSet.has(a.articleCode));
    setArticles(nextArticles);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(nextArticles));
      localStorage.setItem('shelflife_catalog_initialized', 'true');
    } catch {
      // ignore
    }

    try {
      await deleteMultipleArticlesFromFirestore(ids);
    } catch (err) {
      console.error('Failed to delete many from Firestore cloud:', err);
    }

    try {
      await fetch('/api/catalog/delete-many', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // ignore
    }
  };

  // Admin Clear All Catalog Data Permanently
  const handleClearCatalog = async () => {
    setArticles([]);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify([]));
      localStorage.setItem('shelflife_catalog_initialized', 'true');
      localStorage.removeItem('shelflife_completed_articles');
    } catch {
      // ignore
    }

    try {
      await clearAllCatalogInFirestore();
    } catch (err) {
      console.error('Failed to clear catalog in Firestore cloud:', err);
    }

    try {
      await fetch('/api/catalog', { method: 'DELETE' });
    } catch {
      // ignore
    }
  };

  // When user updates shelf life on WRONG:
  const handleUpdateShelfLife = async (
    articleId: string,
    articleCode: string,
    newDays: number
  ) => {
    const updates: Partial<Article> = {
      userUpdatedShelfLifeDays: newDays,
      status: 'corrected',
      lastAuditResult: 'WRONG',
      lastVerifiedAt: new Date().toISOString(),
    };

    setArticles((prev) =>
      prev.map((a) => {
        if (a.id === articleId || a.articleCode === articleCode) {
          return {
            ...a,
            ...updates,
          };
        }
        return a;
      })
    );

    try {
      await updateArticleInFirestore(articleId, updates);
    } catch (err) {
      console.error('Failed to update shelf life in Firestore cloud:', err);
    }

    try {
      await fetch('/api/catalog/update-shelflife', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          articleCode,
          newShelfLifeDays: newDays,
        }),
      });
    } catch {
      // ignore
    }
  };

  // Record Audit
  const handleRecordAudit = async (
    article: Article,
    result: 'CORRECT' | 'WRONG',
    correctedDays?: number,
    notes?: string
  ) => {
    const payload: AuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      articleId: article.id,
      articleCode: article.articleCode,
      articleDescription: article.articleDescription,
      barcode: article.barcode,
      category: article.category,
      result,
      adminShelfLifeDays: article.shelfLifeDays,
      userUpdatedShelfLifeDays: correctedDays,
      role: role || 'USER',
      timestamp: new Date().toISOString(),
      notes,
    };

    const updates: Partial<Article> = {
      status: result === 'CORRECT' ? 'verified' : 'corrected',
      lastAuditResult: result,
      lastVerifiedAt: new Date().toISOString(),
      verifiedBy: (role || 'USER') as 'USER' | 'ADMIN',
      ...(correctedDays !== undefined ? { userUpdatedShelfLifeDays: correctedDays } : {}),
    };

    // Optimistic local state update
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id === article.id || a.articleCode === article.articleCode) {
          return {
            ...a,
            ...updates,
          };
        }
        return a;
      })
    );

    // Sync to Cloud Firestore immediately
    try {
      await updateArticleInFirestore(article.id, updates);
      await recordAuditInFirestore(payload);
    } catch (err) {
      console.error('Failed to record audit in Firestore cloud:', err);
    }

    try {
      await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore
    }
  };

  // If no role selected, render Login Screen
  if (!role) {
    return <LoginScreen onSelectRole={handleSelectRole} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      <div>
        <Navbar
          role={role}
          onLogout={handleLogout}
          onExport={() => exportCatalogToExcel(articles)}
          isLiveSynced={isLiveSynced}
        />

        <main className="pb-6">
          {role === 'ADMIN' ? (
            <AdminPage
              articles={articles}
              onUploadCatalog={handleUploadCatalog}
              onDeleteArticle={handleDeleteArticle}
              onDeleteManyArticles={handleDeleteManyArticles}
              onClearCatalog={handleClearCatalog}
            />
          ) : (
            <UserPage
              articles={articles}
              onRecordAudit={handleRecordAudit}
              onUpdateShelfLife={handleUpdateShelfLife}
            />
          )}
        </main>
      </div>
    </div>
  );
}

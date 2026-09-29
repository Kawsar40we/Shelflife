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
      const cached = localStorage.getItem('shelflife_catalog_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
   */
  useEffect(() => {
    const unsubscribe = subscribeToCatalog((realtimeArticles) => {
      if (realtimeArticles && realtimeArticles.length > 0) {
        setArticles(realtimeArticles);
        setIsLiveSynced(true);
        try {
          localStorage.setItem('shelflife_catalog_cache', JSON.stringify(realtimeArticles));
        } catch {
          // ignore
        }
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
  };

  // Delete Single Article
  const handleDeleteArticle = async (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id && a.articleCode !== id));
    try {
      await deleteArticleFromFirestore(id);
    } catch (err) {
      console.error('Failed to delete from Firestore cloud:', err);
    }
  };

  // Delete Multiple Selected Articles
  const handleDeleteManyArticles = async (ids: string[]) => {
    const idSet = new Set(ids);
    setArticles((prev) => prev.filter((a) => !idSet.has(a.id) && !idSet.has(a.articleCode)));
    try {
      await deleteMultipleArticlesFromFirestore(ids);
    } catch (err) {
      console.error('Failed to delete many from Firestore cloud:', err);
    }
  };

  // Admin Clear All Catalog Data Permanently
  const handleClearCatalog = async () => {
    setArticles([]);
    try {
      localStorage.removeItem('shelflife_catalog_cache');
      localStorage.removeItem('shelflife_completed_articles');
      await clearAllCatalogInFirestore();
    } catch (err) {
      console.error('Failed to clear catalog in Firestore cloud:', err);
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

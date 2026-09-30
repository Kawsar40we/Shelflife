import React, { useState, useEffect } from 'react';
import type { Article, AuditRecord } from './types';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { AdminPage } from './components/AdminPage';
import { UserPage } from './components/UserPage';
import { exportCatalogToExcel } from './utils/excel';
import {
  subscribeToCatalog,
  subscribeToLiveAudits,
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
  const [latestActivity, setLatestActivity] = useState<{
    articleCode: string;
    articleDescription: string;
    result: 'CORRECT' | 'WRONG';
    timestamp: string;
  } | null>(null);

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
   * 1. INSTANT REAL-TIME AUDIT STREAM ACROSS ALL DEVICES (PHONE, LAPTOP, TABLET)
   * Whenever ANY user on ANY device audits an article (clicks CORRECT or WRONG),
   * this listener fires within milliseconds and reflects on all other devices immediately.
   */
  useEffect(() => {
    const unsubscribeAudits = subscribeToLiveAudits(
      (audit) => {
        setIsLiveSynced(true);

        setArticles((prev) => {
          let hasChange = false;
          const next = prev.map((a) => {
            const isMatch =
              (audit.barcode && a.barcode === audit.barcode) ||
              (audit.articleCode && a.articleCode === audit.articleCode) ||
              (audit.articleId && a.id === audit.articleId);

            if (isMatch) {
              hasChange = true;
              return {
                ...a,
                status: audit.result === 'CORRECT' ? ('verified' as const) : ('corrected' as const),
                lastAuditResult: audit.result,
                lastVerifiedAt: audit.timestamp,
                verifiedBy: audit.role,
                ...(audit.userUpdatedShelfLifeDays !== undefined
                  ? { userUpdatedShelfLifeDays: audit.userUpdatedShelfLifeDays }
                  : {}),
              };
            }
            return a;
          });

          if (hasChange) {
            try {
              localStorage.setItem('shelflife_catalog_cache', JSON.stringify(next));
            } catch {
              // ignore quota
            }
          }

          return next;
        });

        // Set banner notification for Admin
        setLatestActivity({
          articleCode: audit.articleCode,
          articleDescription: audit.articleDescription,
          result: audit.result,
          timestamp: audit.timestamp,
        });
      },
      (isOnline) => {
        setIsLiveSynced(isOnline);
      }
    );

    return () => {
      unsubscribeAudits();
    };
  }, []);

  /**
   * 2. REAL-TIME CATALOG SYNC FOR NEW UPLOADS & DELETIONS
   */
  useEffect(() => {
    const unsubscribeCatalog = subscribeToCatalog(
      (realtimeArticles) => {
        if (realtimeArticles && realtimeArticles.length > 0) {
          setArticles(realtimeArticles);
          setIsLiveSynced(true);
          try {
            localStorage.setItem('shelflife_catalog_cache', JSON.stringify(realtimeArticles));
            localStorage.setItem('shelflife_catalog_initialized', 'true');
          } catch {
            // ignore
          }
        }
      },
      (isOnline) => {
        setIsLiveSynced(isOnline);
      }
    );

    return () => {
      unsubscribeCatalog();
    };
  }, []);

  /**
   * 3. INSTANT SERVER-SENT EVENTS (SSE) & BACKEND SYNC (<15ms)
   * Broadcasts audits, shelf life updates, and deletions across all devices immediately.
   */
  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource('/api/live-stream');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'audit' && data.audit) {
            const audit: AuditRecord = data.audit;
            setIsLiveSynced(true);

            setArticles((prev) => {
              let hasChange = false;
              const next = prev.map((a) => {
                const isMatch =
                  (audit.barcode && a.barcode === audit.barcode) ||
                  (audit.articleCode && a.articleCode === audit.articleCode) ||
                  (audit.articleId && a.id === audit.articleId);

                if (isMatch) {
                  hasChange = true;
                  return {
                    ...a,
                    status: audit.result === 'CORRECT' ? ('verified' as const) : ('corrected' as const),
                    lastAuditResult: audit.result,
                    lastVerifiedAt: audit.timestamp,
                    verifiedBy: audit.role,
                    ...(audit.userUpdatedShelfLifeDays !== undefined
                      ? { userUpdatedShelfLifeDays: audit.userUpdatedShelfLifeDays }
                      : {}),
                  };
                }
                return a;
              });

              if (hasChange) {
                try {
                  localStorage.setItem('shelflife_catalog_cache', JSON.stringify(next));
                } catch {
                  // ignore
                }
              }
              return next;
            });

            setLatestActivity({
              articleCode: audit.articleCode,
              articleDescription: audit.articleDescription,
              result: audit.result,
              timestamp: audit.timestamp,
            });
          } else if (data.type === 'update-shelflife' && data.article) {
            setArticles((prev) =>
              prev.map((a) =>
                a.id === data.article.id || a.articleCode === data.article.articleCode
                  ? { ...a, ...data.article }
                  : a
              )
            );
          } else if (data.type === 'catalog-cleared') {
            setArticles([]);
          } else if (data.type === 'article-deleted' && data.id) {
            setArticles((prev) => prev.filter((a) => a.id !== data.id && a.articleCode !== data.id));
          } else if (data.type === 'catalog-uploaded' && Array.isArray(data.articles)) {
            setArticles(data.articles);
          }
        } catch {
          // ignore parse error
        }
      };

      es.onerror = () => {
        // Closed or not on backend server
        if (es) {
          es.close();
        }
      };
    } catch {
      // ignore
    }

    // Secondary fallback poll for static environments
    const checkServerAudits = async () => {
      try {
        const res = await fetch('/api/audits');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.audits) && data.audits.length > 0) {
            setArticles((prev) => {
              let changed = false;
              const next = [...prev];
              for (const audit of data.audits) {
                const targetIdx = next.findIndex(
                  (a) =>
                    (audit.barcode && a.barcode === audit.barcode) ||
                    (audit.articleCode && a.articleCode === audit.articleCode) ||
                    (audit.articleId && a.id === audit.articleId)
                );
                if (targetIdx !== -1) {
                  const current = next[targetIdx];
                  const newStatus = audit.result === 'CORRECT' ? 'verified' : 'corrected';
                  if (current.status !== newStatus || current.userUpdatedShelfLifeDays !== audit.userUpdatedShelfLifeDays) {
                    next[targetIdx] = {
                      ...current,
                      status: newStatus,
                      lastAuditResult: audit.result,
                      lastVerifiedAt: audit.timestamp,
                      verifiedBy: audit.role,
                      ...(audit.userUpdatedShelfLifeDays !== undefined
                        ? { userUpdatedShelfLifeDays: audit.userUpdatedShelfLifeDays }
                        : {}),
                    };
                    changed = true;
                  }
                }
              }
              return changed ? next : prev;
            });
          }
        }
      } catch {
        // running on static host
      }
    };

    const interval = setInterval(checkServerAudits, 2000);

    return () => {
      if (es) es.close();
      clearInterval(interval);
    };
  }, []);

  // Admin Upload Catalog - Syncs to Cloud Instantly for All Devices
  const handleUploadCatalog = async (uploaded: Partial<Article>[]) => {
    const sanitized: Article[] = uploaded.map((item, idx) => {
      const code = String(item.articleCode || `ART-${idx + 1}`).trim();
      const bcode = String(item.barcode || '').trim();
      const keySource = bcode || code || String(idx + 1);
      const deterministicId = `art_${keySource.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      return {
        id: deterministicId,
        articleCode: code,
        articleDescription: String(item.articleDescription || '').slice(0, 40).trim(),
        barcode: bcode,
        shelfLifeDays: Number(item.shelfLifeDays) || 1,
        category: String(item.category || 'General').slice(0, 40).trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    });

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

  // Record Audit from Mobile or Computer
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
        const isMatch =
          (article.barcode && a.barcode === article.barcode) ||
          (article.articleCode && a.articleCode === article.articleCode) ||
          (article.id && a.id === article.id);

        if (isMatch) {
          return {
            ...a,
            ...updates,
          };
        }
        return a;
      })
    );

    // 1. Sync to Cloud Firestore instantly (broadcasts to all mobile & computer devices in <100ms)
    try {
      await recordAuditInFirestore(payload);
    } catch (err) {
      console.error('Failed to record audit in Firestore cloud:', err);
    }

    // 2. Also notify backend server if running
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
    return (
      <LoginScreen
        onSelectRole={handleSelectRole}
        itemCount={articles.length}
        isLiveSynced={isLiveSynced}
      />
    );
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
              latestActivity={latestActivity}
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

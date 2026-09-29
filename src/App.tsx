import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Article } from './types';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { AdminPage } from './components/AdminPage';
import { UserPage } from './components/UserPage';
import { exportCatalogToExcel } from './utils/excel';

const DEFAULT_INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-235864',
    articleCode: '235864',
    articleDescription: 'TAMIM TISSUE 200S PACK',
    barcode: '2800003990999',
    shelfLifeDays: 10,
    category: 'Hygiene & Paper',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-102450',
    articleCode: '102450',
    articleDescription: 'ORGANIC WHOLE MILK 1L',
    barcode: '8901030381011',
    shelfLifeDays: 14,
    category: 'Dairy & Fresh',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-319208',
    articleCode: '319208',
    articleDescription: 'ALMARAI GREEK YOGURT 150G',
    barcode: '6281007012345',
    shelfLifeDays: 21,
    category: 'Dairy & Fresh',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-445912',
    articleCode: '445912',
    articleDescription: 'LURPAK SALTED BUTTER 200G',
    barcode: '5740900401821',
    shelfLifeDays: 60,
    category: 'Chilled & Butter',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-556781',
    articleCode: '556781',
    articleDescription: 'FRESH CROISSANT PACK 4S',
    barcode: '6291001029384',
    shelfLifeDays: 3,
    category: 'Bakery & Pastry',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-678120',
    articleCode: '678120',
    articleDescription: 'CHICKEN BREAST FILLET 500G',
    barcode: '6281033004567',
    shelfLifeDays: 5,
    category: 'Fresh Meat',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-789234',
    articleCode: '789234',
    articleDescription: 'ORANGE JUICE FRESH 1L',
    barcode: '6292003049581',
    shelfLifeDays: 7,
    category: 'Beverages',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'art-890123',
    articleCode: '890123',
    articleDescription: 'CLASSIC WHITE SLICED BREAD',
    barcode: '6281011029483',
    shelfLifeDays: 6,
    category: 'Bakery & Pastry',
    status: 'pending',
    createdAt: '2026-09-29T15:00:00.000Z'
  }
];

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
    return DEFAULT_INITIAL_ARTICLES;
  });

  const catalogVersionRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);

  // Check if running on static host (e.g. GitHub Pages) where backend /api/* does not exist
  const isStaticHosting =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('github.io') ||
      window.location.hostname.includes('pages.dev') ||
      window.location.protocol === 'file:');

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

  // Fetch master catalog from server when running in full-stack mode
  const fetchCatalog = useCallback(async () => {
    if (isStaticHosting) return;

    try {
      const res = await fetch('/api/catalog');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.articles)) {
          setArticles(data.articles);
          catalogVersionRef.current = data.version || 0;
          try {
            localStorage.setItem('shelflife_catalog_cache', JSON.stringify(data.articles));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Silent catch for network hiccups
    }
  }, [isStaticHosting]);

  // Live Sync polling (only when not on static host)
  useEffect(() => {
    if (isStaticHosting) return;

    fetchCatalog();

    const interval = setInterval(() => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      fetchCatalog().finally(() => {
        isPollingRef.current = false;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchCatalog, isStaticHosting]);

  // Admin Upload Catalog
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

    setArticles(sanitized);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(sanitized));
      localStorage.removeItem('shelflife_completed_articles');
    } catch {
      // ignore
    }

    if (!isStaticHosting) {
      try {
        const res = await fetch('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles: uploaded }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.articles)) {
            setArticles(data.articles);
            try {
              localStorage.setItem('shelflife_catalog_cache', JSON.stringify(data.articles));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Fallback already saved locally
      }
    }
  };

  // Delete Single Article
  const handleDeleteArticle = async (id: string) => {
    const nextArticles = articles.filter((a) => a.id !== id && a.articleCode !== id);
    setArticles(nextArticles);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(nextArticles));
    } catch {
      // ignore
    }

    if (!isStaticHosting) {
      try {
        const res = await fetch(`/api/catalog/article/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.articles)) {
            setArticles(data.articles);
            try {
              localStorage.setItem('shelflife_catalog_cache', JSON.stringify(data.articles));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Fallback
      }
    }
  };

  // Delete Multiple Selected Articles
  const handleDeleteManyArticles = async (ids: string[]) => {
    const idSet = new Set(ids);
    const nextArticles = articles.filter((a) => !idSet.has(a.id) && !idSet.has(a.articleCode));
    setArticles(nextArticles);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(nextArticles));
    } catch {
      // ignore
    }

    if (!isStaticHosting) {
      try {
        const res = await fetch('/api/catalog/delete-many', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.articles)) {
            setArticles(data.articles);
            try {
              localStorage.setItem('shelflife_catalog_cache', JSON.stringify(data.articles));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Fallback
      }
    }
  };

  // Admin Clear All Catalog Data Permanently
  const handleClearCatalog = async () => {
    setArticles([]);
    try {
      localStorage.removeItem('shelflife_catalog_cache');
      localStorage.removeItem('shelflife_completed_articles');
    } catch {
      // ignore
    }

    if (!isStaticHosting) {
      try {
        await fetch('/api/catalog', { method: 'DELETE' });
      } catch {
        // Fallback
      }
    }
  };

  // When user updates shelf life on WRONG:
  const handleUpdateShelfLife = async (
    articleId: string,
    articleCode: string,
    newDays: number
  ) => {
    const updated = articles.map((a) => {
      if (a.id === articleId || a.articleCode === articleCode) {
        return {
          ...a,
          userUpdatedShelfLifeDays: newDays,
          status: 'corrected' as const,
          lastAuditResult: 'WRONG' as const,
          lastVerifiedAt: new Date().toISOString(),
        };
      }
      return a;
    });

    setArticles(updated);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(updated));
    } catch {
      // ignore
    }

    if (!isStaticHosting) {
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
        // Fallback
      }
    }
  };

  // Record Audit
  const handleRecordAudit = async (
    article: Article,
    result: 'CORRECT' | 'WRONG',
    correctedDays?: number,
    notes?: string
  ) => {
    const payload = {
      articleId: article.id,
      articleCode: article.articleCode,
      articleDescription: article.articleDescription,
      barcode: article.barcode,
      category: article.category,
      result,
      shelfLifeDays: article.shelfLifeDays,
      userUpdatedShelfLifeDays: correctedDays,
      role: role || 'USER',
      notes,
    };

    const updated = articles.map((a) => {
      if (a.id === article.id || a.articleCode === article.articleCode) {
        return {
          ...a,
          status: (result === 'CORRECT' ? 'verified' : 'corrected') as 'verified' | 'corrected',
          lastAuditResult: result,
          lastVerifiedAt: new Date().toISOString(),
          verifiedBy: (role || 'USER') as 'USER' | 'ADMIN',
          userUpdatedShelfLifeDays: correctedDays !== undefined ? correctedDays : a.userUpdatedShelfLifeDays,
        };
      }
      return a;
    });

    setArticles(updated);
    try {
      localStorage.setItem('shelflife_catalog_cache', JSON.stringify(updated));
    } catch {
      // ignore
    }

    if (!isStaticHosting) {
      try {
        const res = await fetch('/api/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.articles)) {
            setArticles(data.articles);
            try {
              localStorage.setItem('shelflife_catalog_cache', JSON.stringify(data.articles));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Fallback
      }
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

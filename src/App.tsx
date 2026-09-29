import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Article } from './types';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { AdminPage } from './components/AdminPage';
import { UserPage } from './components/UserPage';
import { exportCatalogToExcel } from './utils/excel';

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
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return [];
  });

  const catalogVersionRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);

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

  // Fetch master catalog from server
  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
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
    } catch (err) {
      console.warn('Could not fetch catalog:', err);
    }
  }, []);

  // Multi-Device Real-Time Live Sync (every 2.5s)
  // Ensures all computers, tablets, and phones stay synchronized simultaneously
  useEffect(() => {
    fetchCatalog();

    const interval = setInterval(() => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      fetchCatalog().finally(() => {
        isPollingRef.current = false;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchCatalog]);

  // Admin Upload Catalog
  const handleUploadCatalog = async (uploaded: Partial<Article>[]) => {
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles: uploaded }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload catalog to server.');
    }
    const data = await res.json();
    if (Array.isArray(data.articles)) {
      setArticles(data.articles);
      try {
        localStorage.setItem('shelflife_catalog_cache', JSON.stringify(data.articles));
        // Reset completed items on new catalog upload
        localStorage.removeItem('shelflife_completed_articles');
      } catch {
        // ignore
      }
    }
  };

  // Delete Single Article
  const handleDeleteArticle = async (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id && a.articleCode !== id));

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
  };

  // Delete Multiple Selected Articles
  const handleDeleteManyArticles = async (ids: string[]) => {
    const idSet = new Set(ids);
    setArticles((prev) => prev.filter((a) => !idSet.has(a.id) && !idSet.has(a.articleCode)));

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

    await fetch('/api/catalog', { method: 'DELETE' });
  };

  // When user updates shelf life on WRONG:
  // CRITICAL: DO NOT change admin uploaded shelfLifeDays!
  // Store user's input in userUpdatedShelfLifeDays additionally.
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

    await fetch('/api/catalog/update-shelflife', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId,
        articleCode,
        newShelfLifeDays: newDays,
      }),
    });
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
    } catch (err) {
      console.error('Audit submit error:', err);
    }
  };

  // If no role selected, render simplified Login Screen
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

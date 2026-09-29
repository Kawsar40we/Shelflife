import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Article, AuditRecord } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const STORAGE_FILE = path.resolve(__dirname, 'catalog_storage.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

interface StorageData {
  articles: Article[];
  audits: AuditRecord[];
  initialized: boolean;
  version: number;
}

const DEFAULT_SAMPLE_ARTICLES: Article[] = [
  {
    id: 'art-235864',
    articleCode: '235864',
    articleDescription: 'TAMIM TISSUE 200S PACK',
    barcode: '2800003990999',
    shelfLifeDays: 10,
    category: 'Hygiene & Paper',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-102450',
    articleCode: '102450',
    articleDescription: 'ORGANIC WHOLE MILK 1L',
    barcode: '8901030381011',
    shelfLifeDays: 14,
    category: 'Dairy & Fresh',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-319208',
    articleCode: '319208',
    articleDescription: 'ALMARAI GREEK YOGURT 150G',
    barcode: '6281007012345',
    shelfLifeDays: 21,
    category: 'Dairy & Fresh',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-445912',
    articleCode: '445912',
    articleDescription: 'LURPAK SALTED BUTTER 200G',
    barcode: '5740900401821',
    shelfLifeDays: 60,
    category: 'Chilled & Butter',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-556781',
    articleCode: '556781',
    articleDescription: 'FRESH CROISSANT PACK 4S',
    barcode: '6291001029384',
    shelfLifeDays: 3,
    category: 'Bakery & Pastry',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-678120',
    articleCode: '678120',
    articleDescription: 'CHICKEN BREAST FILLET 500G',
    barcode: '6281033004567',
    shelfLifeDays: 5,
    category: 'Fresh Meat',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-789234',
    articleCode: '789234',
    articleDescription: 'ORANGE JUICE FRESH 1L',
    barcode: '6292003049581',
    shelfLifeDays: 7,
    category: 'Beverages',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'art-890123',
    articleCode: '890123',
    articleDescription: 'CLASSIC WHITE SLICED BREAD',
    barcode: '6281011029483',
    shelfLifeDays: 6,
    category: 'Bakery & Pastry',
    status: 'pending',
    createdAt: new Date().toISOString()
  }
];

let storageData: StorageData = {
  articles: [],
  audits: [],
  initialized: false,
  version: 1
};

function loadStorage() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      storageData = {
        articles: Array.isArray(parsed.articles) ? parsed.articles : [],
        audits: Array.isArray(parsed.audits) ? parsed.audits : [],
        initialized: true,
        version: parsed.version || 1
      };
      console.log(`[Storage] Loaded ${storageData.articles.length} articles.`);
    } else {
      storageData = {
        articles: [...DEFAULT_SAMPLE_ARTICLES],
        audits: [],
        initialized: true,
        version: 1
      };
      saveStorage();
      console.log(`[Storage] Initialized storage with default articles.`);
    }
  } catch (err) {
    console.error('[Storage] Error loading storage:', err);
    storageData = { articles: [], audits: [], initialized: true, version: 1 };
  }
}

function saveStorage() {
  try {
    storageData.version = (storageData.version || 1) + 1;
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(storageData, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Error saving storage:', err);
  }
}

loadStorage();

// API Endpoints

// GET /api/catalog
app.get('/api/catalog', (req, res) => {
  res.json({
    articles: storageData.articles,
    lastUpdated: Date.now(),
    version: storageData.version
  });
});

// POST /api/catalog (Upload / Replace master catalog by Admin)
app.post('/api/catalog', (req, res) => {
  const { articles } = req.body;
  if (!Array.isArray(articles)) {
    return res.status(400).json({ error: 'Expected articles array' });
  }

  const sanitized: Article[] = articles.map((item, idx) => {
    const rawDesc = String(item.articleDescription || item['Articles Description'] || item.description || '').trim();
    const rawCat = String(item.category || item['catgory'] || item['Category'] || 'General').trim();
    const rawCode = String(item.articleCode || item['Articles'] || item.code || `ART-${idx + 1}`).trim();
    const rawBarcode = String(item.barcode || item['Barcode'] || '').trim();
    const rawShelfLife = parseInt(String(item.shelfLifeDays || item['Shleflfe'] || item['Shelflife'] || item['Shelve Life'] || 1), 10);

    return {
      id: item.id || `art-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      articleCode: rawCode,
      articleDescription: rawDesc.slice(0, 40),
      barcode: rawBarcode,
      shelfLifeDays: isNaN(rawShelfLife) || rawShelfLife < 1 ? 1 : rawShelfLife,
      userUpdatedShelfLifeDays: undefined, // New admin upload resets user corrections
      category: rawCat.slice(0, 40),
      status: 'pending',
      createdAt: item.createdAt || new Date().toISOString()
    };
  });

  storageData.articles = sanitized;
  // Clear past audits for old catalog
  storageData.audits = [];
  saveStorage();

  res.json({
    success: true,
    count: storageData.articles.length,
    articles: storageData.articles,
    version: storageData.version
  });
});

// DELETE /api/catalog/article/:id
app.delete('/api/catalog/article/:id', (req, res) => {
  const targetId = req.params.id;
  const initialLength = storageData.articles.length;
  storageData.articles = storageData.articles.filter(a => a.id !== targetId && a.articleCode !== targetId);

  if (storageData.articles.length !== initialLength) {
    saveStorage();
  }

  res.json({
    success: true,
    deleted: initialLength - storageData.articles.length,
    articles: storageData.articles,
    version: storageData.version
  });
});

// POST /api/catalog/delete-many
app.post('/api/catalog/delete-many', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const idSet = new Set(ids);
  const initialLength = storageData.articles.length;
  storageData.articles = storageData.articles.filter(a => !idSet.has(a.id) && !idSet.has(a.articleCode));

  saveStorage();

  res.json({
    success: true,
    deleted: initialLength - storageData.articles.length,
    articles: storageData.articles,
    version: storageData.version
  });
});

// DELETE /api/catalog (Admin deletes full data)
app.delete('/api/catalog', (req, res) => {
  storageData.articles = [];
  storageData.audits = [];
  saveStorage();
  res.json({
    success: true,
    message: 'Catalog cleared',
    articles: [],
    version: storageData.version
  });
});

// POST /api/catalog/update-shelflife
// CRITICAL: DO NOT change admin uploaded shelfLifeDays!
// Store user's updated value in userUpdatedShelfLifeDays additionally.
app.post('/api/catalog/update-shelflife', (req, res) => {
  const { articleId, articleCode, newShelfLifeDays } = req.body;
  const days = parseInt(String(newShelfLifeDays), 10);
  if (isNaN(days) || days < 1) {
    return res.status(400).json({ error: 'Invalid shelf life days' });
  }

  const article = storageData.articles.find(a => a.id === articleId || a.articleCode === articleCode);
  if (article) {
    // Keep article.shelfLifeDays untouched!
    // Store user's input in userUpdatedShelfLifeDays
    article.userUpdatedShelfLifeDays = days;
    article.status = 'corrected';
    article.lastAuditResult = 'WRONG';
    article.lastVerifiedAt = new Date().toISOString();
    saveStorage();
  }

  res.json({
    success: true,
    article,
    articles: storageData.articles,
    version: storageData.version
  });
});

// GET /api/audits
app.get('/api/audits', (req, res) => {
  res.json({
    audits: storageData.audits,
    lastUpdated: Date.now()
  });
});

// POST /api/audits
app.post('/api/audits', (req, res) => {
  const {
    articleId,
    articleCode,
    articleDescription,
    barcode,
    category,
    result,
    shelfLifeDays,
    userUpdatedShelfLifeDays,
    role,
    deviceId,
    notes
  } = req.body;

  const target = storageData.articles.find(a => a.id === articleId || a.articleCode === articleCode || a.barcode === barcode);

  const newAudit: AuditRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    articleId: String(articleId || ''),
    articleCode: String(articleCode || ''),
    articleDescription: String(articleDescription || '').slice(0, 40),
    barcode: String(barcode || ''),
    category: String(category || '').slice(0, 40),
    result: result === 'WRONG' ? 'WRONG' : 'CORRECT',
    adminShelfLifeDays: target ? target.shelfLifeDays : parseInt(String(shelfLifeDays || 0), 10),
    userUpdatedShelfLifeDays: userUpdatedShelfLifeDays ? parseInt(String(userUpdatedShelfLifeDays), 10) : undefined,
    role: role === 'ADMIN' ? 'ADMIN' : 'USER',
    deviceId: deviceId || 'Device',
    notes: notes ? String(notes).slice(0, 120) : undefined
  };

  storageData.audits.unshift(newAudit);
  if (storageData.audits.length > 500) {
    storageData.audits = storageData.audits.slice(0, 500);
  }

  // Update article status without overwriting admin's shelfLifeDays!
  if (target) {
    target.status = result === 'CORRECT' ? 'verified' : 'corrected';
    target.lastAuditResult = result;
    target.lastVerifiedAt = newAudit.timestamp;
    target.verifiedBy = newAudit.role;
    if (result === 'WRONG' && newAudit.userUpdatedShelfLifeDays) {
      target.userUpdatedShelfLifeDays = newAudit.userUpdatedShelfLifeDays;
    }
  }

  saveStorage();

  res.json({
    success: true,
    audit: newAudit,
    auditsCount: storageData.audits.length,
    articles: storageData.articles,
    version: storageData.version
  });
});

// Vite Middleware & Static Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shelf Life Checking server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

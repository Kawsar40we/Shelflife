import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import type { Article, AuditRecord } from '../types';

// Provisioned Firebase project configuration
export const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-e9319",
  appId: "1:605680624301:web:d81c34675a232a43e61c24",
  apiKey: "AIzaSyA1wdQDyHFI176yaYX733KAah3hM1whOko",
  authDomain: "ai-studio-applet-webapp-e9319.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-shelvelifechecki-17b6d5ff-07d3-4c96-a73b-d11b58695897",
  storageBucket: "ai-studio-applet-webapp-e9319.firebasestorage.app",
  messagingSenderId: "605680624301",
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const CATALOG_COLLECTION = 'catalog';
const AUDITS_COLLECTION = 'audits';
const META_DOC = 'status';

/**
 * CRITICAL HELPER: Cloud Firestore throws a fatal error if any field value is `undefined`.
 * This recursive cleaner strips all `undefined` properties before sending data to Firestore.
 */
export function cleanForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        clean[key] = cleanForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export const INITIAL_DEFAULT_ARTICLES: Article[] = [
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

/**
 * Real-Time Catalog Listener:
 * Subscribes to Firestore `catalog` collection. Whenever ANY device adds, deletes,
 * or verifies an article, this callback fires INSTANTLY on all connected devices.
 * Uses both direct getDocs for immediate mobile hydration and onSnapshot for live updates.
 */
export function subscribeToCatalog(onUpdate: (articles: Article[]) => void) {
  const colRef = collection(db, CATALOG_COLLECTION);

  // Fast direct load for mobile network connection
  getDocs(colRef).then((snapshot) => {
    const list: Article[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ ...(docSnap.data() as Article), id: docSnap.id });
    });
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    onUpdate(list);
  }).catch((err) => {
    console.warn('Initial direct load warning:', err);
  });

  // Real-time live WebSocket listener
  return onSnapshot(
    colRef,
    (snapshot) => {
      const articles: Article[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Article;
        articles.push({
          ...data,
          id: docSnap.id,
        });
      });

      // Stable chronological order
      articles.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });

      onUpdate(articles);
    },
    (error) => {
      console.error('Firestore Real-time Sync Error:', error);
    }
  );
}

/**
 * Upload/Replace entire catalog from Admin Excel upload to Cloud Firestore
 * Sanitizes all items to prevent any `undefined` values from failing batch commits.
 */
export async function uploadCatalogToFirestore(articles: Article[]): Promise<void> {
  const colRef = collection(db, CATALOG_COLLECTION);
  
  // 1. Delete existing articles in safe batches of 400
  const existingSnap = await getDocs(colRef);
  const existingDocs = existingSnap.docs;
  for (let i = 0; i < existingDocs.length; i += 400) {
    const batch = writeBatch(db);
    existingDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 2. Write new articles in safe batches of 400 with strict cleaning
  for (let i = 0; i < articles.length; i += 400) {
    const batch = writeBatch(db);
    articles.slice(i, i + 400).forEach((art, idx) => {
      const docId = String(art.id || `art-${art.articleCode || idx + 1}`).replace(/[\/\\]/g, '_');
      const ref = doc(db, CATALOG_COLLECTION, docId);

      const rawPayload: Record<string, any> = {
        id: docId,
        articleCode: String(art.articleCode || `ART-${idx + 1}`).trim(),
        articleDescription: String(art.articleDescription || '').slice(0, 40).trim(),
        barcode: String(art.barcode || '').trim(),
        shelfLifeDays: Number(art.shelfLifeDays) || 1,
        category: String(art.category || 'General').slice(0, 40).trim(),
        status: art.status || 'pending',
        createdAt: art.createdAt || new Date().toISOString(),
      };

      if (art.userUpdatedShelfLifeDays !== undefined && art.userUpdatedShelfLifeDays !== null) {
        rawPayload.userUpdatedShelfLifeDays = Number(art.userUpdatedShelfLifeDays);
      }
      if (art.lastAuditResult) {
        rawPayload.lastAuditResult = art.lastAuditResult;
      }
      if (art.lastVerifiedAt) {
        rawPayload.lastVerifiedAt = art.lastVerifiedAt;
      }
      if (art.verifiedBy) {
        rawPayload.verifiedBy = art.verifiedBy;
      }

      const cleaned = cleanForFirestore(rawPayload);
      batch.set(ref, cleaned);
    });
    await batch.commit();
  }

  // 3. Update meta status
  try {
    const metaRef = doc(db, 'meta', META_DOC);
    await setDoc(metaRef, {
      initialized: true,
      lastUploadedAt: new Date().toISOString(),
      itemCount: articles.length,
    }, { merge: true });
  } catch (err) {
    console.warn('Meta status write warning:', err);
  }
}

/**
 * Update single article in Firestore (e.g. status, corrected shelf life)
 */
export async function updateArticleInFirestore(
  articleId: string,
  updates: Partial<Article>
): Promise<void> {
  const cleaned = cleanForFirestore(updates);
  const ref = doc(db, CATALOG_COLLECTION, articleId);
  await setDoc(ref, cleaned, { merge: true });
}

/**
 * Delete single article permanently from Firestore
 */
export async function deleteArticleFromFirestore(articleId: string): Promise<void> {
  const ref = doc(db, CATALOG_COLLECTION, articleId);
  await deleteDoc(ref);

  // Also query to catch any doc matching articleCode
  try {
    const q = query(collection(db, CATALOG_COLLECTION), where('articleCode', '==', articleId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch {
    // ignore
  }
}

/**
 * Delete multiple articles permanently from Firestore
 */
export async function deleteMultipleArticlesFromFirestore(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const ref = doc(db, CATALOG_COLLECTION, id);
    batch.delete(ref);
  });
  await batch.commit();

  try {
    const idSet = new Set(ids);
    const snap = await getDocs(collection(db, CATALOG_COLLECTION));
    const toDeleteDocs = snap.docs.filter((d) => {
      const data = d.data() as Article;
      return idSet.has(d.id) || idSet.has(data.articleCode) || idSet.has(data.id);
    });
    if (toDeleteDocs.length > 0) {
      const cleanBatch = writeBatch(db);
      toDeleteDocs.forEach((d) => cleanBatch.delete(d.ref));
      await cleanBatch.commit();
    }
  } catch {
    // ignore
  }
}

/**
 * Clear entire catalog permanently from Firestore
 */
export async function clearAllCatalogInFirestore(): Promise<void> {
  const colRef = collection(db, CATALOG_COLLECTION);
  const snap = await getDocs(colRef);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  try {
    const metaRef = doc(db, 'meta', META_DOC);
    await setDoc(metaRef, {
      initialized: true,
      clearedAt: new Date().toISOString(),
      itemCount: 0,
    });
  } catch {
    // ignore
  }
}

/**
 * Record audit log entry in Firestore
 */
export async function recordAuditInFirestore(audit: AuditRecord): Promise<void> {
  const id = audit.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ref = doc(db, AUDITS_COLLECTION, id);
  const cleaned = cleanForFirestore({
    ...audit,
    id,
    timestamp: new Date().toISOString(),
  });
  await setDoc(ref, cleaned);
}

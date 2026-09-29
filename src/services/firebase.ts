import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import type { Article, AuditRecord } from '../types';

// Configuration from provisioned Firebase project
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

// Initialize Firestore with specific database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const CATALOG_COLLECTION = 'catalog';
const AUDITS_COLLECTION = 'audits';

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
 */
export function subscribeToCatalog(onUpdate: (articles: Article[]) => void) {
  const colRef = collection(db, CATALOG_COLLECTION);

  // Check if DB is completely empty on first run, seed default articles
  getDocs(query(colRef, limit(1))).then((snapshot) => {
    if (snapshot.empty) {
      seedInitialCatalog();
    }
  }).catch((err) => {
    console.warn('Initial catalog check error:', err);
  });

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
      // Sort to preserve order
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
 * Seed initial catalog if empty
 */
async function seedInitialCatalog() {
  try {
    const batch = writeBatch(db);
    INITIAL_DEFAULT_ARTICLES.forEach((article) => {
      const ref = doc(db, CATALOG_COLLECTION, article.id);
      batch.set(ref, article);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Could not seed initial catalog:', err);
  }
}

/**
 * Upload/Replace entire catalog from Admin Excel upload
 */
export async function uploadCatalogToFirestore(articles: Article[]) {
  // First delete existing articles in chunks
  const colRef = collection(db, CATALOG_COLLECTION);
  const existingSnap = await getDocs(colRef);

  const existingDocs = existingSnap.docs;
  // Firestore batches allow max 500 ops per commit
  for (let i = 0; i < existingDocs.length; i += 400) {
    const batch = writeBatch(db);
    existingDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Now write new articles in batches
  for (let i = 0; i < articles.length; i += 400) {
    const batch = writeBatch(db);
    articles.slice(i, i + 400).forEach((art) => {
      const ref = doc(db, CATALOG_COLLECTION, art.id);
      batch.set(ref, art);
    });
    await batch.commit();
  }
}

/**
 * Update single article in Firestore (e.g. status, corrected shelf life)
 */
export async function updateArticleInFirestore(
  articleId: string,
  updates: Partial<Article>
) {
  const ref = doc(db, CATALOG_COLLECTION, articleId);
  await setDoc(ref, updates, { merge: true });
}

/**
 * Delete single article
 */
export async function deleteArticleFromFirestore(articleId: string) {
  const ref = doc(db, CATALOG_COLLECTION, articleId);
  await deleteDoc(ref);
}

/**
 * Delete multiple articles
 */
export async function deleteMultipleArticlesFromFirestore(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const ref = doc(db, CATALOG_COLLECTION, id);
    batch.delete(ref);
  });
  await batch.commit();
}

/**
 * Clear entire catalog
 */
export async function clearAllCatalogInFirestore() {
  const colRef = collection(db, CATALOG_COLLECTION);
  const snap = await getDocs(colRef);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Record audit log entry in Firestore
 */
export async function recordAuditInFirestore(audit: AuditRecord) {
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ref = doc(db, AUDITS_COLLECTION, id);
  await setDoc(ref, {
    ...audit,
    id,
    timestamp: new Date().toISOString(),
  });
}

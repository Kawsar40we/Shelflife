export interface Article {
  id: string;
  articleCode: string;               // Column: Articles
  articleDescription: string;        // Column: Articles Description (max 40 chars)
  barcode: string;                   // Column: Barcode
  shelfLifeDays: number;             // Admin uploaded shelf life (stays untouched!)
  userUpdatedShelfLifeDays?: number; // Additional field updated by user when clicking WRONG
  category: string;                  // Column: catgory / Category (max 40 chars)
  status?: 'pending' | 'verified' | 'corrected';
  lastAuditResult?: 'CORRECT' | 'WRONG';
  lastVerifiedAt?: string;
  verifiedBy?: 'USER' | 'ADMIN';
  createdAt?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  articleId: string;
  articleCode: string;
  articleDescription: string;
  barcode: string;
  category: string;
  result: 'CORRECT' | 'WRONG';
  adminShelfLifeDays: number;
  userUpdatedShelfLifeDays?: number;
  role: 'USER' | 'ADMIN';
  deviceId?: string;
  notes?: string;
}

export interface CatalogState {
  articles: Article[];
  lastUpdated: number;
  version: number;
}

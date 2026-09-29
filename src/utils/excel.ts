import * as XLSX from 'xlsx';
import type { Article } from '../types';

export function parseExcelFile(file: File): Promise<Partial<Article>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Grab the first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('The uploaded spreadsheet contains no sheets.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('The spreadsheet contains no rows of data.');
        }

        const parsedArticles: Partial<Article>[] = [];

        rawJson.forEach((row, index) => {
          // Normalize keys to lowercase trimmed
          const normalizedRow: Record<string, unknown> = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[key.trim().toLowerCase()] = row[key];
          });

          // Helper to find matching column value
          const findValue = (aliases: string[]): string => {
            for (const alias of aliases) {
              const lower = alias.toLowerCase();
              if (normalizedRow[lower] !== undefined && normalizedRow[lower] !== '') {
                return String(normalizedRow[lower]).trim();
              }
            }
            return '';
          };

          const rawCode = findValue(['articles', 'article', 'sku', 'code', 'article code', 'item code']);
          const rawDesc = findValue(['articles description', 'description', 'article description', 'desc', 'item description', 'name']);
          const rawBarcode = findValue(['barcode', 'bar code', 'upc', 'ean', 'ean13', 'item barcode']);
          const rawShelfLife = findValue(['shleflfe', 'shelflife', 'shelve life', 'shelf life', 'shelve life days', 'shelf life days', 'days']);
          const rawCategory = findValue(['catgory', 'category', 'cat', 'dept', 'department']);

          // Skip completely empty rows
          if (!rawCode && !rawDesc && !rawBarcode && !rawShelfLife) {
            return;
          }

          const shelfLifeNum = parseInt(rawShelfLife || '1', 10);

          parsedArticles.push({
            id: `art-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            articleCode: rawCode || `ITEM-${index + 1}`,
            // Strictly enforce max 40 characters
            articleDescription: rawDesc.slice(0, 40) || 'UNTITLED ITEM',
            barcode: rawBarcode || `BAR-${Date.now().toString().slice(-6)}${index}`,
            shelfLifeDays: isNaN(shelfLifeNum) || shelfLifeNum < 1 ? 1 : shelfLifeNum,
            // Strictly enforce max 40 characters
            category: rawCategory.slice(0, 40) || 'General',
            status: 'pending',
            createdAt: new Date().toISOString()
          });
        });

        if (parsedArticles.length === 0) {
          throw new Error('No valid article records found in spreadsheet.');
        }

        resolve(parsedArticles);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'));
    };

    reader.readAsBinaryString(file);
  });
}

export function downloadExcelTemplate(): void {
  // Columns requested:
  // Articles, Articles Description (max 40 chars), Barcode, Shleflfe, catgory
  const templateData = [
    {
      'Articles': '235864',
      'Articles Description': 'TAMIM TISSUE 200S PACK',
      'Barcode': '2800003990999',
      'Shleflfe': 10,
      'catgory': 'Hygiene & Paper'
    },
    {
      'Articles': '102450',
      'Articles Description': 'ORGANIC WHOLE MILK 1L',
      'Barcode': '8901030381011',
      'Shleflfe': 14,
      'catgory': 'Dairy & Fresh'
    },
    {
      'Articles': '319208',
      'Articles Description': 'ALMARAI GREEK YOGURT 150G',
      'Barcode': '6281007012345',
      'Shleflfe': 21,
      'catgory': 'Dairy & Fresh'
    },
    {
      'Articles': '445912',
      'Articles Description': 'LURPAK SALTED BUTTER 200G',
      'Barcode': '5740900401821',
      'Shleflfe': 60,
      'catgory': 'Chilled & Butter'
    },
    {
      'Articles': '556781',
      'Articles Description': 'FRESH CROISSANT PACK 4S',
      'Barcode': '6291001029384',
      'Shleflfe': 3,
      'catgory': 'Bakery & Pastry'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Articles
    { wch: 32 }, // Articles Description
    { wch: 18 }, // Barcode
    { wch: 12 }, // Shleflfe
    { wch: 20 }, // catgory
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Catalog');
  XLSX.writeFile(workbook, 'Shelflife_Catalog_Template.xlsx');
}

export function exportCatalogToExcel(articles: Article[]): void {
  const exportRows = articles.map((art) => {
    let statusLabel = 'Pending';
    if (art.status === 'verified') statusLabel = 'Verified Correct';
    if (art.status === 'corrected') statusLabel = 'User Corrected';

    return {
      'Articles': art.articleCode,
      'Articles Description': art.articleDescription,
      'Barcode': art.barcode,
      'Shleflfe (Admin)': art.shelfLifeDays,
      'User Updated (Days)': art.userUpdatedShelfLifeDays !== undefined ? art.userUpdatedShelfLifeDays : '-',
      'catgory': art.category,
      'Status': statusLabel,
      'Last Audit Result': art.lastAuditResult || '-',
      'Last Verified At': art.lastVerifiedAt ? new Date(art.lastVerifiedAt).toLocaleString() : '-'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 35 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalog Export');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Shelf_Life_Catalog_${dateStr}.xlsx`);
}

import { apiRequest } from '@/lib/api-client';
import type { DocumentOcrResult, TypeDocumentScan } from './types';

// multipart/form-data — apiRequest laisse fetch fixer lui-même le
// Content-Type (avec la boundary) dès que le corps est un FormData, voir
// lib/api-client.ts.
export function scanDocument(fichier: File, typeDocument?: TypeDocumentScan) {
  const formData = new FormData();
  formData.append('fichier', fichier);
  if (typeDocument) {
    formData.append('typeDocument', typeDocument);
  }
  return apiRequest<DocumentOcrResult>('/document-ocr/scan', {
    method: 'POST',
    body: formData,
  });
}

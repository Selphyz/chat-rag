# Step 6: Document Management & Upload

**Estimated Time:** 3-4 hours
**Prerequisites:** STEP-00 through STEP-05 completed
**Status:** Feature complete - File handling and tracking

---

## Overview

This step implements document upload, management, processing status tracking, and deletion functionality.

---

## 1. Document Components

### 1.1 Create File Upload Drop Zone

Create file: `src/components/documents/FileUploadDropZone.tsx`

```typescript
'use client';

import React, { useCallback } from 'react';
import { useUploadDocument } from '@/hooks/useDocuments';
import { useUIContext } from '@/context/UIContext';

const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadDropZoneProps {
  onUploadComplete?: () => void;
}

export default function FileUploadDropZone({ onUploadComplete }: FileUploadDropZoneProps) {
  const { mutate: uploadDocument, isPending } = useUploadDocument();
  const { addToast } = useUIContext();
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: PDF, TXT, MD';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum 10MB';
    }
    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        addToast(error, 'error');
        return;
      }

      uploadDocument(file, {
        onSuccess: () => {
          addToast(`${file.name} uploaded successfully`, 'success');
          setUploadProgress(0);
          onUploadComplete?.();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Upload failed';
          addToast(message, 'error');
        },
      });
    });
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [uploadDocument]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>

      <h3 className="mt-2 text-lg font-medium text-gray-900">
        {isDragActive ? 'Drop files here' : 'Drag files here or click to browse'}
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Supported: PDF, TXT, MD (Max 10MB)
      </p>

      {isPending && (
        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">Uploading...</p>
        </div>
      )}

      <input
        type="file"
        multiple
        onChange={handleChange}
        disabled={isPending}
        className="hidden"
        id="file-input"
        accept=".pdf,.txt,.md"
      />

      <label
        htmlFor="file-input"
        className="mt-4 inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Uploading...' : 'Select Files'}
      </label>
    </div>
  );
}
```

### 1.2 Create Document Status Badge

Create file: `src/components/documents/DocumentStatusBadge.tsx`

```typescript
'use client';

import React from 'react';

type DocumentStatus = 'processing' | 'processed' | 'failed';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  error?: string;
}

export default function DocumentStatusBadge({
  status,
  error,
}: DocumentStatusBadgeProps) {
  const styles = {
    processing: 'bg-yellow-100 text-yellow-800',
    processed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const icons = {
    processing: '⏳',
    processed: '✓',
    failed: '✕',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${styles[status]}`}
    >
      <span>{icons[status]}</span>
      <span className="capitalize">{status}</span>
      {error && <span className="text-xs">({error})</span>}
    </div>
  );
}
```

### 1.3 Create Document List Item

Create file: `src/components/documents/DocumentListItem.tsx`

```typescript
'use client';

import React from 'react';
import type { Document } from '@/types/api';
import DocumentStatusBadge from './DocumentStatusBadge';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { useUIContext } from '@/context/UIContext';

interface DocumentListItemProps {
  document: Document;
}

export default function DocumentListItem({ document }: DocumentListItemProps) {
  const { mutate: deleteDocument } = useDeleteDocument();
  const { addToast } = useUIContext();

  const handleDelete = () => {
    if (confirm(`Delete "${document.filename}"?`)) {
      deleteDocument(document.id, {
        onSuccess: () => {
          addToast('Document deleted', 'success');
        },
        onError: () => {
          addToast('Failed to delete document', 'error');
        },
      });
    }
  };

  const fileSize = (document.fileSize / 1024).toFixed(2);

  return (
    <div className="flex items-center justify-between border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex-1">
        <h4 className="font-medium text-gray-900">{document.filename}</h4>
        <p className="text-sm text-gray-500">
          {fileSize} KB • Uploaded {new Date(document.createdAt).toLocaleDateString()}
        </p>
      </div>

      <DocumentStatusBadge
        status={document.status}
        error={document.processingError}
      />

      <button
        onClick={handleDelete}
        className="ml-4 rounded-lg p-2 text-red-600 hover:bg-red-50"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
```

### 1.4 Create Document List

Create file: `src/components/documents/DocumentList.tsx`

```typescript
'use client';

import React, { useEffect } from 'react';
import { useDocuments } from '@/hooks/useDocuments';
import DocumentListItem from './DocumentListItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

export default function DocumentList() {
  const { data: documents, isLoading } = useDocuments();
  useAutoRefresh(['documents'], 3000); // Refresh every 3 seconds

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!documents?.length) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No documents uploaded yet</p>
      </div>
    );
  }

  const processingDocs = documents.filter((d) => d.status === 'processing');

  return (
    <div className="space-y-4">
      {processingDocs.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800">
            {processingDocs.length} document(s) processing...
          </p>
        </div>
      )}

      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentListItem key={doc.id} document={doc} />
        ))}
      </div>
    </div>
  );
}
```

---

## 2. Documents Page

### 2.1 Create Documents Page

Create file: `src/app/documents/page.tsx`

```typescript
'use client';

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layouts/MainLayout';
import FileUploadDropZone from '@/components/documents/FileUploadDropZone';
import DocumentList from '@/components/documents/DocumentList';

export default function DocumentsPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
            <p className="mt-2 text-gray-600">
              Upload and manage documents for your conversations
            </p>
          </div>

          {/* Upload Zone */}
          <FileUploadDropZone onUploadComplete={handleUploadComplete} />

          {/* Document List */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Documents
            </h2>
            <DocumentList key={refreshKey} />
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
```

---

## 3. Document Status Polling

### 3.1 Create Document Status Monitor

Create file: `src/hooks/useDocumentStatusMonitor.ts`

```typescript
import { useEffect } from 'react';
import { useDocumentStatus } from '@/hooks/useDocuments';
import { useUIContext } from '@/context/UIContext';

export function useDocumentStatusMonitor(documentId: string) {
  const { data: status, refetch } = useDocumentStatus(documentId);
  const { addToast } = useUIContext();

  useEffect(() => {
    if (!status) return;

    if (status.status === 'processed') {
      addToast('Document processing complete!', 'success');
    } else if (status.status === 'failed') {
      addToast(`Document processing failed: ${status.error}`, 'error');
    }
  }, [status?.status, addToast]);

  return { status, refetch };
}
```

---

## 4. Document Context Integration

### 4.1 Create Document Context for Chat

Create file: `src/context/DocumentContext.tsx`

```typescript
'use client';

import React, { createContext, useContext, useState } from 'react';

interface DocumentContextType {
  selectedDocuments: string[];
  toggleDocument: (id: string) => void;
  clearDocuments: () => void;
  addDocument: (id: string) => void;
  removeDocument: (id: string) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  const toggleDocument = (id: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const addDocument = (id: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(id) ? prev : [...prev, id]
    );
  };

  const removeDocument = (id: string) => {
    setSelectedDocuments((prev) => prev.filter((d) => d !== id));
  };

  const clearDocuments = () => {
    setSelectedDocuments([]);
  };

  return (
    <DocumentContext.Provider
      value={{
        selectedDocuments,
        toggleDocument,
        clearDocuments,
        addDocument,
        removeDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocumentContext() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within DocumentProvider');
  }
  return context;
}
```

### 4.2 Add Document Selection to Message Input

Create file: `src/components/chat/DocumentSelector.tsx`

```typescript
'use client';

import React from 'react';
import { useDocuments } from '@/hooks/useDocuments';
import { useDocumentContext } from '@/context/DocumentContext';

export default function DocumentSelector() {
  const { data: documents } = useDocuments();
  const { selectedDocuments, toggleDocument } = useDocumentContext();
  const [isOpen, setIsOpen] = React.useState(false);

  const processedDocs = documents?.filter((d) => d.status === 'processed') || [];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-2 hover:bg-gray-100 relative"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {selectedDocuments.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-600 rounded-full">
            {selectedDocuments.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              Select Documents
            </h3>

            {processedDocs.length === 0 ? (
              <p className="text-sm text-gray-500">No processed documents</p>
            ) : (
              <div className="space-y-2">
                {processedDocs.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                      className="rounded"
                    />
                    <span className="text-sm truncate">{doc.filename}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 5. File Type Icons

### 5.1 Create File Icon Component

Create file: `src/components/documents/FileIcon.tsx`

```typescript
'use client';

interface FileIconProps {
  filename: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function FileIcon({ filename, size = 'md' }: FileIconProps) {
  const ext = filename.split('.').pop()?.toLowerCase();

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const iconMap: Record<string, JSX.Element> = {
    pdf: (
      <svg
        className={sizeClasses[size]}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M13.5 2H4a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V10.5M13.5 2L19 7.5M13.5 2v5h5" />
      </svg>
    ),
    txt: (
      <svg
        className={sizeClasses[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    md: (
      <svg
        className={sizeClasses[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  };

  return (
    <div className="text-gray-400">
      {iconMap[ext || 'default'] || iconMap.txt}
    </div>
  );
}
```

---

## 6. Verification Checklist

- [ ] File upload drag-drop works
- [ ] File validation for size and type
- [ ] Upload progress shows
- [ ] Documents list displays
- [ ] Status badges show correct status
- [ ] Delete document works
- [ ] Auto-refresh of document list
- [ ] Document status monitoring works
- [ ] Document selection works for chats
- [ ] Processing documents marked visually

---

## 7. Testing

### 7.1 Test Document Upload

1. Go to /documents
2. Drag PDF file to upload zone
3. Confirm upload progress
4. Verify document appears in list
5. Check status updates

### 7.2 Test Document Deletion

1. Click delete on a document
2. Confirm deletion
3. Verify document removed from list

### 7.3 Test Document Selection

1. Go to chat page
2. Click document selector
3. Select processed documents
4. Send message with documents selected

---

## 8. Next Steps

**Frontend Development Complete!**

After this step:
1. ✅ Verify all document features work
2. ✅ Test file upload and management
3. → Deploy frontend application
4. → Integration testing with backend
5. → Performance optimization
6. → Production deployment

---

## 9. References

- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [FormData API](https://developer.mozilla.org/en-US/docs/Web/API/FormData)

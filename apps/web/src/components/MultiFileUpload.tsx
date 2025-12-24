"use client";
import React, { useCallback, useRef, useState } from 'react';
import { withRetry } from '../lib/retry';

interface UploadFile {
  id: string; // internal temp id
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
  serverFileId?: string;
}

export interface MultiFileUploadProps {
  orgId: string;
  authToken?: string;
  baseUrl?: string;
  onUploaded?: (ctx: { file_id: string; filename: string; quote_id?: string; quote_item_id?: string }) => void;
  onQuoteReady?: (quoteId: string) => void;
  className?: string;
  autoCreateQuote?: boolean;
}

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({ orgId, authToken, baseUrl = '', onUploaded, onQuoteReady, className, autoCreateQuote = true }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [quoteId, setQuoteId] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const createQuoteIfNeeded = useCallback(async (serverFileId: string) => {
    let createdQuoteId = quoteId;
    let quoteItemId: string | undefined;
    if (!autoCreateQuote) return { createdQuoteId, quoteItemId };

    const headers = { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

    const shouldRetry = (err: unknown) => {
      // Retry on network errors and 5xx; avoid retrying 4xx client errors
      if (err && typeof err === 'object' && 'status' in (err as any)) {
        const status = Number((err as any).status);
        return status >= 500 && status < 600;
      }
      return true;
    };

    if (!createdQuoteId) {
      const cqData = await withRetry(async () => {
        const cq = await fetch(`${baseUrl}/api/quotes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ org_id: orgId, parts: [{ file_id: serverFileId, process_type: 'cnc_milling', quantities: [1, 10, 50] }] })
        });
        if (!cq.ok) {
          const msg = await cq.text().catch(() => cq.statusText);
          const e: any = new Error(`quote create failed: ${cq.status} ${msg}`);
          e.status = cq.status;
          throw e;
        }
        return cq.json();
      }, { retries: 2, baseDelayMs: 300, shouldRetry });

      createdQuoteId = cqData?.id || cqData?.quote_id || cqData?.quote?.id;
      quoteItemId = cqData?.items?.[0]?.id || cqData?.quote?.items?.[0]?.id;
      if (createdQuoteId) {
        setQuoteId(createdQuoteId);
        onQuoteReady?.(createdQuoteId);
      }
    } else {
      const apData = await withRetry(async () => {
        const ap = await fetch(`${baseUrl}/api/quotes/${createdQuoteId}/parts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ parts: [{ file_id: serverFileId, process_type: 'cnc_milling', quantities: [1, 10, 50] }] })
        });
        if (!ap.ok) {
          const msg = await ap.text().catch(() => ap.statusText);
          const e: any = new Error(`add part failed: ${ap.status} ${msg}`);
          e.status = ap.status;
          throw e;
        }
        return ap.json();
      }, { retries: 2, baseDelayMs: 300, shouldRetry });

      const item = (apData?.items || []).find((it: any) => it.file_id === serverFileId);
      quoteItemId = item?.id;
    }

    return { createdQuoteId, quoteItemId };
  }, [autoCreateQuote, authToken, baseUrl, onQuoteReady, orgId, quoteId]);

  const updateFileState = useCallback((localId: string, updates: Partial<UploadFile>) => {
    setFiles(prev => {
      const next: UploadFile[] = [];
      for (const item of prev) {
        if (item.id === localId) {
          next.push({ ...item, ...updates });
        } else {
          next.push(item);
        }
      }
      return next;
    });
  }, []);

  const startUpload = useCallback(async (localId: string, file: File) => {
    updateFileState(localId, { status: 'uploading', progress: 0, error: undefined });

    const doSingleUpload = () => new Promise<{ file: { id: string } }>((resolve, reject) => {
      const formData = new FormData();
      formData.append('org_id', orgId);
      formData.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${baseUrl}/api/files/direct`, true);
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }
      xhr.responseType = 'json';

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          updateFileState(localId, { progress });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as { file: { id: string } });
        } else {
          const message = (xhr.response && (xhr.response.message || xhr.response.error)) || `Upload failed (${xhr.status})`;
          const e: any = new Error(message);
          e.status = xhr.status;
          reject(e);
        }
      };

      xhr.onerror = () => {
        const e: any = new Error('Network error during upload');
        e.status = 0;
        reject(e);
      };

      xhr.send(formData);
    });

    const uploadPromise = withRetry(doSingleUpload, {
      retries: 2,
      baseDelayMs: 300,
      shouldRetry: (err) => {
        const status = (err as any)?.status as number | undefined;
        return !status || status >= 500; // retry network/5xx
      }
    });

    try {
      const response = await uploadPromise;
      const serverFileId = response?.file?.id;
      if (!serverFileId) {
        throw new Error('Upload succeeded but file ID was not returned');
      }

      updateFileState(localId, { status: 'uploaded', progress: 100, serverFileId });

      let createdQuoteId: string | undefined;
      let quoteItemId: string | undefined;
      try {
        const result = await createQuoteIfNeeded(serverFileId);
        createdQuoteId = result.createdQuoteId;
        quoteItemId = result.quoteItemId;
      } catch (quoteError) {
         
        console.warn('Quote linkage failed', quoteError);
      }

      onUploaded?.({ file_id: serverFileId, filename: file.name, quote_id: createdQuoteId, quote_item_id: quoteItemId });
    } catch (err: any) {
       
      console.warn('Upload error', err);
      updateFileState(localId, { status: 'error', error: err.message || 'Upload failed' });
    }
  }, [authToken, baseUrl, createQuoteIfNeeded, onUploaded, orgId, updateFileState]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newUploads: UploadFile[] = [];
    for (const f of Array.from(fileList)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      newUploads.push({ id, file: f, status: 'pending', progress: 0 });
    }
    setFiles(prev => [...prev, ...newUploads]);
    newUploads.forEach(upload => {
      void startUpload(upload.id, upload.file);
    });
  }, [startUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onBrowse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className={className}>
      <button
        type="button"
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        className="w-full rounded border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-xs text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={onBrowse}
      >
        <p className="mb-1 font-medium text-sm">Upload CAD Files</p>
        <p className="text-[10px] mb-2">STEP, STL, IGES — drag & drop or click</p>
        <button type="button" className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs">Select Files</button>
        <input ref={inputRef} onChange={e => addFiles(e.target.files)} multiple type="file" className="hidden" />
      </button>
      {files.length > 0 && (
        <ul className="mt-3 space-y-2 text-[11px]">
          {files.map(f => (
            <li key={f.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
              <span className="truncate max-w-[55%]" title={f.file.name}>{f.file.name}</span>
              <span className="text-gray-500">
                {f.status === 'uploading' && `${f.progress}%`}
                {f.status === 'uploaded' && 'done'}
                {f.status === 'pending' && 'queued'}
                {f.status === 'error' && <span className="text-red-600">error</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MultiFileUpload;

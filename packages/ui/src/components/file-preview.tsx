import React from 'react';
import { DocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface PDFPreviewProps {
  url: string;
  title?: string;
  className?: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ url, title, className = '' }) => {
  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      <div className="flex-1 bg-gray-50 rounded-lg border overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full"
          title={title || 'PDF Preview'}
          style={{ border: 'none' }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">
        PDF Preview - {title}
      </div>
    </div>
  );
};

interface CADPreviewProps {
  url: string;
  title?: string;
  className?: string;
}

export const CADPreview: React.FC<CADPreviewProps> = ({ url, title, className = '' }) => {
  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      <div className="flex-1 bg-gray-900 rounded-lg border overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full"
          title={title || 'CAD Preview'}
          style={{ border: 'none' }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">
        CAD Preview - {title}
      </div>
    </div>
  );
};

interface ImagePreviewProps {
  url: string;
  alt?: string;
  className?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ url, alt, className = '' }) => {
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border ${className}`}>
      <img
        src={url}
        alt={alt || 'Image Preview'}
        className="max-w-full max-h-full object-contain"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
};

interface FilePreviewProps {
  file: {
    name: string;
    mime: string;
    size: number;
  };
  signedUrl?: string;
  className?: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, signedUrl, className = '' }) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (signedUrl && file.mime.startsWith('image/')) {
    return <ImagePreview url={signedUrl} alt={file.name} className={className} />;
  }

  if (signedUrl && file.mime === 'application/pdf') {
    return <PDFPreview url={signedUrl} title={file.name} className={className} />;
  }

  // Fallback for unsupported file types
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border p-8 ${className}`}>
      <DocumentIcon className="w-16 h-16 text-gray-400 mb-4" />
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900 mb-2">{file.name}</p>
        <p className="text-sm text-gray-500 mb-2">{formatFileSize(file.size)}</p>
        <p className="text-xs text-gray-400">Preview not available for this file type</p>
      </div>
    </div>
  );
};

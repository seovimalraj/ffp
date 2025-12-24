'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Viewer3DProps {
  readonly fileUrl?: string;
  readonly className?: string;
  readonly showWireframe?: boolean;
}

export function Viewer3D({ fileUrl, className = '', showWireframe = false }: Viewer3DProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>3D Model Viewer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
          {fileUrl ? (
            <div className="text-center">
              <p className="text-gray-600">3D Model Preview</p>
              <p className="text-sm text-gray-500 mt-2">Model: {fileUrl}</p>
              {showWireframe && (
                <p className="text-xs text-blue-500 mt-1">Wireframe Mode</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600">No model loaded</p>
              <p className="text-sm text-gray-500 mt-2">Upload a CAD file to preview</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

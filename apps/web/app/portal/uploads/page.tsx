'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Dropzone } from '@/components/upload/Dropzone';
import { BulkUpload } from '@/components/upload/BulkUpload';
import { ModelViewer } from '@/components/viewer/ModelViewer';
import { MetricsPanel } from '@/components/viewer/MetricsPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Package } from 'lucide-react';
import type { FileMetrics } from '@/types/file-metrics';

const supabase = createClient();

export default function UploadsPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<{
    id: string;
    name: string;
    status: string;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FileMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  useEffect(() => {
    // Get current organization
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setOrganizationId(data.organization_id);
            }
          });
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedFile) return;

    const analyzeFile = async () => {
      // Start analysis if file is clean
      if (selectedFile.status === 'clean') {
        setIsAnalyzing(true);

        try {
          const analyzeResponse = await fetch('/api/cad/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: selectedFile.id }),
          });

          const analyzeData = await analyzeResponse.json();

          // Poll for analysis completion
          const pollAnalysis = async () => {
            const pollResponse = await fetch(`/api/cad/analysis/${analyzeData.taskId}`);
            const result = await pollResponse.json();

            if (pollResponse.status === 200) {
              setMetrics(result);
              setIsAnalyzing(false);

              // Get preview URL
              try {
                const previewResponse = await fetch(`/api/cad/preview/${selectedFile.id}`);
                const previewData = await previewResponse.json();
                if (previewData.url) {
                  setPreviewUrl(previewData.url);
                }
              } catch (error) {
                console.error('Failed to get preview URL:', error);
              }
            } else {
              // Continue polling
              setTimeout(pollAnalysis, 2000);
            }
          };

          pollAnalysis();
        } catch (error) {
          console.error('Analysis failed:', error);
          setIsAnalyzing(false);
        }
      }
    };

    analyzeFile();
  }, [selectedFile]);  const handleSingleUploadComplete = (fileId: string) => {
    // Get file details
    supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSelectedFile(data);
        }
      });
  };

  const handleBulkUploadComplete = (fileIds: string[]) => {
    setUploadedFileIds(fileIds);
    // Optionally redirect to quotes page or show success message
    router.push('/portal/quotes?uploaded=' + fileIds.join(','));
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upload CAD Files</h1>
        {uploadedFileIds.length > 0 && (
          <Button onClick={() => router.push('/portal/quotes')}>
            Create Quote from Uploads
          </Button>
        )}
      </div>

      {/* Upload Options */}
      {!selectedFile && organizationId && (
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Single File Upload
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Bulk Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <Dropzone
                  organizationId={organizationId}
                  onUploadComplete={handleSingleUploadComplete}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="mt-6">
            <BulkUpload
              organizationId={organizationId}
              onUploadComplete={handleBulkUploadComplete}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Viewer and Metrics */}
      {selectedFile && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            {previewUrl ? (
              <ModelViewer modelUrl={previewUrl} />
            ) : (
              <div className="flex items-center justify-center h-[500px] bg-background border rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-6">
            {metrics ? (
              <>
                <MetricsPanel metrics={metrics} />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => router.push('/portal/quote')}
                >
                  Get Quote
                </Button>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      {isAnalyzing ? 'Analyzing part...' : 'Preparing preview...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upload Another */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setMetrics(null);
              }}
            >
              Upload Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

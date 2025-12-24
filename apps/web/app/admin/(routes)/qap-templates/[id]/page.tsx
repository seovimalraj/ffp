'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QapTemplate, QapPreviewData } from '@/types/qap';

// Load Monaco editor dynamically to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function QapTemplateEditor() {
  const params = useParams() as { id: string };
  const router = useRouter();

  const [template, setTemplate] = useState<QapTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<QapPreviewData>({
    part: {
      name: 'Example Part',
      material: 'Aluminum 6061',
      quantity: 10,
    },
    measurements: [
      {
        dimension: 'Length',
        nominal: 100,
        tolerance: '±0.1',
        actual: 100.05,
      },
      {
        dimension: 'Width',
        nominal: 50,
        tolerance: '±0.1',
        actual: 49.98,
      },
    ],
    inspection: {
      inspector: 'John Doe',
      date: '2025-08-28',
      result: 'PASS',
    },
  });

  const loadTemplate = useCallback(async () => {
    try {
      const response = await api.get(`/qap/templates/${params.id}`);
      setTemplate(response.data);
    } catch (error) {
      toast.error('Failed to load template');
      console.error('Error loading template:', error);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id !== 'new') {
      loadTemplate();
    } else {
      setTemplate({
        id: crypto.randomUUID(),
        name: 'New Template',
        process_type: 'cnc',
        template_html: defaultTemplate,
        schema_json: defaultSchema,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [params.id, loadTemplate]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      if (params.id === 'new') {
        await api.post('/qap/templates', {
          ...template,
          orgId: localStorage.getItem('currentOrgId'),
        });
        toast.success('Template created successfully');
        router.push('/admin/qap-templates');
      } else {
        await api.put(`/qap/templates/${params.id}`, template);
        toast.success('Template saved successfully');
      }
    } catch (error) {
      toast.error('Failed to save template');
      console.error('Error saving template:', error);
    } finally {
      setIsSaving(false);
    }
  }, [params.id, template, router]);

  const handlePreview = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
  }, [isPreviewMode]);

  if (!template) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {params.id === 'new' ? 'New QAP Template' : 'Edit QAP Template'}
        </h1>
        <div className="space-x-4">
          <Button variant="outline" onClick={handlePreview}>
            {isPreviewMode ? 'Edit' : 'Preview'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={template.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTemplate({ ...template, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="process">Process Type</Label>
                <Select
                  value={template.process_type}
                  onValueChange={(value: string) =>
                    setTemplate({ ...template, process_type: value as 'cnc' | 'sheet' | 'im' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cnc">CNC Machining</SelectItem>
                    <SelectItem value="sheet_metal">Sheet Metal</SelectItem>
                    <SelectItem value="injection_molding">Injection Molding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <Label>HTML Template</Label>
            <div className="h-[600px] mt-2">
              <MonacoEditor
                height="100%"
                defaultLanguage="html"
                value={template.template_html}
                onChange={(value: string | undefined) =>
                  setTemplate({ ...template, template_html: value || '' })
                }
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <Label>Schema JSON</Label>
            <div className="h-[300px] mt-2">
              <MonacoEditor
                height="100%"
                defaultLanguage="json"
                value={
                  typeof template.schema_json === 'string'
                    ? template.schema_json
                    : JSON.stringify(template.schema_json, null, 2)
                }
                onChange={(value: string | undefined) =>
                  setTemplate(template && value ? {
                    ...template,
                    schema_json: JSON.parse(value)
                  } : template)
                }
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>

          <Card className="p-6">
            <Label>Preview Data</Label>
            <div className="h-[300px] mt-2">
              <MonacoEditor
                height="100%"
                defaultLanguage="json"
                value={JSON.stringify(previewData, null, 2)}
                onChange={(value: string | undefined) => value ? setPreviewData(JSON.parse(value) as QapPreviewData) : null}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>

          {isPreviewMode && (
            <Card className="p-6">
              <Label>Preview</Label>
              <div
                className="mt-4 p-4 border rounded-md"
                dangerouslySetInnerHTML={{
                  __html: template.template_html.replace(
                    /{{([^}]+)}}/g,
                    (match: string, key: string): string => {
                      const value = key.split('.').reduce<unknown>((obj, k) => {
                        if (obj && typeof obj === 'object') {
                          return (obj as Record<string, unknown>)[k];
                        }
                        return undefined;
                      }, previewData);
                      return String(value ?? match);
                    }
                  ),
                }}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
  <title>Quality Assurance Plan</title>
  <style>
    body { font-family: Arial, sans-serif; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { padding: 8px; border: 1px solid #ddd; }
    th { background-color: #f5f5f5; }
    .header { text-align: center; margin-bottom: 2em; }
    .section { margin-bottom: 2em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Quality Assurance Plan</h1>
    <p>Part: {{ part.name }}</p>
    <p>Material: {{ part.material }}</p>
    <p>Quantity: {{ part.quantity }}</p>
  </div>

  <div class="section">
    <h2>Dimensional Inspection</h2>
    <table>
      <thead>
        <tr>
          <th>Dimension</th>
          <th>Nominal</th>
          <th>Tolerance</th>
          <th>Actual</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {{#each measurements}}
        <tr>
          <td>{{dimension}}</td>
          <td>{{nominal}}</td>
          <td>{{tolerance}}</td>
          <td>{{actual}}</td>
          <td>{{status}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Inspection Results</h2>
    <table>
      <tr>
        <th>Inspector</th>
        <td>{{ inspection.inspector }}</td>
      </tr>
      <tr>
        <th>Date</th>
        <td>{{ inspection.date }}</td>
      </tr>
      <tr>
        <th>Result</th>
        <td>{{ inspection.result }}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Sign-off</h2>
    <table>
      <tr>
        <th>Quality Inspector</th>
        <td>____________________</td>
        <th>Date</th>
        <td>____________________</td>
      </tr>
    </table>
  </div>
</body>
</html>`;

const defaultSchema = {
  type: 'object',
  properties: {
    part: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        material: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: ['name', 'material', 'quantity'],
    },
    measurements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dimension: { type: 'string' },
          nominal: { type: 'number' },
          tolerance: { type: 'string' },
          actual: { type: 'number' },
        },
        required: ['dimension', 'nominal', 'tolerance', 'actual'],
      },
    },
    inspection: {
      type: 'object',
      properties: {
        inspector: { type: 'string' },
        date: { type: 'string', format: 'date' },
        result: { type: 'string', enum: ['PASS', 'FAIL'] },
      },
      required: ['inspector', 'date', 'result'],
    },
  },
  required: ['part', 'measurements', 'inspection'],
};

"use client";

import { type ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QAPTemplate {
  id: string;
  name: string;
  description: string;
  status: string;
}

export default function QAPTemplatesList(): ReactElement {
  const router = useRouter();
  const [templates, setTemplates] = useState<QAPTemplate[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/qap-templates");
        if (!response.ok) {
          throw new Error("Failed to fetch templates");
        }
        const data = await response.json();
        setTemplates(data);
      } catch (_error) {
        // Handle error appropriately (could show a toast notification, error state, etc.)
        setTemplates([]);
      }
    };

    void fetchTemplates();
  }, []);

  const handleNewTemplate = useCallback(() => {
    void router.push("/admin/qap-templates/new");
  }, [router]);

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">QAP Templates</h1>
        <Button onClick={handleNewTemplate}>New Template</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="p-6">
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {template.description}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <Badge variant="outline">{template.status}</Badge>
                <Button
                  variant="outline"
                  onClick={() =>
                    void router.push(`/admin/qap-templates/${template.id}`)
                  }
                >
                  Edit
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

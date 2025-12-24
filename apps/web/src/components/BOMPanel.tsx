"use client";
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TruckIcon, CogIcon, CubeIcon, WrenchIcon, CheckCircleIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface BOMItem {
  id: string;
  category: string;
  name: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier?: string;
  lead_time_days?: number;
}

interface BOMSummary {
  total_items: number;
  total_cost: number;
  categories: Record<string, { count: number; cost: number }>;
  critical_path_lead_time: number;
}

interface BOMData {
  items: BOMItem[];
  summary: BOMSummary;
}

interface BOMPanelProps {
  bom?: BOMData;
  className?: string;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'material':
      return <CubeIcon className="w-4 h-4" />;
    case 'operation':
      return <CogIcon className="w-4 h-4" />;
    case 'tooling':
      return <WrenchIcon className="w-4 h-4" />;
    case 'quality':
      return <CheckCircleIcon className="w-4 h-4" />;
    case 'packaging':
      return <TruckIcon className="w-4 h-4" />;
    default:
      return <CubeIcon className="w-4 h-4" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'material':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'operation':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'tooling':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'quality':
      return 'text-purple-600 bg-purple-50 border-purple-200';
    case 'packaging':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const BOMPanel: React.FC<BOMPanelProps> = ({
  bom,
  className
}) => {
  if (!bom) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-gray-500">
          <CurrencyDollarIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No BOM data available</p>
        </CardContent>
      </Card>
    );
  }

  const { items, summary } = bom;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <CurrencyDollarIcon className="w-4 h-4 mr-2" />
          Bill of Materials
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">{summary.total_items}</div>
            <div className="text-xs text-gray-500">Total Items</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">${summary.total_cost.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Cost</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-600">{summary.critical_path_lead_time}</div>
            <div className="text-xs text-gray-500">Lead Time (days)</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Cost Breakdown by Category</h4>
          <div className="space-y-2">
            {Object.entries(summary.categories).map(([category, data]) => (
              <div key={category} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  {getCategoryIcon(category)}
                  <span className="text-sm font-medium text-gray-900 ml-2 capitalize">
                    {category}
                  </span>
                  <Badge className={`text-xs ml-2 ${getCategoryColor(category)}`}>
                    {data.count} items
                  </Badge>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  ${data.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Items */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Breakdown</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      {getCategoryIcon(item.category)}
                      <span className="text-sm font-medium text-gray-900 ml-2">
                        {item.name}
                      </span>
                      <Badge className={`text-xs ml-2 ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-600 mb-2">{item.description}</p>
                    )}
                    {item.supplier && (
                      <p className="text-xs text-gray-500">Supplier: {item.supplier}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      ${item.total_cost.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.quantity} × ${item.unit_cost.toFixed(2)}
                    </div>
                    {item.lead_time_days && (
                      <div className="text-xs text-gray-500">
                        {item.lead_time_days} days
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <div className="text-center py-4">
            <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-gray-600">BOM calculation in progress</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BOMPanel;

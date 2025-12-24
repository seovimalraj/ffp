"use client";
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclamationTriangleIcon, CheckCircleIcon, WrenchIcon, CubeIcon } from '@heroicons/react/24/outline';

interface DetectedFeature {
  type: string;
  dimensions?: Record<string, number>;
  machining_difficulty: number;
  dff_issues?: string[];
}

interface FeatureSummary {
  total_features: number;
  complexity_score: number;
  dff_violations: string[];
}

interface FeaturesData {
  detected_features: DetectedFeature[];
  summary: FeatureSummary;
}

interface FeatureAnalysisPanelProps {
  features?: FeaturesData;
  className?: string;
}

const getDifficultyColor = (difficulty: number) => {
  if (difficulty <= 3) return 'text-green-600 bg-green-50 border-green-200';
  if (difficulty <= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getDifficultyLabel = (difficulty: number) => {
  if (difficulty <= 3) return 'Easy';
  if (difficulty <= 6) return 'Moderate';
  return 'Difficult';
};

const formatDimensions = (dimensions?: Record<string, number>) => {
  if (!dimensions) return '';
  const entries = Object.entries(dimensions);
  return entries.map(([key, value]) => `${key}: ${value.toFixed(1)}mm`).join(', ');
};

export const FeatureAnalysisPanel: React.FC<FeatureAnalysisPanelProps> = ({
  features,
  className
}) => {
  if (!features) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-gray-500">
          <CubeIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No feature analysis available</p>
        </CardContent>
      </Card>
    );
  }

  const { detected_features, summary } = features;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <WrenchIcon className="w-4 h-4 mr-2" />
          Manufacturability Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.total_features}</div>
            <div className="text-xs text-gray-500">Features Detected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{summary.complexity_score.toFixed(1)}</div>
            <div className="text-xs text-gray-500">Complexity Score</div>
          </div>
        </div>

        {/* DFM Issues */}
        {summary.dff_violations.length > 0 && (
          <div className="border border-red-200 rounded-lg p-3 bg-red-50">
            <div className="flex items-center mb-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-700">Design for Manufacturability Issues</span>
            </div>
            <ul className="space-y-1">
              {summary.dff_violations.map((issue, idx) => (
                <li key={idx} className="text-xs text-red-600 flex items-center">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2 flex-shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detected Features */}
        {detected_features.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Detected Features</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {detected_features.map((feature, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {feature.type.replace('_', ' ')}
                    </span>
                    <Badge className={`text-xs ${getDifficultyColor(feature.machining_difficulty)}`}>
                      {getDifficultyLabel(feature.machining_difficulty)}
                    </Badge>
                  </div>

                  {feature.dimensions && Object.keys(feature.dimensions).length > 0 && (
                    <div className="text-xs text-gray-600 mb-2">
                      {formatDimensions(feature.dimensions)}
                    </div>
                  )}

                  {feature.dff_issues && feature.dff_issues.length > 0 && (
                    <div className="flex items-center text-xs text-red-600">
                      <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                      {feature.dff_issues.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {detected_features.length === 0 && summary.dff_violations.length === 0 && (
          <div className="text-center py-4">
            <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-gray-600">No manufacturing issues detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeatureAnalysisPanel;

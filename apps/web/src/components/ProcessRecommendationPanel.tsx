"use client";
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircleIcon, CogIcon, ClockIcon, CurrencyDollarIcon, WrenchIcon } from '@heroicons/react/24/outline';

interface ProcessRecommendation {
  recommended_process: {
    code: string;
    name: string;
    confidence: number;
    reasoning: string[];
    limitations: string[];
  };
  alternatives: Array<{
    code: string;
    name: string;
    confidence: number;
  }>;
  analysis: {
    primary_driver: string;
    cost_impact: string;
    lead_time_impact: string;
    quality_notes: string[];
  };
}

interface ProcessRecommendationPanelProps {
  recommendation?: ProcessRecommendation;
  className?: string;
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
  if (confidence >= 0.6) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return 'Excellent Fit';
  if (confidence >= 0.6) return 'Good Fit';
  if (confidence >= 0.4) return 'Fair Fit';
  return 'Poor Fit';
};

export const ProcessRecommendationPanel: React.FC<ProcessRecommendationPanelProps> = ({
  recommendation,
  className
}) => {
  if (!recommendation) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-gray-500">
          <CogIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No process recommendation available</p>
        </CardContent>
      </Card>
    );
  }

  const { recommended_process, alternatives, analysis } = recommendation;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <CogIcon className="w-4 h-4 mr-2" />
          Recommended Manufacturing Process
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommended Process */}
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <CheckCircleIcon className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">{recommended_process.name}</h4>
                <p className="text-sm text-gray-600">{recommended_process.code}</p>
              </div>
            </div>
            <Badge className={`text-xs ${getConfidenceColor(recommended_process.confidence)}`}>
              {getConfidenceLabel(recommended_process.confidence)}
            </Badge>
          </div>

          {/* Reasoning */}
          {recommended_process.reasoning.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Why this process?</h5>
              <ul className="space-y-1">
                {recommended_process.reasoning.map((reason, idx) => (
                  <li key={idx} className="text-xs text-gray-600 flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Limitations */}
          {recommended_process.limitations.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-2">Limitations</h5>
              <ul className="space-y-1">
                {recommended_process.limitations.map((limitation, idx) => (
                  <li key={idx} className="text-xs text-amber-600 flex items-start">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                    {limitation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Analysis Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <WrenchIcon className="w-5 h-5 mx-auto mb-1 text-gray-600" />
            <div className="text-xs font-medium text-gray-700">Primary Driver</div>
            <div className="text-xs text-gray-600 mt-1">{analysis.primary_driver}</div>
          </div>

          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <CurrencyDollarIcon className="w-5 h-5 mx-auto mb-1 text-gray-600" />
            <div className="text-xs font-medium text-gray-700">Cost Impact</div>
            <div className="text-xs text-gray-600 mt-1">{analysis.cost_impact}</div>
          </div>

          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <ClockIcon className="w-5 h-5 mx-auto mb-1 text-gray-600" />
            <div className="text-xs font-medium text-gray-700">Lead Time</div>
            <div className="text-xs text-gray-600 mt-1">{analysis.lead_time_impact}</div>
          </div>
        </div>

        {/* Quality Notes */}
        {analysis.quality_notes.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-2">Quality Considerations</h5>
            <ul className="space-y-1">
              {analysis.quality_notes.map((note, idx) => (
                <li key={idx} className="text-xs text-gray-600 flex items-start">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-2">Alternative Processes</h5>
            <div className="space-y-2">
              {alternatives.map((alt, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <span className="font-medium">{alt.name}</span>
                  <Badge className={`text-xs ${getConfidenceColor(alt.confidence)}`}>
                    {getConfidenceLabel(alt.confidence)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcessRecommendationPanel;

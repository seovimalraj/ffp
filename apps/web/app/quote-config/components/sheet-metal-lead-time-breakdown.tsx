"use client";

import { Clock, TruckIcon, Package, Wrench, Scissors, Layers, Shield, Sparkles, Zap } from "lucide-react";
import { PartConfig } from "@/types/part-config";

interface LeadTimeBreakdownProps {
  part: PartConfig;
  leadTimeType: "economy" | "standard" | "expedited";
  className?: string;
}

export function SheetMetalLeadTimeBreakdown({ part, leadTimeType, className = "" }: LeadTimeBreakdownProps) {
  const features = part.geometry?.sheetMetalFeatures;
  const leadTime = part.leadTime || 0;
  
  if (!features) return null;

  // Calculate detailed breakdown based on features
  const getMaterialProcurementDays = () => {
    const thickness = features.thickness;
    if (thickness > 6) {
      return leadTimeType === "expedited" ? 1 : leadTimeType === "standard" ? 1.5 : 2;
    }
    return leadTimeType === "expedited" ? 0 : leadTimeType === "standard" ? 0.5 : 1;
  };

  const getCuttingDays = () => {
    const complexity = features.complexity || 'moderate';
    const baseTime = leadTimeType === "expedited" ? 1 : 
                     leadTimeType === "standard" ? 2 : 3;
    
    if (complexity === 'very-complex') return baseTime * 1.5;
    if (complexity === 'complex') return baseTime * 1.2;
    return baseTime;
  };

  const getFormingDays = () => {
    if (features.bendCount === 0) return 0;
    
    const baseTime = leadTimeType === "expedited" ? 0.5 : 
                     leadTimeType === "standard" ? 1 : 1.5;
    
    if (features.bendCount > 15) return baseTime * 2;
    if (features.bendCount > 10) return baseTime * 1.5;
    if (features.bendCount > 5) return baseTime * 1.2;
    return baseTime;
  };

  const getFinishingDays = () => {
    const baseTime = leadTimeType === "expedited" ? 0.5 : 
                     leadTimeType === "standard" ? 1 : 1.5;
    return features.partType !== 'flat-pattern' ? baseTime + 1 : baseTime;
  };

  const getShippingDays = () => {
    return leadTimeType === "expedited" ? 2 : 
           leadTimeType === "standard" ? 4 : 6;
  };

  const materialDays = getMaterialProcurementDays();
  const cuttingDays = getCuttingDays();
  const formingDays = getFormingDays();
  const finishingDays = getFinishingDays();
  const shippingDays = getShippingDays();
  const bufferDays = leadTimeType === "expedited" ? 1 : 
                     leadTimeType === "standard" ? 1.5 : 2;

  const phases = [
    {
      name: "Material Procurement",
      days: materialDays,
      icon: <Package className="w-4 h-4" />,
      color: "bg-blue-500",
      description: `Sourcing ${features.thickness.toFixed(1)}mm material`
    },
    {
      name: "Programming & Setup",
      days: 0.5,
      icon: <Wrench className="w-4 h-4" />,
      color: "bg-purple-500",
      description: `CAM programming for ${features.complexity} part`
    },
    {
      name: "Laser/Cutting",
      days: cuttingDays,
      icon: <Scissors className="w-4 h-4" />,
      color: "bg-orange-500",
      description: `${features.recommendedCuttingMethod.toUpperCase()} cutting • ${features.holeCount} holes`
    },
    ...(formingDays > 0 ? [{
      name: "Bending/Forming",
      days: formingDays,
      icon: <Layers className="w-4 h-4" />,
      color: "bg-green-500",
      description: `${features.bendCount} bends • ${features.flangeCount} flanges`
    }] : []),
    {
      name: "Finishing & QC",
      days: finishingDays,
      icon: <Sparkles className="w-4 h-4" />,
      color: "bg-pink-500",
      description: features.partType !== 'flat-pattern' ? "Deburring, powder coating, inspection" : "Deburring & inspection"
    },
    {
      name: "Shipping",
      days: shippingDays,
      icon: <TruckIcon className="w-4 h-4" />,
      color: "bg-indigo-500",
      description: leadTimeType === "expedited" ? "Express 2-day" : 
                   leadTimeType === "standard" ? "Ground 4-day" : "Economy 6-day"
    },
    {
      name: "Buffer Time",
      days: bufferDays,
      icon: <Shield className="w-4 h-4" />,
      color: "bg-gray-400",
      description: "Safety margin for on-time delivery"
    }
  ];

  const totalDays = phases.reduce((sum, phase) => sum + phase.days, 0);
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">Lead Time Breakdown</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-blue-600">{Math.ceil(leadTime)}</span>
          <span className="text-xs text-gray-500">days</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {phases.map((phase, index) => {
          const percentage = (phase.days / totalDays) * 100;
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${phase.color} text-white`}>
                    {phase.icon}
                  </div>
                  <span className="font-medium text-gray-700">{phase.name}</span>
                </div>
                <span className="font-bold text-gray-900">{phase.days.toFixed(1)}d</span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${phase.color} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              
              <p className="text-xs text-gray-500 ml-8">{phase.description}</p>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
        <div className="text-center">
          <div className="text-xs text-gray-500">Production</div>
          <div className="text-sm font-bold text-gray-900">
            {Math.ceil(materialDays + cuttingDays + formingDays + finishingDays + 0.5)}d
          </div>
        </div>
        <div className="text-center border-x border-gray-200">
          <div className="text-xs text-gray-500">Shipping</div>
          <div className="text-sm font-bold text-gray-900">{shippingDays}d</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Buffer</div>
          <div className="text-sm font-bold text-gray-900">{bufferDays.toFixed(1)}d</div>
        </div>
      </div>

      {/* Complexity indicator */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        <div className={`px-2 py-1 rounded text-xs font-bold ${
          features.complexity === 'very-complex' ? 'bg-red-100 text-red-700' :
          features.complexity === 'complex' ? 'bg-orange-100 text-orange-700' :
          features.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
          'bg-green-100 text-green-700'
        }`}>
          {features.complexity.toUpperCase()}
        </div>
        <span className="text-xs text-gray-600">
          {features.partType.replace(/-/g, ' ').toUpperCase()} • {features.bendCount} bends • {features.holeCount} holes
        </span>
      </div>

      {/* Rush order callout */}
      {leadTimeType === "expedited" && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Zap className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-blue-700 font-medium">
            ⚡ Rush order - prioritized queue & express shipping
          </span>
        </div>
      )}
    </div>
  );
}

// "use client";

// import React, { useState, useEffect, useMemo, useCallback } from 'react';
// // import CadViewer3D from '../viewer/CadViewer3D';
// // import type { Feature, Measurement } from '../viewer/CadViewer3D';
// import {
//   Ruler,
//   Circle,
//   Triangle,
//   Square,
//   Wrench,
//   Zap,
//   Eye,
//   EyeOff,
//   Maximize2,
//   Download,
//   RotateCcw
// } from 'lucide-react';

// interface AdvancedViewer3DProps {
//   meshUrl: string | null;
//   partId: string;
//   onFeaturesDetected?: (features: Feature[]) => void;
//   onMeasurementCreate?: (measurement: Measurement) => void;
// }

// export function AdvancedViewer3D({
//   meshUrl,
//   partId,
//   onFeaturesDetected,
//   onMeasurementCreate
// }: Readonly<AdvancedViewer3DProps>) {
//   const [detectedFeatures, setDetectedFeatures] = useState<Feature[]>([]);
//   const [measurements, setMeasurements] = useState<Measurement[]>([]);
//   const [activeTool, setActiveTool] = useState<'select' | 'measure-distance' | 'measure-angle' | 'measure-radius' | 'measure-area'>('select');
//   const [showFeatures, setShowFeatures] = useState(true);
//   const [showMeasurements] = useState(true);
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

//   // Reset when part changes
//   useEffect(() => {
//     setDetectedFeatures([]);
//     setMeasurements([]);
//     setSelectedFeatureId(null);
//     setActiveTool('select');
//   }, [partId]);

//   const handleFeatureClick = useCallback((feature: Feature) => {
//     setSelectedFeatureId(feature.id === selectedFeatureId ? null : feature.id);
//   }, [selectedFeatureId]);

//   const handleMeasurementCreate = useCallback((measurement: Measurement) => {
//     setMeasurements(prev => [...prev, measurement]);
//     onMeasurementCreate?.(measurement);
//   }, [onMeasurementCreate]);

//   const handleAutoDetect = useCallback(() => {
//     // This will trigger feature detection in the viewer
//     // Features will be passed back via the features prop
//     console.log('Auto-detect triggered for part:', partId);
//   }, [partId]);

//   const clearMeasurements = useCallback(() => {
//     setMeasurements([]);
//   }, []);

//   // Group features by type
//   const featureStats = useMemo(() => {
//     const stats = {
//       holes: detectedFeatures.filter(f => f.type === 'hole').length,
//       pockets: detectedFeatures.filter(f => f.type === 'pocket').length,
//       threads: detectedFeatures.filter(f => f.type === 'thread').length,
//       fillets: detectedFeatures.filter(f => f.type === 'fillet').length,
//       flatFaces: detectedFeatures.filter(f => f.type === 'flat-face').length,
//     };
//     return stats;
//   }, [detectedFeatures]);

//   const selectedFeature = useMemo(() =>
//     detectedFeatures.find(f => f.id === selectedFeatureId),
//     [detectedFeatures, selectedFeatureId]
//   );

//   if (!meshUrl) {
//     return (
//       <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
//         <div className="text-center p-8">
//           <Wrench className="w-12 h-12 mx-auto mb-4 text-gray-400" />
//           <p className="text-sm text-gray-500 dark:text-gray-400">
//             Upload a CAD file to start analyzing
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className={`flex flex-col gap-3 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4' : ''}`}>
//       {/* Toolbar */}
//       <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//         <div className="flex items-center gap-1">
//           <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-2">TOOLS:</span>

//           <button
//             onClick={() => setActiveTool('select')}
//             className={`p-2 rounded transition-colors ${
//               activeTool === 'select'
//                 ? 'bg-blue-500 text-white'
//                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
//             }`}
//             title="Select"
//           >
//             <Eye className="w-4 h-4" />
//           </button>

//           <button
//             onClick={() => setActiveTool('measure-distance')}
//             className={`p-2 rounded transition-colors ${
//               activeTool === 'measure-distance'
//                 ? 'bg-blue-500 text-white'
//                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
//             }`}
//             title="Measure Distance"
//           >
//             <Ruler className="w-4 h-4" />
//           </button>

//           <button
//             onClick={() => setActiveTool('measure-angle')}
//             className={`p-2 rounded transition-colors ${
//               activeTool === 'measure-angle'
//                 ? 'bg-blue-500 text-white'
//                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
//             }`}
//             title="Measure Angle"
//           >
//             <Triangle className="w-4 h-4" />
//           </button>

//           <button
//             onClick={() => setActiveTool('measure-radius')}
//             className={`p-2 rounded transition-colors ${
//               activeTool === 'measure-radius'
//                 ? 'bg-blue-500 text-white'
//                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
//             }`}
//             title="Measure Radius"
//           >
//             <Circle className="w-4 h-4" />
//           </button>

//           <button
//             onClick={() => setActiveTool('measure-area')}
//             className={`p-2 rounded transition-colors ${
//               activeTool === 'measure-area'
//                 ? 'bg-blue-500 text-white'
//                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
//             }`}
//             title="Measure Area"
//           >
//             <Square className="w-4 h-4" />
//           </button>

//           <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />

//           <button
//             onClick={handleAutoDetect}
//             className="px-3 py-2 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold hover:from-blue-600 hover:to-purple-600 transition-all flex items-center gap-1.5"
//             title="Auto-detect features"
//           >
//             <Zap className="w-3.5 h-3.5" />
//             Auto Detect
//           </button>
//         </div>

//         <div className="flex items-center gap-1">
//           <button
//             onClick={() => setShowFeatures(!showFeatures)}
//             className={`p-2 rounded transition-colors ${
//               showFeatures
//                 ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
//                 : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
//             }`}
//             title={showFeatures ? 'Hide features' : 'Show features'}
//           >
//             {showFeatures ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
//           </button>

//           <button
//             onClick={clearMeasurements}
//             className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
//             title="Clear measurements"
//           >
//             <RotateCcw className="w-4 h-4" />
//           </button>

//           <button
//             onClick={() => setIsFullscreen(!isFullscreen)}
//             className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
//             title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
//           >
//             <Maximize2 className="w-4 h-4" />
//           </button>

//           <button
//             className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
//             title="Export measurements"
//           >
//             <Download className="w-4 h-4" />
//           </button>
//         </div>
//       </div>

//       <div className="flex gap-3 flex-1 min-h-0">
//         {/* 3D Viewer */}
//         <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
//           <CadViewer3D
//             modelUrl={meshUrl}
//             fileType="stl"
//             width="100%"
//             height={isFullscreen ? 'calc(100vh - 200px)' : '500px'}
//             showMeasurementTools={true}
//             showCrossSectionControls={true}
//             features={showFeatures ? detectedFeatures : []}
//             onMeasurementCreate={handleMeasurementCreate}
//             onFeatureClick={handleFeatureClick}
//           />
//         </div>

//         {/* Side Panel */}
//         <div className="w-80 flex flex-col gap-3">
//           {/* Feature Stats */}
//           <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
//               <Zap className="w-3.5 h-3.5" />
//               DETECTED FEATURES
//             </h3>
//             <div className="grid grid-cols-2 gap-2">
//               <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
//                 <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{featureStats.holes}</div>
//                 <div className="text-xs text-gray-600 dark:text-gray-400">Holes</div>
//               </div>
//               <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
//                 <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{featureStats.pockets}</div>
//                 <div className="text-xs text-gray-600 dark:text-gray-400">Pockets</div>
//               </div>
//               <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
//                 <div className="text-2xl font-bold text-green-600 dark:text-green-400">{featureStats.threads}</div>
//                 <div className="text-xs text-gray-600 dark:text-gray-400">Threads</div>
//               </div>
//               <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
//                 <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{featureStats.fillets}</div>
//                 <div className="text-xs text-gray-600 dark:text-gray-400">Fillets</div>
//               </div>
//             </div>
//           </div>

//           {/* Selected Feature Details */}
//           {selectedFeature && (
//             <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//               <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">SELECTED FEATURE</h3>
//               <div className="space-y-2">
//                 <div className="flex justify-between items-center">
//                   <span className="text-xs text-gray-600 dark:text-gray-400">Type:</span>
//                   <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 capitalize">{selectedFeature.type}</span>
//                 </div>
//                 {selectedFeature.properties && Object.entries(selectedFeature.properties).map(([key, value]) => (
//                   <div key={key} className="flex justify-between items-center">
//                     <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
//                     <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
//                       {typeof value === 'number' ? value.toFixed(2) : String(value)}
//                     </span>
//                   </div>
//                 ))}
//                 {selectedFeature.confidence && (
//                   <div className="flex justify-between items-center">
//                     <span className="text-xs text-gray-600 dark:text-gray-400">Confidence:</span>
//                     <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
//                       {(selectedFeature.confidence * 100).toFixed(0)}%
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}

//           {/* Measurements List */}
//           <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex-1 overflow-auto">
//             <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
//               <span className="flex items-center gap-2">
//                 <Ruler className="w-3.5 h-3.5" />
//                 MEASUREMENTS
//               </span>
//               <span className="text-xs font-normal text-gray-400">({measurements.length})</span>
//             </h3>
//             {measurements.length === 0 ? (
//               <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">
//                 No measurements yet.<br />Select a tool to begin.
//               </div>
//             ) : (
//               <div className="space-y-2">
//                 {measurements.map((measurement, index) => (
//                   <div
//                     key={`measurement-${index}`}
//                     className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
//                   >
//                     <div className="flex justify-between items-center">
//                       <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{measurement.type}:</span>
//                       <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
//                         {measurement.value.toFixed(2)} {measurement.unit}
//                       </span>
//                     </div>
//                     {measurement.label && (
//                       <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">{measurement.label}</div>
//                     )}
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

import React from "react";

const AdvancedViewer3D = () => {
  return <div>AdvancedViewer3D</div>;
};

export default AdvancedViewer3D;

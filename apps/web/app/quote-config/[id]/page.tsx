'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Package, CheckCircle, Clock, DollarSign, Ruler, Palette, 
  Box, ShoppingCart, ArrowRight, Zap, TrendingUp, Loader2, Upload, FileText, Trash2, X
} from 'lucide-react';
import CadViewer3D from '@/components/CadViewer3D';
import DemoNavigation from '@/components/DemoNavigation';
import { getQuote, getQuoteConfig, saveQuoteConfig } from '../../../lib/database';
import { GeometryData } from '../../../lib/cad-analysis';
import { 
  calculatePricing, 
  getMaterial, 
  getFinish, 
  PROCESSES, 
  MATERIALS,
  FINISHES,
  PricingBreakdown 
} from '../../../lib/pricing-engine';

interface PartConfig {
  id: string;
  fileName: string;
  filePath: string;
  fileObject?: File;
  material: string;
  quantity: number;
  tolerance: string;
  finish: string;
  threads: string;
  inspection: string;
  notes: string;
  leadTimeType: 'economy' | 'standard' | 'expedited';
  geometry?: GeometryData;
  pricing?: PricingBreakdown;
}

export default function QuoteConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const paramsHook = useParams();
  const quoteId = paramsHook?.id as string;

  const [email, setEmail] = useState('');
  const [parts, setParts] = useState<PartConfig[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map());

  // Handle adding more files
  const handleAddMoreFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files;
    if (!newFiles || newFiles.length === 0) return;

    const filesArray = Array.from(newFiles);
    const newParts: PartConfig[] = [];

    for (const file of filesArray) {
      // Basic analysis - in production you'd use CAD analysis
      const newPart: PartConfig = {
        id: `part-${parts.length + newParts.length + 1}`,
        fileName: file.name,
        filePath: `temp/${file.name}`,
        fileObject: file,
        material: 'aluminum-6061',
        quantity: 1,
        tolerance: 'standard',
        finish: 'as-machined',
        threads: 'none',
        inspection: 'standard',
        notes: '',
        leadTimeType: 'standard',
        geometry: undefined,
        pricing: undefined
      };
      newParts.push(newPart);
    }

    setParts(prev => [...prev, ...newParts]);
    // Clear the input
    event.target.value = '';
  };

  // Handle deleting a part
  const handleDeletePart = (indexToDelete: number) => {
    if (parts.length === 1) {
      alert('Cannot delete the last part. At least one part is required.');
      return;
    }
    
    setParts(prev => prev.filter((_, index) => index !== indexToDelete));
    
    // Adjust current part index if needed
    if (currentPartIndex >= parts.length - 1) {
      setCurrentPartIndex(Math.max(0, parts.length - 2));
    }
  };

  useEffect(() => {
    async function loadQuote() {
      if (!quoteId) return;
      
      try {
        setLoading(true);
        
        // Check if this is a temporary quote ID (starts with 'temp-')
        const isTempQuote = quoteId.startsWith('temp-');
        
        if (isTempQuote) {
          // Load from sessionStorage only (no database call)
          const filesDataStr = sessionStorage.getItem(`quote-${quoteId}-files`);
          const emailStr = sessionStorage.getItem(`quote-${quoteId}-email`);
          
          if (!filesDataStr) {
            console.error('SessionStorage data not found for quote:', quoteId);
            alert('Quote session expired. Please upload your files again.');
            router.push('/instant-quote');
            return;
          }
          
          const filesData = JSON.parse(filesDataStr);
          setEmail(emailStr || `guest-${Date.now()}@temp.quote`);
          
          // Initialize parts from sessionStorage
          const initialParts: PartConfig[] = await Promise.all(
            filesData.map(async (file: any, index: number) => {
              // Retrieve file data from sessionStorage
              const fileDataUrl = sessionStorage.getItem(`quote-${quoteId}-file-${index}`);
              let fileObject: File | undefined;
              
              if (fileDataUrl) {
                try {
                  // Convert base64 back to File
                  const response = await fetch(fileDataUrl);
                  const blob = await response.blob();
                  fileObject = new File([blob], file.name, { type: file.type || blob.type });
                } catch (error) {
                  console.error(`Failed to reconstruct file ${index}:`, error);
                }
              }
              
              return {
                id: `part-${index + 1}`,
                fileName: file.name,
                filePath: file.path || `temp/${file.name}`,
                fileObject,
                material: 'aluminum-6061',
                quantity: 1,
                tolerance: 'standard',
                finish: 'as-machined',
                threads: 'none',
                inspection: 'standard',
                notes: '',
                leadTimeType: 'standard',
                geometry: file.geometry,
                pricing: undefined
              };
            })
          );
          
          setParts(initialParts);
        } else {
          // Load quote from database (original flow)
          const quote = await getQuote(quoteId);
          if (!quote) {
            console.error('Quote not found in database:', quoteId);
            alert('Quote not found');
            router.push('/instant-quote');
            return;
          }
          
          setEmail(quote.email);
          
          // Check if configuration already exists
          try {
            const existingConfig = await getQuoteConfig(quoteId);
            if (existingConfig) {
              setParts(existingConfig.parts);
            } else {
              throw new Error('No config found');
            }
          } catch (error) {
            // Initialize new configuration
            const filesDataStr = sessionStorage.getItem(`quote-${quoteId}-files`);
            const filesData = filesDataStr ? JSON.parse(filesDataStr) : [];
            
            // Initialize parts from uploaded files with real geometry data
            const initialParts: PartConfig[] = await Promise.all(
              quote.files.map(async (file: any, index: number) => {
                // Retrieve file data from sessionStorage
                const fileDataUrl = sessionStorage.getItem(`quote-${quoteId}-file-${index}`);
                let fileObject: File | undefined;
                
                if (fileDataUrl) {
                  try {
                    // Convert base64 back to File
                    const response = await fetch(fileDataUrl);
                    const blob = await response.blob();
                    fileObject = new File([blob], file.name, { type: file.mimeType || blob.type });
                  } catch (error) {
                    console.error(`Failed to reconstruct file ${index}:`, error);
                  }
                }
                
                return {
                  id: `part-${index + 1}`,
                  fileName: file.name,
                  filePath: file.path,
                  fileObject,
                  material: 'aluminum-6061',
                  quantity: 1,
                  tolerance: 'standard',
                  finish: 'as-machined',
                  threads: 'none',
                  inspection: 'standard',
                  notes: '',
                  leadTimeType: 'standard',
                  geometry: file.geometry,
                  pricing: file.pricing
                };
              })
            );
            
            setParts(initialParts);
          }
        }
      } catch (error) {
        console.error('Error loading quote:', error);
        alert('Failed to load quote. Please try again.');
        router.push('/instant-quote');
      } finally {
        setLoading(false);
      }
    }
    
    loadQuote();
  }, [quoteId, router]);

  const materials = Object.entries(MATERIALS).map(([key, mat]) => ({
    value: key,
    label: mat.name,
    multiplier: mat.costPerKg / 8.50, // Relative to aluminum 6061
    icon: key.includes('aluminum') ? '🔷' : 
          key.includes('stainless') ? '⚙️' :
          key.includes('titanium') ? '🔵' :
          key.includes('plastic') ? '🟢' :
          '�'
  }));

  const tolerances = [
    { value: 'standard', label: 'Standard (±0.005")', multiplier: 1.0 },
    { value: 'precision', label: 'Precision (±0.002")', multiplier: 1.15 },
    { value: 'tight', label: 'Tight (±0.001")', multiplier: 1.30 }
  ];

  const finishes = Object.entries(FINISHES).map(([key, fin]) => ({
    value: key,
    label: fin.name,
    cost: fin.baseCost
  }));

  const threadOptions = [
    { value: 'none', label: 'No Threads' },
    { value: 'tapped', label: 'Tapped Holes' },
    { value: 'threaded-studs', label: 'Threaded Studs' },
    { value: 'helicoils', label: 'Helicoil Inserts' }
  ];

  const inspectionOptions = [
    { value: 'standard', label: 'Standard Inspection (Included)' },
    { value: 'first-article', label: 'First Article Inspection (+$75)' },
    { value: 'full-cmm', label: 'Full CMM Report (+$150)' },
    { value: 'material-cert', label: 'Material Certification (+$25)' }
  ];

  const calculateLeadTime = (part: PartConfig) => {
    if (!part.pricing) return 7;
    return part.pricing.leadTimeDays;
  };

  const calculatePrice = (part: PartConfig, tier: 'economy' | 'standard' | 'premium' = 'economy'): number => {
    // If no geometry data, return 0
    if (!part.geometry) {
      return 0;
    }
    
    // Calculate base pricing
    const material = getMaterial(part.material);
    if (!material) return 0;
    
    const process = PROCESSES['cnc-milling'];
    const finish = getFinish(part.finish);
    
    const pricing = calculatePricing({
      geometry: part.geometry,
      material,
      process,
      finish,
      quantity: part.quantity,
      tolerance: part.tolerance as 'standard' | 'precision' | 'tight',
      leadTimeType: 'standard' // Always use standard as base
    });
    
    // Apply tier multipliers
    const multipliers = {
      economy: 1.0,
      standard: 2.1,
      premium: 3.5
    };
    
    return pricing.totalPrice * multipliers[tier];
  };

  const updatePart = (field: keyof PartConfig, value: any) => {
    setParts(prev => prev.map((p, i) => {
      if (i !== currentPartIndex) return p;
      
      const updatedPart = { ...p, [field]: value };
      
      // Recalculate pricing if geometry exists
      if (updatedPart.geometry) {
        const material = getMaterial(updatedPart.material);
        if (material) {
          const process = PROCESSES['cnc-milling'];
          const finish = getFinish(updatedPart.finish);
          
          updatedPart.pricing = calculatePricing({
            geometry: updatedPart.geometry,
            material,
            process,
            finish,
            quantity: updatedPart.quantity,
            tolerance: updatedPart.tolerance as 'standard' | 'precision' | 'tight',
            leadTimeType: 'standard' // Always use standard as base
          });
        }
      }
      
      return updatedPart;
    }));
  };

  const currentPart = parts[currentPartIndex];
  
  // Calculate prices for all three tiers
  const economyPrice = parts.reduce((sum, part) => sum + calculatePrice(part, 'economy'), 0);
  const standardPrice = parts.reduce((sum, part) => sum + calculatePrice(part, 'standard'), 0);
  const premiumPrice = parts.reduce((sum, part) => sum + calculatePrice(part, 'premium'), 0);
  
  const baseLeadTime = Math.max(...parts.map(p => calculateLeadTime(p)));

  const handleCheckout = async () => {
    try {
      setSaving(true);
      
      // Save configuration to database (use standardPrice as default total)
      await saveQuoteConfig(quoteId, parts, standardPrice, baseLeadTime);
      
      // Navigate to checkout
      router.push(`/checkout/${quoteId}`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading quote configuration...</p>
        </div>
      </div>
    );
  }

  if (!currentPart) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1800px] mx-auto">
        {/* COLUMN 1: Parts List (3 cols wide) */}
        <div className="xl:col-span-3">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-lg">Your Parts ({parts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {parts.map((part, index) => (
                <div
                  key={part.id}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all relative group ${
                    index === currentPartIndex
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div 
                    className="flex items-start gap-2"
                    onClick={() => setCurrentPartIndex(index)}
                  >
                    <div className={`p-2 rounded ${
                      index === currentPartIndex ? 'bg-blue-600' : 'bg-gray-400'
                    }`}>
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${
                        index === currentPartIndex ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {part.fileName}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {getMaterial(part.material)?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: {part.quantity}
                      </p>
                    </div>
                  </div>
                  
                  {/* Delete button */}
                  {parts.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePart(index);
                      }}
                      className="absolute top-2 right-2 p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete part"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => document.getElementById('add-more-files')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Add More Files
            </Button>
            <input
              type="file"
              multiple
              accept=".stl,.step,.stp,.iges,.igs,.dxf,.dwg,.x_t,.x_b,.obj"
              className="hidden"
              id="add-more-files"
              onChange={handleAddMoreFiles}
            />
          </CardContent>
        </Card>
        </div>

        {/* COLUMN 2: 3D Viewer + Configuration (6 cols wide) */}
        <div className="xl:col-span-6 space-y-6">
          {/* 3D Viewer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="w-5 h-5" />
                3D Preview: {currentPart.fileName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CadViewer3D 
                fileName={currentPart.fileName}
                file={currentPart.fileObject}
                height="400px"
              />
              
              {/* Geometry Info */}
              {currentPart.geometry && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-sm mb-2 text-slate-900">Part Analysis</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-600 text-xs">Volume</p>
                      <p className="font-semibold text-slate-900">{(currentPart.geometry.volume / 1000).toFixed(2)} cm³</p>
                    </div>
                    <div>
                      <p className="text-slate-600 text-xs">Surface Area</p>
                      <p className="font-semibold text-slate-900">{(currentPart.geometry.surfaceArea / 100).toFixed(2)} cm²</p>
                    </div>
                    <div>
                      <p className="text-slate-600 text-xs">Bounding Box</p>
                      <p className="font-semibold text-slate-900 text-xs">
                        {currentPart.geometry.boundingBox.x.toFixed(1)} × {currentPart.geometry.boundingBox.y.toFixed(1)} × {currentPart.geometry.boundingBox.z.toFixed(1)} mm
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600 text-xs">Complexity</p>
                      <p className="font-semibold text-slate-900 capitalize">{currentPart.geometry.complexity}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="w-5 h-5" />
                Part Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Material Selection */}
              <div>
                <Label htmlFor="material">Material</Label>
                <Select
                  value={currentPart.material}
                  onValueChange={(value) => updatePart('material', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((mat) => (
                      <SelectItem key={mat.value} value={mat.value}>
                        {mat.icon} {mat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentPart.geometry && (
                  <p className="text-xs text-slate-500 mt-1">
                    Density: {getMaterial(currentPart.material)?.density.toFixed(2)} g/cm³ • 
                    Weight: {currentPart.geometry.materialWeight.toFixed(1)}g
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={currentPart.quantity}
                  onChange={(e) => updatePart('quantity', parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Tolerance */}
              <div>
                <Label htmlFor="tolerance">Tolerance</Label>
                <RadioGroup
                  value={currentPart.tolerance}
                  onValueChange={(value) => updatePart('tolerance', value)}
                >
                  {tolerances.map((tol) => (
                    <div key={tol.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={tol.value} id={tol.value} />
                      <Label htmlFor={tol.value} className="font-normal">
                        {tol.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Finish */}
              <div>
                <Label htmlFor="finish">Surface Finish</Label>
                <Select
                  value={currentPart.finish}
                  onValueChange={(value) => updatePart('finish', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {finishes.map((finish) => (
                      <SelectItem key={finish.value} value={finish.value}>
                        {finish.label} {finish.cost > 0 && `(+$${finish.cost})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Threads */}
              <div>
                <Label htmlFor="threads">Thread Requirements</Label>
                <Select
                  value={currentPart.threads}
                  onValueChange={(value) => updatePart('threads', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {threadOptions.map((thread) => (
                      <SelectItem key={thread.value} value={thread.value}>
                        {thread.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inspection */}
              <div>
                <Label htmlFor="inspection">Inspection Level</Label>
                <Select
                  value={currentPart.inspection}
                  onValueChange={(value) => updatePart('inspection', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectionOptions.map((insp) => (
                      <SelectItem key={insp.value} value={insp.value}>
                        {insp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Special Instructions</Label>
                <textarea
                  id="notes"
                  value={currentPart.notes}
                  onChange={(e) => updatePart('notes', e.target.value)}
                  className="w-full min-h-[80px] p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Critical dimensions, special requirements..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMN 3: Pricing Summary + Checkout (3 cols wide) */}
        <div className="xl:col-span-3">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* All Parts Summary */}
              <div>
                <h3 className="font-semibold text-sm mb-2">All Parts</h3>
                <div className="space-y-2">
                  {parts.map((part, index) => {
                    const partPrice = calculatePrice(part, 'standard');
                    return (
                      <div
                        key={part.id}
                        className={`p-2 rounded text-xs ${
                          index === currentPartIndex ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <p className="font-medium truncate">{part.fileName}</p>
                        <p className="text-gray-600">Qty {part.quantity} • ${partPrice.toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pricing Tiers */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Select Tier</h3>
                
                {/* Premium */}
                <div className="p-3 bg-purple-50 rounded-lg border-2 border-purple-200 mb-3 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <h4 className="font-bold text-purple-700 text-sm">Premium</h4>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">${premiumPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{baseLeadTime} days</p>
                </div>

                {/* Standard */}
                <div className="p-3 bg-green-50 rounded-lg border-2 border-green-300 mb-3 cursor-pointer hover:shadow-md transition-all relative">
                  <Badge className="absolute -top-2 -right-2 bg-green-600 text-white text-xs">Popular</Badge>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <h4 className="font-bold text-green-700 text-sm">Standard</h4>
                  </div>
                  <p className="text-2xl font-bold text-green-600">${standardPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{Math.round(baseLeadTime * 2.1)} days</p>
                </div>

                {/* Economy */}
                <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200 mb-3 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-blue-700 text-sm">Economy</h4>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">${economyPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{Math.round(baseLeadTime * 3)} days</p>
                </div>
              </div>

              {/* Checkout */}
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                onClick={handleCheckout}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Checkout
                    <ShoppingCart className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-gray-500 mt-2">
                No credit card required
              </p>

              {/* Trust Badges */}
              {/* <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>ISO 9001:2015 Certified</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>100% Quality Guarantee</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Secure File Encryption</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>10,000+ Parts Manufactured</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Free Design Review</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-center text-gray-500">
                    🔒 Your designs are safe and confidential
                  </p>
                </div>
              </div> */}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

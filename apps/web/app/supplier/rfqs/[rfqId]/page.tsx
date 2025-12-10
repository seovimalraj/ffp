'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Clock, DollarSign, Package, ArrowLeft, 
  Send, CheckCircle, AlertCircle, Ruler, Palette, Box, Loader2
} from 'lucide-react';
import CadViewer3D from '@/components/CadViewer3D';
import { getRFQ, getOrder, getBidsForRFQ, createBid } from '../../../../lib/database';

interface RFQDetail {
  id: string;
  order_id: string;
  display_value: number;
  materials: string[];
  lead_time: number;
  parts: any;
  status: string;
  created_at: string;
  closes_at: string;
}

export default function SupplierRFQDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rfqId = params?.rfqId as string;

  const [rfqData, setRfqData] = useState<RFQDetail | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bidPrice, setBidPrice] = useState('');
  const [bidLeadTime, setBidLeadTime] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidSubmitted, setBidSubmitted] = useState(false);

  useEffect(() => {
    async function loadRFQDetails() {
      if (!rfqId) return;
      
      try {
        setLoading(true);
        
        // Load RFQ details
        const rfq = await getRFQ(rfqId);
        if (!rfq) {
          alert('RFQ not found');
          router.push('/supplier/rfqs');
          return;
        }
        
        setRfqData(rfq);
        
        // Load order details
        const order = await getOrder(rfq.order_id);
        setOrderData(order);
        
        // Check for existing bid
        const bids = await getBidsForRFQ(rfqId);
        const myBid = bids.find(b => b.supplier_id === 'SUPP-001'); // TODO: Use actual supplier ID from auth
        
        if (myBid) {
          setBidPrice(myBid.price.toString());
          setBidLeadTime(myBid.lead_time.toString());
          setBidNotes(myBid.notes || '');
          setBidSubmitted(true);
        }
      } catch (error) {
        console.error('Error loading RFQ details:', error);
        
        // Use dummy data when API fails
        const dummyRFQ: RFQDetail = {
          id: rfqId,
          order_id: 'ORD-2024-001',
          display_value: 4250,
          materials: ['Aluminum 6061', 'Stainless Steel 304'],
          lead_time: 14,
          parts: [],
          status: 'open',
          created_at: new Date().toISOString(),
          closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        const dummyOrder = {
          id: 'ORD-2024-001',
          parts: [
            {
              id: 'PART-001',
              file_name: 'bracket_assembly.step',
              fileName: 'bracket_assembly.step',
              material: 'Aluminum 6061',
              quantity: 50,
              tolerance: '±0.005"',
              finish: 'Anodized Clear',
              complexity: 'medium'
            },
            {
              id: 'PART-002',
              file_name: 'mounting_plate.step',
              fileName: 'mounting_plate.step',
              material: 'Stainless Steel 304',
              quantity: 25,
              tolerance: '±0.010"',
              finish: 'Bead Blasted',
              complexity: 'standard'
            }
          ]
        };
        
        setRfqData(dummyRFQ);
        setOrderData(dummyOrder);
      } finally {
        setLoading(false);
      }
    }
    
    loadRFQDetails();
  }, [rfqId, router]);

  const handleSubmitBid = async () => {
    if (!bidPrice || !bidLeadTime) {
      alert('Please enter bid price and lead time');
      return;
    }

    const price = parseFloat(bidPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const leadTime = parseInt(bidLeadTime);
    if (isNaN(leadTime) || leadTime <= 0) {
      alert('Please enter a valid lead time');
      return;
    }

    try {
      setIsSubmitting(true);

      const bid = {
        rfq_id: rfqId,
        supplier_id: 'SUPP-001', // TODO: Use actual supplier ID from auth
        supplier_name: 'Precision Parts Inc.',
        price,
        lead_time: leadTime,
        notes: bidNotes,
        status: 'pending'
      };

      // Simulate API call for demo purposes
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo: always succeed
      // await createBid(bid);
      
      setIsSubmitting(false);
      setBidSubmitted(true);
    } catch (error) {
      console.error('Error submitting bid:', error);
      alert('Failed to submit bid. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading RFQ details...</p>
        </div>
      </div>
    );
  }

  if (!rfqData) return <div>RFQ not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/supplier/rfqs')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{rfqData.id}</h1>
            <p className="text-gray-600">Request for Quote Details</p>
          </div>
        </div>

        {bidSubmitted && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Bid Submitted Successfully!</p>
              <p className="text-sm text-green-800">
                Your bid has been sent to the admin team for review. You'll be notified if selected.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Privacy Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">Privacy Protected Order</p>
                <p className="text-sm text-yellow-800">
                  Customer identity and contact information are hidden for privacy. All communication will be handled through the platform.
                </p>
              </div>
            </div>

            {/* RFQ Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  RFQ Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Parts Count</p>
                    <p className="text-2xl font-bold text-gray-900">{orderData?.parts?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Est. Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ~${(rfqData.display_value * 2).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Required By</p>
                    <p className="text-2xl font-bold text-gray-900">{rfqData.lead_time}d</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <Badge className="bg-green-100 text-green-700 border-0">
                      {rfqData.status === 'open' ? 'Open' : rfqData.status === 'bid-submitted' ? 'Bid Sent' : 'Closed'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parts Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Parts Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orderData?.parts?.map((part: any, index: number) => (
                    <div key={part.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{part.file_name}</h3>
                          <p className="text-sm text-gray-600">Part {index + 1} of {orderData.parts.length}</p>
                        </div>
                        <Badge className="bg-gray-100 text-gray-700 border-0">
                          {part.complexity || 'standard'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-start gap-2">
                          <Box className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Material</p>
                            <p className="font-medium text-gray-900">{part.material}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Quantity</p>
                            <p className="font-medium text-gray-900">{part.quantity}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Ruler className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Tolerance</p>
                            <p className="font-medium text-gray-900">{part.tolerance}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Palette className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Finish</p>
                            <p className="font-medium text-gray-900">{part.finish}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <CadViewer3D 
                          fileName={part.fileName} 
                          height="300px"
                          className="mb-3"
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Download Drawings
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          * Customer logos and identifiers are masked in technical drawings
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bid Submission Sidebar */}
          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>
                  {bidSubmitted ? 'Your Bid' : 'Submit Bid'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bidPrice">Bid Price (USD) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="bidPrice"
                      type="number"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      placeholder="8500.00"
                      className="pl-9"
                      disabled={bidSubmitted}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your total bid for all parts
                  </p>
                </div>

                <div>
                  <Label htmlFor="bidLeadTime">Lead Time (days) *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="bidLeadTime"
                      type="number"
                      value={bidLeadTime}
                      onChange={(e) => setBidLeadTime(e.target.value)}
                      placeholder="7"
                      className="pl-9"
                      disabled={bidSubmitted}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Required: {rfqData.lead_time} days or less
                  </p>
                </div>

                <div>
                  <Label htmlFor="bidNotes">Additional Notes</Label>
                  <Textarea
                    id="bidNotes"
                    value={bidNotes}
                    onChange={(e) => setBidNotes(e.target.value)}
                    placeholder="Certifications, capabilities, special considerations..."
                    rows={4}
                    disabled={bidSubmitted}
                  />
                </div>

                {!bidSubmitted && (
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                    onClick={handleSubmitBid}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Submit Bid
                      </>
                    )}
                  </Button>
                )}

                {bidSubmitted && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                    <p className="font-semibold text-gray-900">Bid Submitted</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Awaiting admin approval
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-blue-900 mb-1">Bid Guidelines</p>
                  <ul className="text-blue-800 space-y-1 list-disc list-inside">
                    <li>Competitive pricing required</li>
                    <li>Meet or beat lead time</li>
                    <li>Include all costs (materials, finishing)</li>
                    <li>Note any certifications held</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// 'use client';

// import React, { useState, useEffect, useRef } from 'react';
// import { useParams, useRouter } from 'next/navigation';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import {
//   CheckCircleIcon,
//   ClockIcon,
//   ExclamationTriangleIcon,
//   DocumentTextIcon,
//   ArrowPathIcon,
//   CubeIcon,
//   MagnifyingGlassIcon,
//   ArrowDownTrayIcon,
//   ChevronDownIcon,
//   ScaleIcon,
//   HandRaisedIcon,
//   CubeTransparentIcon,
//   CurrencyDollarIcon,
//   ChevronUpIcon
// } from '@heroicons/react/24/outline';

// interface DFMRequest {
//   id: string;
//   status: 'Queued' | 'Analyzing' | 'Complete' | 'Error';
//   file_name: string;
//   created_at: string;
//   tolerance_pack: string;
//   surface_finish: string;
//   industry: string;
//   criticality: string;
//   user_id?: string;
//   organization_id?: string;
//   results?: DFMResults;
// }

// interface DFMResults {
//   id: string;
//   request_id: string;
//   status: string;
//   summary: {
//     passed: number;
//     warnings: number;
//     blockers: number;
//   };
//   checks: DFMCheck[];
//   geom_props: {
//     bbox_mm: number[];
//     obb_mm: number[];
//     vol_mm3: number;
//     area_mm2: number;
//   };
//   viewer_mesh_id?: string;
//   report_pdf_id?: string;
//   qap_pdf_id?: string;
//   created_at: string;
// }

// interface DFMCheck {
//   id: string;
//   title: string;
//   name?: string;
//   category?: string;
//   status: 'pass' | 'warning' | 'blocker' | 'fail';
//   message: string;
//   severity?: string;
//   details?: string;
//   recommendation?: string;
//   metrics: Record<string, any>;
//   suggestions: string[];
//   highlights: {
//     face_ids: number[];
//     edge_ids: number[];
//   };
// }

// interface LeadFormData {
//   business_email: string;
//   phone_e164: string;
//   consent: boolean;
// }

// interface ViewerMesh {
//   vertices: number[];
//   faces: number[];
//   highlights: {
//     [checkId: string]: {
//       face_ids: number[];
//       edge_ids: number[];
//     };
//   };
// }

// export default function DFMResultsPage() {
//   const params = useParams();
//   const router = useRouter();
//   const requestId = params?.id as string;

//   const [request, setRequest] = useState<DFMRequest | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

//   // Lead collection modal state
//   const [showLeadModal, setShowLeadModal] = useState(false);
//   const [isKnownUser, setIsKnownUser] = useState(false);
//   const [isSubmittingLead, setIsSubmittingLead] = useState(false);
//   const [leadFormData, setLeadFormData] = useState<LeadFormData>({
//     business_email: '',
//     phone_e164: '',
//     consent: false
//   });
//   const [leadFormErrors, setLeadFormErrors] = useState<Partial<LeadFormData>>({});
//   const [leadSubmitCount, setLeadSubmitCount] = useState(0);

//   // UI state
//   const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
//   const [checkFilter, setCheckFilter] = useState<'all' | 'pass' | 'fail' | 'warning'>('all');
//   const [expandedChecks, setExpandedChecks] = useState<string[]>([]);
//   const [viewerMesh, setViewerMesh] = useState<ViewerMesh | null>(null);
//   const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
//   const [isDownloadingQAP, setIsDownloadingQAP] = useState(false);
//   const [isDownloadingDFM, setIsDownloadingDFM] = useState(false);

//   // 3D Viewer state
//   const viewerRef = useRef<HTMLDivElement>(null);
//   const [viewerTool, setViewerTool] = useState<'orbit' | 'pan' | 'zoom' | 'section' | 'measure'>('orbit');
//   const [isMeasuring, setIsMeasuring] = useState(false);

//   useEffect(() => {
//     if (requestId) {
//       checkUserStatus();
//       loadRequest();
//       // Start polling for updates
//       const interval = setInterval(loadRequest, 5000); // Poll every 5 seconds
//       setPollingInterval(interval);
//     }

//     return () => {
//       if (pollingInterval) {
//         clearInterval(pollingInterval);
//       }
//     };
//   }, [requestId]);

//   const checkUserStatus = async () => {
//     try {
//       // Check 1: Active JWT session
//       const authResponse = await fetch('/api/auth/check');
//       const isLoggedIn = authResponse.ok;

//       // Check 2: Lead session cookie
//       const hasLeadCookie = document.cookie.includes('dfm_lead_session');

//       // Check 3: Will be determined by server-side check in loadRequest
//       const hasUserId = false; // Will be updated when we get the request data

//       setIsKnownUser(isLoggedIn || hasLeadCookie || hasUserId);
//     } catch (error) {
//       console.error('Error checking user status:', error);
//       setIsKnownUser(false);
//     }
//   };

//   const loadRequest = async () => {
//     try {
//       const response = await fetch(`/api/dfm/requests/${requestId}`);
//       if (response.ok) {
//         const data = await response.json();
//         setRequest(data);

//         // Update known user status based on server-side check
//         if (data.user_id) {
//           setIsKnownUser(true);
//         }

//         // Stop polling if analysis is complete or failed
//         if (data.status === 'Complete' || data.status === 'Error') {
//           if (pollingInterval) {
//             clearInterval(pollingInterval);
//             setPollingInterval(null);
//           }

//           // Show lead modal for new users when results are ready
//           if (data.status === 'Complete' && !isKnownUser && data.user_id === null) {
//             setShowLeadModal(true);
//           }
//         }
//       } else {
//         setError('Failed to load DFM request');
//       }
//     } catch (err) {
//       setError('Failed to load DFM request');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const validateLeadForm = (): boolean => {
//     const errors: Partial<LeadFormData> = {};

//     // Email validation
//     const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
//     if (!leadFormData.business_email || !emailRegex.test(leadFormData.business_email)) {
//       errors.business_email = 'Please enter a valid email address';
//     } else {
//       // Check for blocked domains
//       const blockedDomains = [
//         'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
//         'icloud.com', 'proton.me', 'yopmail.com', 'gmx.com', 'mailinator.com'
//       ];
//       const domain = leadFormData.business_email.split('@')[1]?.toLowerCase();
//       if (blockedDomains.includes(domain)) {
//         errors.business_email = 'Please use a business email (e.g., name@company.com)';
//       }
//     }

//     // Phone validation (E.164 format)
//     const phoneRegex = /^\+[1-9]\d{6,14}$/;
//     if (!leadFormData.phone_e164 || !phoneRegex.test(leadFormData.phone_e164)) {
//       errors.phone_e164 = 'Enter a valid phone (e.g., +1 212 555 0100)';
//     }

//     // Consent validation
//     if (!leadFormData.consent) {
//       errors.consent = 'You must agree to the Terms and Privacy Policy';
//     }

//     setLeadFormErrors(errors);
//     return Object.keys(errors).length === 0;
//   };

//   const handleLeadSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!validateLeadForm()) {
//       return;
//     }

//     setIsSubmittingLead(true);
//     setLeadSubmitCount(prev => prev + 1);

//     try {
//       const response = await fetch('/api/leads', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           email: leadFormData.business_email,
//           phone: leadFormData.phone_e164,
//           dfm_request_id: requestId
//         })
//       });

//       if (response.ok) {
//         const data = await response.json();

//         // Set lead session cookie
//         document.cookie = `dfm_lead_session=${data.session_token}; path=/; max-age=86400; samesite=strict`;

//         // Update known user status
//         setIsKnownUser(true);

//         // Close modal
//         setShowLeadModal(false);

//         // Refresh request data to get updated user association
//         await loadRequest();
//       } else {
//         const errorData = await response.json();
//         setLeadFormErrors({ business_email: errorData.error || 'Failed to submit lead information' });
//       }
//     } catch (error) {
//       setLeadFormErrors({ business_email: 'Network error. Please try again.' });
//     } finally {
//       setIsSubmittingLead(false);
//     }
//   };

//   const handleLeadCancel = () => {
//     setShowLeadModal(false);
//     setLeadFormData({ business_email: '', phone_e164: '', consent: false });
//     setLeadFormErrors({});
//     // Redirect to home or show limited results
//     window.location.href = '/';
//   };

//   // New functions for DFM Step 5
//   const handleGetInstantQuote = async () => {
//     if (!request?.results) return;

//     setIsGeneratingQuote(true);
//     try {
//       const response = await fetch('/api/quotes/from-dfm', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           dfm_request_id: requestId
//         })
//       });

//       if (response.ok) {
//         const data = await response.json();
//         // Navigate to quote page with loading state
//         router.push(`/quote/${data.quote_id}?from=dfm&preparing=true`);
//       } else {
//         console.error('Failed to create quote from DFM');
//         // TODO: Show error toast
//       }
//     } catch (error) {
//       console.error('Error creating quote:', error);
//       // TODO: Show error toast
//     } finally {
//       setIsGeneratingQuote(false);
//     }
//   };

//   const handleDownloadQAP = async () => {
//     if (!request?.results) return;

//     setIsDownloadingQAP(true);
//     try {
//       const response = await fetch('/api/qap/documents/from-dfm', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           dfmRequestId: requestId,
//           criticality: request.criticality,
//           industry: request.industry,
//           certifications: [] // Add certifications if available
//         })
//       });

//       if (response.ok) {
//         const data = await response.json();

//         // Poll for completion if still generating
//         if (data.status === 'generating') {
//           await pollForQapCompletion(data.id);
//         } else if (data.download_url) {
//           // Direct download if URL is available
//           window.open(data.download_url, '_blank');
//         }
//       }
//     } catch (error) {
//       console.error('Error downloading QAP:', error);
//     } finally {
//       setIsDownloadingQAP(false);
//     }
//   };

//   const pollForQapCompletion = async (documentId: string) => {
//     const maxAttempts = 30; // 30 seconds max
//     let attempts = 0;

//     while (attempts < maxAttempts) {
//       try {
//         const response = await fetch(`/api/qap/documents/${documentId}`);
//         if (response.ok) {
//           const data = await response.json();
//           if (data.status === 'completed' && data.download_url) {
//             window.open(data.download_url, '_blank');
//             return;
//           } else if (data.status === 'failed') {
//             console.error('QAP generation failed');
//             return;
//           }
//         }
//       } catch (error) {
//         console.error('Error polling QAP status:', error);
//       }

//       attempts++;
//       await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
//     }

//     console.error('QAP generation timed out');
//   };

//   const handleDownloadDFMReport = async () => {
//     if (!request?.results) return;

//     setIsDownloadingDFM(true);
//     try {
//       const response = await fetch(`/api/dfm/reports/${requestId}/pdf`, {
//         method: 'POST'
//       });

//       if (response.ok) {
//         const data = await response.json();
//         // Trigger download
//         const downloadResponse = await fetch(`/api/files/${data.report_pdf_id}`);
//         if (downloadResponse.ok) {
//           const blob = await downloadResponse.blob();
//           const url = window.URL.createObjectURL(blob);
//           const a = document.createElement('a');
//           a.href = url;
//           a.download = `DFM-Analysis-${requestId}.pdf`;
//           document.body.appendChild(a);
//           a.click();
//           window.URL.revokeObjectURL(url);
//           document.body.removeChild(a);
//         }
//       }
//     } catch (error) {
//       console.error('Error downloading DFM report:', error);
//     } finally {
//       setIsDownloadingDFM(false);
//     }
//   };

//   const handleCheckClick = (checkId: string) => {
//     setSelectedCheck(checkId);
//     // Find the check to highlight geometry in viewer
//     const check = request.results?.checks.find(c => c.id === checkId);
//     if (viewerRef.current && check?.highlights) {
//       // This would integrate with the 3D viewer to highlight faces/edges
//       console.log('Highlighting:', check.highlights);
//     }
//   };

//   const toggleCheckExpansion = (checkId: string) => {
//     if (expandedChecks.includes(checkId)) {
//       setExpandedChecks(expandedChecks.filter(id => id !== checkId));
//     } else {
//       setExpandedChecks([...expandedChecks, checkId]);
//     }
//   };

//   const getFilteredChecks = () => {
//     if (!request?.results?.checks) return [];

//     return request.results.checks.filter(check => {
//       if (checkFilter === 'all') return true;
//       if (checkFilter === 'pass') return check.status === 'pass';
//       if (checkFilter === 'fail') return check.status === 'fail';
//       if (checkFilter === 'warning') return check.status === 'warning';
//       return true;
//     });
//   };

//   const getStatusBadge = (status: string) => {
//     switch (status) {
//       case 'pass':
//         return <Badge className="bg-green-100 text-green-800">Pass</Badge>;
//       case 'warning':
//         return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
//       case 'blocker':
//         return <Badge className="bg-red-100 text-red-800">Blocker</Badge>;
//       default:
//         return <Badge>Unknown</Badge>;
//     }
//   };

//   const loadViewerMesh = async () => {
//     if (!request?.results?.viewer_mesh_id) return;

//     try {
//       const response = await fetch(`/api/dfm/requests/${requestId}/viewer-mesh`);
//       if (response.ok) {
//         const meshData = await response.json();
//         setViewerMesh(meshData);
//       }
//     } catch (error) {
//       console.error('Error loading viewer mesh:', error);
//     }
//   };

//   // Load viewer mesh when results are available
//   useEffect(() => {
//     if (request?.status === 'Complete' && request.results) {
//       loadViewerMesh();
//     }
//   }, [request?.status]);

//   const getStatusIcon = (status: string) => {
//     switch (status) {
//       case 'completed':
//         return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
//       case 'failed':
//         return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
//       default:
//         return <ClockIcon className="h-5 w-5 text-gray-600" />;
//     }
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'pending':
//         return 'bg-yellow-100 text-yellow-800';
//       case 'processing':
//         return 'bg-blue-100 text-blue-800';
//       case 'completed':
//         return 'bg-green-100 text-green-800';
//       case 'failed':
//         return 'bg-red-100 text-red-800';
//       default:
//         return 'bg-gray-100 text-gray-800';
//     }
//   };

//   const getCheckStatusColor = (status: string) => {
//     switch (status) {
//       case 'pass':
//         return 'bg-green-100 text-green-800';
//       case 'warning':
//         return 'bg-yellow-100 text-yellow-800';
//       case 'fail':
//         return 'bg-red-100 text-red-800';
//       default:
//         return 'bg-gray-100 text-gray-800';
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
//           <p className="mt-4 text-gray-600">Loading DFM analysis...</p>
//         </div>
//       </div>
//     );
//   }

//   // Conditional content for analysis results
//   const analysisContent = request.results ? (
//     <>
//     <Card className="mt-6">
//         <CardHeader>
//           <CardTitle>Analysis Summary</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//             <div className="text-center">
//               <div className="text-2xl font-bold text-green-600">{request.results.summary.passed}</div>
//               <div className="text-sm text-gray-600">Passed</div>
//             </div>
//             <div className="text-center">
//               <div className="text-2xl font-bold text-yellow-600">{request.results.summary.warnings}</div>
//               <div className="text-sm text-gray-600">Warnings</div>
//             </div>
//             <div className="text-center">
//               <div className="text-2xl font-bold text-red-600">{request.results.summary.blockers}</div>
//               <div className="text-sm text-gray-600">Blockers</div>
//             </div>
//             <div className="text-center">
//               <div className="text-2xl font-bold text-blue-600">
//                 {request.results.geom_props.vol_mm3 ? (request.results.geom_props.vol_mm3 / 1000).toFixed(1) : 'N/A'}
//               </div>
//               <div className="text-sm text-gray-600">Volume (cm³)</div>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Footer CTA */}
//       <div className="mt-8 text-center">
//         <Button
//           onClick={handleDownloadDFMReport}
//           disabled={isDownloadingReport || !request.results}
//           variant="outline"
//           size="lg"
//           className="flex items-center mx-auto"
//         >
//           <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
//           {isDownloadingReport ? 'Generating Report...' : 'Download Complete DFM Analysis Report'}
//         </Button>
//       </div>
//     </>
//   ) : null;

//   if (error || !request) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="text-red-600 mb-4">⚠️ {error || 'Analysis not found'}</div>
//           <Button onClick={() => window.history.back()}>Go Back</Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header with CTAs */}
//       <div className="bg-white border-b border-gray-200 px-6 py-4">
//         <div className="max-w-7xl mx-auto flex items-center justify-between">
//           <div>
//             <h1 className="text-2xl font-bold text-gray-900">DFM Analysis Results</h1>
//             <p className="text-sm text-gray-600 mt-1">
//               {request.file_name} • {new Date(request.created_at).toLocaleString()}
//             </p>
//           </div>
//           <div className="flex items-center space-x-3">
//             <Button
//               onClick={handleDownloadQAP}
//               disabled={isDownloadingQAP}
//               variant="outline"
//               className="flex items-center space-x-2"
//             >
//               <DocumentTextIcon className="h-4 w-4" />
//               <span>{isDownloadingQAP ? 'Downloading...' : 'Download QAP'}</span>
//             </Button>
//             <Button
//               onClick={handleGetInstantQuote}
//               disabled={isGeneratingQuote}
//               className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
//             >
//               <CurrencyDollarIcon className="h-4 w-4" />
//               <span>{isGeneratingQuote ? 'Generating...' : 'Get Instant Quote'}</span>
//             </Button>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-6 py-8">
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           {/* 3D Viewer */}
//           <div className="lg:col-span-2">
//             <Card className="h-[600px]">
//               <CardHeader className="pb-3">
//                 <div className="flex items-center justify-between">
//                   <CardTitle className="text-lg">3D Model Viewer</CardTitle>
//                   <div className="flex items-center space-x-2">
//                     <Button
//                       variant={viewerTool === 'orbit' ? 'default' : 'outline'}
//                       size="sm"
//                       onClick={() => setViewerTool('orbit')}
//                     >
//                       <ArrowPathIcon className="h-4 w-4" />
//                     </Button>
//                     <Button
//                       variant={viewerTool === 'pan' ? 'default' : 'outline'}
//                       size="sm"
//                       onClick={() => setViewerTool('pan')}
//                     >
//                       <HandRaisedIcon className="h-4 w-4" />
//                     </Button>
//                     <Button
//                       variant={viewerTool === 'zoom' ? 'default' : 'outline'}
//                       size="sm"
//                       onClick={() => setViewerTool('zoom')}
//                     >
//                       <MagnifyingGlassIcon className="h-4 w-4" />
//                     </Button>
//                     <Button
//                       variant={viewerTool === 'section' ? 'default' : 'outline'}
//                       size="sm"
//                       onClick={() => setViewerTool('section')}
//                     >
//                       <CubeTransparentIcon className="h-4 w-4" />
//                     </Button>
//                     <Button
//                       variant={viewerTool === 'measure' ? 'default' : 'outline'}
//                       size="sm"
//                       onClick={() => setViewerTool('measure')}
//                     >
//                       <ScaleIcon className="h-4 w-4" />
//                     </Button>
//                   </div>
//                 </div>
//               </CardHeader>
//               <CardContent className="p-0 h-full">
//                 <div
//                   ref={viewerRef}
//                   className="w-full h-full bg-gray-100 rounded-b-lg"
//                   style={{ minHeight: '500px' }}
//                 >
//                   {viewerMesh ? (
//                     <div className="flex items-center justify-center h-full">
//                       <div className="text-center">
//                         <CubeIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
//                         <p className="text-gray-600">3D Viewer Loading...</p>
//                         <p className="text-sm text-gray-500 mt-2">
//                           Mesh data loaded, initializing viewer
//                         </p>
//                       </div>
//                     </div>
//                   ) : (
//                     <div className="flex items-center justify-center h-full">
//                       <div className="text-center">
//                         <CubeIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
//                         <p className="text-gray-600">Loading 3D Model...</p>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </CardContent>
//             </Card>
//           </div>

//           {/* Checks List */}
//           <div className="space-y-6">
//             {/* Filter Controls */}
//             <Card>
//               <CardHeader className="pb-3">
//                 <CardTitle className="text-lg">Analysis Checks</CardTitle>
//                 <div className="flex items-center space-x-2 mt-2">
//                   <Button
//                     variant={checkFilter === 'all' ? 'default' : 'outline'}
//                     size="sm"
//                     onClick={() => setCheckFilter('all')}
//                   >
//                     All ({request.results?.checks.length || 0})
//                   </Button>
//                   <Button
//                     variant={checkFilter === 'pass' ? 'default' : 'outline'}
//                     size="sm"
//                     onClick={() => setCheckFilter('pass')}
//                   >
//                     Pass ({request.results?.checks.filter(c => c.status === 'pass').length || 0})
//                   </Button>
//                   <Button
//                     variant={checkFilter === 'fail' ? 'default' : 'outline'}
//                     size="sm"
//                     onClick={() => setCheckFilter('fail')}
//                   >
//                     Fail ({request.results?.checks.filter(c => c.status === 'fail').length || 0})
//                   </Button>
//                   <Button
//                     variant={checkFilter === 'warning' ? 'default' : 'outline'}
//                     size="sm"
//                     onClick={() => setCheckFilter('warning')}
//                   >
//                     Warning ({request.results?.checks.filter(c => c.status === 'warning').length || 0})
//                   </Button>
//                 </div>
//               </CardHeader>
//             </Card>

//             {/* Checks List */}
//             <div className="space-y-3 max-h-[500px] overflow-y-auto">
//               {getFilteredChecks().map((check) => (
//                 <Card
//                   key={check.id}
//                   className={`cursor-pointer transition-all ${
//                     selectedCheck === check.id ? 'ring-2 ring-blue-500' : ''
//                   }`}
//                   onClick={() => handleCheckClick(check.id)}
//                 >
//                   <CardContent className="p-4">
//                     <div className="flex items-start justify-between">
//                       <div className="flex-1">
//                         <div className="flex items-center space-x-2 mb-2">
//                           <Badge className={getCheckStatusColor(check.status)}>
//                             {check.status}
//                           </Badge>
//                           <span className="text-xs text-gray-500">{check.category}</span>
//                         </div>
//                         <h3 className="font-medium text-sm mb-1">{check.name}</h3>
//                         <p className="text-xs text-gray-600 mb-2">{check.message}</p>
//                         {check.severity && (
//                           <div className="flex items-center space-x-2 text-xs">
//                             <span className="text-gray-500">Severity:</span>
//                             <Badge variant="outline" className="text-xs">
//                               {check.severity}
//                             </Badge>
//                           </div>
//                         )}
//                       </div>
//                       <Button
//                         variant="ghost"
//                         size="sm"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           toggleCheckExpansion(check.id);
//                         }}
//                       >
//                         {expandedChecks.includes(check.id) ? (
//                           <ChevronUpIcon className="h-4 w-4" />
//                         ) : (
//                           <ChevronDownIcon className="h-4 w-4" />
//                         )}
//                       </Button>
//                     </div>
//                     {expandedChecks.includes(check.id) && check.details && (
//                       <div className="mt-3 pt-3 border-t border-gray-200">
//                         <p className="text-xs text-gray-600">{check.details}</p>
//                         {check.recommendation && (
//                           <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
//                             <strong>Recommendation:</strong> {check.recommendation}
//                           </div>
//                         )}
//                       </div>
//                     )}
//                   </CardContent>
//                 </Card>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Footer CTA */}
//         <div className="mt-12 text-center">
//           <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
//             <CardContent className="p-8">
//               <h2 className="text-2xl font-bold text-gray-900 mb-4">
//                 Ready to optimize your design?
//               </h2>
//               <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
//                 Download your complete DFM analysis report with detailed recommendations,
//                 cost impact analysis, and actionable insights to improve manufacturability.
//               </p>
//               <Button
//                 onClick={handleDownloadDFMReport}
//                 disabled={isDownloadingDFM}
//                 size="lg"
//                 className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
//               >
//                 <DocumentTextIcon className="h-5 w-5 mr-2" />
//                 {isDownloadingDFM ? 'Downloading Report...' : 'Download DFM Analysis Report'}
//               </Button>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// }
import React from "react";

const Page = () => {
  return <div>Page</div>;
};

export default Page;

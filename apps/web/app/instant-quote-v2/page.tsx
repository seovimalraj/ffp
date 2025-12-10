'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Zap, Shield, Clock, CheckCircle, X, AlertCircle, Sparkles, Mail, Loader2 } from 'lucide-react';
import DemoNavigation from '@/components/DemoNavigation';
import CadViewer3D from '@/components/CadViewer3D';
import { createQuote, uploadFile } from '../../lib/database';

export default function InstantQuoteV2Page() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (files.length === 0) {
      alert('Please upload at least one file');
      return;
    }
    setShowEmailPopup(true);
  };

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setIsUploading(true);
    
    try {
      // Upload all files to MinIO
      const uploadedFiles = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const uploadedFile = await uploadFile(file);
        uploadedFiles.push(uploadedFile);
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      }
      
      // Create quote in database with email and password for account creation
      const quote = await createQuote(email, uploadedFiles);
      
      // Store credentials in sessionStorage temporarily for checkout
      sessionStorage.setItem('tempUserEmail', email);
      sessionStorage.setItem('tempUserPassword', password);
      
      // Navigate to quote configuration
      router.push(`/quote-config/${quote.id}`);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Failed to upload files. Please try again.');
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CNC Quote
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost">Sign In</Button>
              <Button className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Get Instant Manufacturing Quotes
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Upload your 3D files and get competitive quotes from verified manufacturers
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Fast Quotes</h3>
              <p className="text-sm text-gray-600">Get quotes in minutes, not days</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Quality Assured</h3>
              <p className="text-sm text-gray-600">ISO certified manufacturers</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Best Prices</h3>
              <p className="text-sm text-gray-600">Competitive marketplace pricing</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Your 3D Files</h2>
            
            {/* Drag & Drop Zone */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50">
              <input
                type="file"
                multiple
                accept=".step,.stp,.stl,.iges,.igs,.x_t,.x_b"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Drag & drop your files here
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  Supported: STEP, STL, IGES, Parasolid (Max 100MB per file)
                </p>
              </label>
            </div>

            {/* Uploaded Files */}
            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-gray-900">Uploaded Files ({files.length})</h3>
                {files.map((file, index) => (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* 3D Preview */}
                    <CadViewer3D fileName={file.name} file={file} height="300px" className="rounded-lg overflow-hidden" />
                  </div>
                ))}
                
                {/* Continue Button */}
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 mt-6"
                  onClick={handleContinue}
                  size="lg"
                >
                  Continue to Create Account
                  <CheckCircle className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Popup Dialog */}
        <Dialog open={showEmailPopup} onOpenChange={setShowEmailPopup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create Your Account</DialogTitle>
              <DialogDescription className="text-base">
                Set up your account to track your quote and orders
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Secure Account</p>
                    <p className="text-blue-700">
                      Use this password to check your quote status and order updates anytime.
                    </p>
                  </div>
                </div>
              </div>

              {isUploading && (
                <div className="space-y-2">
                  {Object.entries(uploadProgress).map(([fileName, progress]) => (
                    <div key={fileName} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate">{fileName}</span>
                        <span className="text-blue-600 ml-2">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleSubmit}
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isUploading ? 'Uploading Files...' : 'Creating Quote...'}
                  </>
                ) : (
                  <>
                    Continue to Quote Configuration
                    <CheckCircle className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

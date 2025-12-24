'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PublicLayout from '@/components/PublicLayout';
import { ArrowRightIcon, DocumentIcon, CogIcon } from '@heroicons/react/24/outline';

export default function GetQuotePage() {
  const router = useRouter();

  const handleGetQuote = () => {
    router.push('/instant-quote');
  };

  const handleDFMAnalysis = () => {
    router.push('/dfm-analysis');
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Get Your CNC Quote
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose how you'd like to get your manufacturing quote. Upload your files for instant pricing or get a detailed DFM analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Instant Quote */}
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <DocumentIcon className="h-8 w-8 text-blue-600 mr-3" />
                  Instant Quote
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-6">
                  Upload your CAD files and get an instant quote with our AI-powered pricing engine.
                  Perfect for standard parts and quick turnaround.
                </p>
                <ul className="text-sm text-gray-600 mb-6 space-y-2">
                  <li>• Instant pricing results</li>
                  <li>• Multiple file format support</li>
                  <li>• Volume discount calculations</li>
                  <li>• Lead time estimates</li>
                </ul>
                <Button
                  onClick={handleGetQuote}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  Get Instant Quote
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>

            {/* DFM Analysis */}
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <CogIcon className="h-8 w-8 text-green-600 mr-3" />
                  DFM Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-6">
                  Get a comprehensive Design for Manufacturability analysis with detailed feedback,
                  optimization suggestions, and cost-saving recommendations.
                </p>
                <ul className="text-sm text-gray-600 mb-6 space-y-2">
                  <li>• Detailed manufacturability report</li>
                  <li>• Cost optimization suggestions</li>
                  <li>• Material and finish recommendations</li>
                  <li>• Tolerance analysis</li>
                </ul>
                <Button
                  onClick={handleDFMAnalysis}
                  className="w-full bg-green-600 hover:bg-green-700"
                  variant="outline"
                  size="lg"
                >
                  Get DFM Analysis
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Additional Info */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Choose Our Service?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <DocumentIcon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Multiple Formats</h3>
                <p className="text-gray-600 text-sm">Support for STEP, IGES, SLDPRT, STL, and more</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <CogIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Expert Analysis</h3>
                <p className="text-gray-600 text-sm">AI-powered analysis with manufacturing expertise</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <ArrowRightIcon className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Quick Results</h3>
                <p className="text-gray-600 text-sm">Get quotes in minutes, not days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Pricing</h1>
        <div className="bg-white rounded-lg shadow-sm p-8">
          <p className="text-lg text-gray-600 mb-4">
            Get instant, transparent pricing for your CNC parts with our automated quoting system.
          </p>
          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Instant Quotes</h2>
              <p className="text-gray-600">
                Upload your CAD files and get pricing in seconds. No hidden fees, no surprises.
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Volume Discounts</h2>
              <p className="text-gray-600">
                Save more with larger quantities. Our pricing automatically adjusts for bulk orders.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Multiple Lead Times</h2>
              <p className="text-gray-600">
                Choose from Economy, Standard, or Expedite options to match your timeline.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <a 
              href="/instant-quote" 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Get Your Quote Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

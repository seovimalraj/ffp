import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Contact Us</h1>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Get in Touch
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">Sales & Quotes</h3>
                <p className="text-gray-600">
                  For pricing questions and custom quotes
                </p>
                <p className="text-blue-600">sales@cncquote.com</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Technical Support</h3>
                <p className="text-gray-600">
                  For file upload and technical issues
                </p>
                <p className="text-blue-600">support@cncquote.com</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Partnership</h3>
                <p className="text-gray-600">
                  For business partnerships and integrations
                </p>
                <p className="text-blue-600">partners@cncquote.com</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Quick Help
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">Need a Quote?</h3>
                <p className="text-gray-600 mb-2">
                  Upload your CAD files for instant pricing
                </p>
                <a
                  href="/instant-quote"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Get Instant Quote →
                </a>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Help Center</h3>
                <p className="text-gray-600 mb-2">
                  Browse FAQs and documentation
                </p>
                <Link
                  href="/help"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Visit Help Center →
                </Link>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">DFM Analysis</h3>
                <p className="text-gray-600 mb-2">
                  Get design for manufacturing feedback
                </p>
                <Link
                  href="/dfm-analysis"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Learn About DFM →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

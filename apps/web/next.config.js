/**
 * @ownership web-platform
 * @raci docs/governance/raci-matrix.yaml
 */

const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  output:
    process.env.NEXT_OUTPUT === "standalone"
      ? "standalone"
      : process.platform === "win32"
        ? undefined
        : "standalone",
  transpilePackages: ["three"],
  turbopack: {},
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "app.frigate.ai"],
    },
    forceSwcTransforms: true,
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for OpenCascade.js
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle .wasm files properly
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
      loader: "file-loader",
    });

    // Exclude OpenCascade.js from server-side processing entirely
    if (isServer) {
      config.externals = [...config.externals, "opencascade.js"];
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
  // External packages that should not be bundled
  serverExternalPackages: ["pg"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ["app.frigate.ai", "frigate.ai"],
  },
  // Disable static generation completely
  trailingSlash: false,
  // Force all pages to be dynamic
  generateBuildId: async () => {
    return "build-" + Date.now();
  },

  // Security and permissions headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'bluetooth=(), camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },

  // Commenting out aggressive headers for now to fix static asset loading
  // async headers() {
  //   return [
  //     {
  //       // Apply security headers only to pages, not static assets
  //       source: '/((?!_next|favicon.ico|.*\\.).*)',
  //       headers: [
  //         {
  //           key: 'X-Frame-Options',
  //           value: 'DENY',
  //         },
  //         {
  //           key: 'X-Content-Type-Options',
  //           value: 'nosniff',
  //         },
  //         {
  //           key: 'X-XSS-Protection',
  //           value: '1; mode=block',
  //         },
  //         {
  //           key: 'Referrer-Policy',
  //           value: 'same-origin',
  //         },
  //         {
  //           key: 'Cache-Control',
  //           value: 'no-cache, no-store, must-revalidate',
  //         },
  //         {
  //           key: 'Pragma',
  //           value: 'no-cache',
  //         },
  //         {
  //           key: 'Expires',
  //           value: '0',
  //         },
  //       ],
  //     },
  //   ];
  // },
};

module.exports = nextConfig;

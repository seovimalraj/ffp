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
      allowedOrigins: [
        "localhost:3000",
        "app.frigate.ai",
        "frigate.ai",
      ],
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

    // Exclude OpenCascade.js from server-side processing
    if (isServer) {
      config.externals = [
        ...config.externals,
        "opencascade.js",
      ];
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
    domains: [
      "app.frigate.ai",
      "frigate.ai",
    ],
  },

  trailingSlash: false,

  // Force all pages to be dynamic
  generateBuildId: async () => {
    return "build-" + Date.now();
  },

  /**
   * Security headers
   *
   * IMPORTANT:
   * app.frigate.ai is intentionally allowed to be
   * embedded by frigate.ai.
   *
   * Do NOT use:
   *
   * X-Frame-Options: SAMEORIGIN
   *
   * because frigate.ai and app.frigate.ai are
   * different origins.
   */
  async headers() {
    const headers = [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "bluetooth=(), camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          // Modern iframe policy.
          // Allows frigate.ai to embed app.frigate.ai.
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://frigate.ai https://www.frigate.ai;",
          },
        ],
      },
    ];

    // HSTS only in production
    if (process.env.NODE_ENV === "production") {
      headers[0].headers.push({
        key: "Strict-Transport-Security",
        value:
          "max-age=63072000; includeSubDomains; preload",
      });
    }

    return headers;
  },
};

module.exports = nextConfig;
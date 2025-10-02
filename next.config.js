/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config) => {
    // WASMファイルのサポートを追加
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // WebAssemblyの実験的機能を有効化
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
  // COOP/COEP headers for SharedArrayBuffer support (required for TensorFlow.js in production)
  // Development environment doesn't need these headers
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      console.log('Skipping COOP/COEP headers in development mode');
      return []
    }
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig

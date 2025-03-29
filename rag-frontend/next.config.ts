/** @type {import('next').NextConfig} */
import { Configuration as WebpackConfig } from 'webpack';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Configure security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Prevent browsers from incorrectly detecting non-scripts as scripts
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Prevent embedding on other domains (clickjacking protection)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS Protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Strict Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              font-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'none';
              connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'};
              upgrade-insecure-requests;
            `.replace(/\s{2,}/g, ' ').trim(),
          },
          // Enable Strict Transport Security with a 1 year duration
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Only allow HTTPS on this domain
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Disable browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  
  // Add environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // Add custom webpack configuration
  webpack: (config: WebpackConfig, { isServer }: { isServer: boolean }) => {
    // Ensure config.resolve exists
    if (!config.resolve) {
      config.resolve = {};
    }
    
    // Ensure config.resolve.fallback exists
    config.resolve.fallback = config.resolve.fallback || {};
    
    // Add fallback for punycode
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      punycode: false 
    };
    
    // Ensure config.module exists
    if (!config.module) {
      config.module = {
        rules: []
      };
    }
    
    // Ensure config.module.rules exists
    if (!config.module.rules) {
      config.module.rules = [];
    }
    
    // Security measures - disable eval
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      use: [{
        loader: 'string-replace-loader',
        options: {
          search: 'eval\\(',
          replace: 'throw new Error("eval not allowed"); (',
          flags: 'g'
        }
      }]
    });
    
    return config;
  },
};

export default nextConfig;
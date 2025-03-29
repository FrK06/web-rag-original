import { NextConfig } from 'next';
import { Configuration as WebpackConfig } from 'webpack';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Add allowed origins for development
  allowedDevOrigins: ["192.168.1.101"],
  
  /* Webpack configuration */
  webpack: (config: WebpackConfig) => {
    // Add fallback for punycode
    config.resolve = config.resolve || {};
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      punycode: false 
    };
    return config;
  },
};

export default nextConfig;
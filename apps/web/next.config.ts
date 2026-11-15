import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@trendie/inspection', '@trendie/agent'],
};

export default nextConfig;

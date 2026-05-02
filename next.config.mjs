/** @type {import('next').NextConfig} */
const nextConfig = {
  // Root level configuration for integrated bot + dashboard
  reactStrictMode: true,
  transpilePackages: ['@bot'],
};

export default nextConfig;

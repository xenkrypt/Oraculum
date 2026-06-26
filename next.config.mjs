/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/agent/:path*",
        destination: "http://localhost:8000/:path*"
      }
    ];
  },
  // Allow Three.js and Framer Motion to be transpiled
  transpilePackages: ["three"]
};

export default nextConfig;

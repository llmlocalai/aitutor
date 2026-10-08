/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // In production Vercel serves api/*.py as Python functions on /api/*.
    // In local dev, `npm run dev:api` serves the same handlers on :5328.
    if (process.env.NODE_ENV === "development") {
      return [{ source: "/api/:path*", destination: "http://127.0.0.1:5328/api/:path*" }];
    }
    return [];
  },
};
export default nextConfig;

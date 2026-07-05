/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  poweredByHeader: false,
};

export default nextConfig;

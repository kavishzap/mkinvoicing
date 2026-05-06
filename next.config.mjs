import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {},
  async redirects() {
    return [
      {
        source: "/app/inventory/products",
        destination: "/app/products",
        permanent: true,
      },
      {
        source: "/app/inventory/products/:path*",
        destination: "/app/products/:path*",
        permanent: true,
      },
      {
        source: "/app/inventory/locations",
        destination: "/app/locations",
        permanent: true,
      },
      {
        source: "/app/inventory/locations/:path*",
        destination: "/app/locations/:path*",
        permanent: true,
      },
    ];
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Avoid immediate takeover + full reload when a new service worker activates
  // (e.g. after deploy), which clears in-memory form state.
  skipWaiting: false,
});

export default withPWA(nextConfig);

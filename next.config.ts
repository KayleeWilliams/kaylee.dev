import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  images: {
    qualities: [100, 75],
  },
  experimental: {
    viewTransition: true,
  },
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  redirects() {
    return [
      {
        source: "/experience/consent",
        destination: "/experience/inth",
        permanent: true,
      },
    ];
  },
  rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
          destination: "/markdown",
        },
      ],
      afterFiles: [
        {
          source: "/api/prawns/:path*",
          destination: "https://kaylee-europe-portfolio.c15t.dev/:path*",
        },
      ],
      fallback: [],
    };
  },
};

export default withMDX(nextConfig);

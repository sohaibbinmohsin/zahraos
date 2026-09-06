import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/team", destination: "/team/members", permanent: false },
      { source: "/staff", destination: "/team/members", permanent: false },
      { source: "/roles", destination: "/team/roles", permanent: false },
    ];
  },
};

export default nextConfig;

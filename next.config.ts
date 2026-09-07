import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without it Turbopack walks up and latches onto
  // the stray package-lock.json in ~/Developer/rizq, which is outside this
  // repo, and warns that it ignored it.
  turbopack: { root: path.resolve(__dirname) },
  async redirects() {
    return [
      { source: "/team", destination: "/team/members", permanent: false },
      { source: "/staff", destination: "/team/members", permanent: false },
      { source: "/roles", destination: "/team/roles", permanent: false },
      { source: "/youth-republic", destination: "/youth-republic/dashboard", permanent: false },
      { source: "/youth-republic/opportunities", destination: "/youth-republic/drives", permanent: false },
      { source: "/modules/youth-republic", destination: "/youth-republic/dashboard", permanent: false },
      { source: "/modules/youth-republic/opportunities", destination: "/youth-republic/drives", permanent: false },
      { source: "/modules/youth-republic/:path*", destination: "/youth-republic/:path*", permanent: false },
    ];
  },
};

export default nextConfig;

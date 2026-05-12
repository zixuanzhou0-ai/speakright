import path from "node:path";
import type { NextConfig } from "next";

const isStaticExport =
  process.env.SPEAKRIGHT_STATIC_EXPORT === "1" ||
  process.env.npm_lifecycle_event === "build:desktop-frontend";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  reactCompiler: true,
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'image Docker a besoin d'un serveur autonome ; Vercel gère le build lui-même.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
  agentRules: false,
};

export default nextConfig;

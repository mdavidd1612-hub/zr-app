import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rendimiento (16-nov-2026): solo se empaqueta lo que de verdad se usa de
  // estas librerias (menos JavaScript que descargar en cada pantalla).
  experimental: {
    optimizePackageImports: ['@dnd-kit/core', '@dnd-kit/sortable', 'jspdf'],
  },
  compress: true,
};

export default nextConfig;

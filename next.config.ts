import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // heic-convert usa libheif-js (WASM) para decodificar HEIC de iPhone en la ruta de extracción de tickets.
  // Marcarlos como externos evita que el bundler los procese y garantiza que el .wasm viaje intacto al deploy.
  serverExternalPackages: ['heic-convert', 'libheif-js'],
};

export default nextConfig;

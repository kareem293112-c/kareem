import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Auto-generate firebase-applet-config.json if missing on build servers
const rootDir = process.cwd();
const configPath = path.join(rootDir, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.log("⚠️ [CONFIG AUTO-GEN] firebase-applet-config.json is missing. Checking environment variables...");
  const envConfig = process.env['firebase-applet-config.json'] || 
                    process.env.VITE_FIREBASE_CONFIG || 
                    process.env.FIREBASE_CONFIG;
  
  if (envConfig && envConfig.trim()) {
    try {
      const parsed = JSON.parse(envConfig.trim());
      fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf8');
      console.log("✅ [CONFIG AUTO-GEN] Generated firebase-applet-config.json from environment variable!");
    } catch (err: any) {
      console.error("❌ [CONFIG AUTO-GEN] Failed to parse env config JSON:", err.message);
    }
  } else {
    // Default fallback so typescript/vite build does not fail
    const defaultSkeleton = {
      apiKey: "",
      authDomain: "gen-lang-client-0348881645.firebaseapp.com",
      projectId: "gen-lang-client-0348881645",
      storageBucket: "gen-lang-client-0348881645.firebasestorage.app",
      messagingSenderId: "",
      appId: "",
      firestoreDatabaseId: "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698"
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultSkeleton, null, 2), 'utf8');
    console.log("⚠️ [CONFIG AUTO-GEN] Created a skeleton fallback firebase-applet-config.json to prevent compile failures.");
  }
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      nodePolyfills({
        include: ['crypto', 'buffer', 'stream', 'util', 'zlib'],
        globals: { Buffer: true, global: true, process: true },
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: true as const,
    },
    preview: {
      allowedHosts: true as const,
    },
  };
});

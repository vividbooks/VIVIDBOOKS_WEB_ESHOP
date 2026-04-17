
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';
  import path from 'path';

  /** GitHub project Pages: /REPO_NAME/ — jen když hostujeme pod github.io/…/repo (ne vlastní doména v kořeni) */
  const GH_PAGES_BASE = '/VIVIDBOOKS_WEB_ESHOP/';
  /** Výstup do `docs/` nebo CI s vlastní doménou — GitHub servíruje z kořene → `base` musí být `/` */
  const isRootHostedPages =
    process.env.DOCS_BUILD === '1' ||
    process.env.GITHUB_PAGES_ROOT_BASE === 'true';
  const isDocsOut = process.env.DOCS_BUILD === '1';
  const useGhPagesProjectBase =
    (process.env.GITHUB_ACTIONS === 'true' || process.env.GH_PAGES === 'true') &&
    !isRootHostedPages;

  export default defineConfig({
    base: useGhPagesProjectBase ? GH_PAGES_BASE : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'figma:asset/fce12557b4241e9dcd28ec0039874fe1ded5e852.png': path.resolve(__dirname, './src/assets/fce12557b4241e9dcd28ec0039874fe1ded5e852.png'),
        'figma:asset/f928acb891e8265d9830691e966c6bca8d2d5075.png': path.resolve(__dirname, './src/assets/f928acb891e8265d9830691e966c6bca8d2d5075.png'),
        'figma:asset/db84afa93444077cb60e4b748cf173c861c10de0.png': path.resolve(__dirname, './src/assets/db84afa93444077cb60e4b748cf173c861c10de0.png'),
        'figma:asset/cf223de1d9c5d972540d939e1fb808679daac389.png': path.resolve(__dirname, './src/assets/cf223de1d9c5d972540d939e1fb808679daac389.png'),
        'figma:asset/c0e1f7ff2870fec561ee629a31449f414a92db3a.png': path.resolve(__dirname, './src/assets/c0e1f7ff2870fec561ee629a31449f414a92db3a.png'),
        'figma:asset/bbde8e74dcbed50e5e8666811280e57aa9090ba7.png': path.resolve(__dirname, './src/assets/bbde8e74dcbed50e5e8666811280e57aa9090ba7.png'),
        'figma:asset/b05a2346a31b29d775f993d28775d8a3e4e96f1e.png': path.resolve(__dirname, './src/assets/b05a2346a31b29d775f993d28775d8a3e4e96f1e.png'),
        'figma:asset/a5bd04e33c840865cff9c78a48a58f012594060e.png': path.resolve(__dirname, './src/assets/a5bd04e33c840865cff9c78a48a58f012594060e.png'),
        'figma:asset/9f1895461ef1120b233afe7f1b904316f0c80fa5.png': path.resolve(__dirname, './src/assets/9f1895461ef1120b233afe7f1b904316f0c80fa5.png'),
        'figma:asset/8dd7fdc67b6204cfee0a957cdfc29c32967a4f62.png': path.resolve(__dirname, './src/assets/8dd7fdc67b6204cfee0a957cdfc29c32967a4f62.png'),
        'figma:asset/7b43f5a5bb152f5270c3f45b8dc173308f2ed4a9.png': path.resolve(__dirname, './src/assets/7b43f5a5bb152f5270c3f45b8dc173308f2ed4a9.png'),
        'figma:asset/4ae041a6aa46aa6c3b2e05f52158a5fa01a3b75f.png': path.resolve(__dirname, './src/assets/4ae041a6aa46aa6c3b2e05f52158a5fa01a3b75f.png'),
        'figma:asset/403a0fbfbfb2f2c9c31cd9207b06fabbec4a049a.png': path.resolve(__dirname, './src/assets/403a0fbfbfb2f2c9c31cd9207b06fabbec4a049a.png'),
        'figma:asset/3a530d09a46379d76110ccf21f857ba02c23a5dc.png': path.resolve(__dirname, './src/assets/3a530d09a46379d76110ccf21f857ba02c23a5dc.png'),
        'figma:asset/2d940b9c85e61db41d2367d380473f9cd449a402.png': path.resolve(__dirname, './src/assets/2d940b9c85e61db41d2367d380473f9cd449a402.png'),
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@supabase/supabase-js@2': '@supabase/supabase-js',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@jsr/supabase__supabase-js@2.49.8': '@jsr/supabase__supabase-js',
        '@': path.resolve(__dirname, './src'),
        '/utils': path.resolve(__dirname, './src/utils'),
      },
    },
    build: {
      target: 'esnext',
      outDir: isDocsOut ? 'docs' : 'build',
      /** Při `docs/` tam jsou i .md soubory — nesmazat je. Staré `docs/assets` čistí npm skript. */
      emptyOutDir: !isDocsOut,
    },
    server: {
      port: Number(process.env.PORT) || 3000,
      open: true,
      /** Sníží „Failed to fetch dynamically imported module“ při prvním lazy načtení (předtransformace). */
      warmup: {
        clientFiles: [
          './src/components/CatalogLayout.tsx',
          './src/components/CatalogGrid.tsx',
          './src/components/SubjectPageRoute.tsx',
          './src/components/SubjectPage.tsx',
          './src/components/ProductDetailRoute.tsx',
        ],
      },
    },
  });
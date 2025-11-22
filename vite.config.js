import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [basicSsl(), tsconfigPaths()],
  base: '/webtech-motorized/',
  esbuild: {
    jsxFactory: 'JSX.createElement',
    jsxFragment: 'HTMLElement'
  }
})
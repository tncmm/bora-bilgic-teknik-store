import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'bora-bilgic-teknik-store-1.onrender.com'
    ]
  },

  preview: {
    host: '0.0.0.0',
    allowedHosts: [
      'bora-bilgic-teknik-store-1.onrender.com'
    ]
  }
});
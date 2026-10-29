import { defineConfig } from 'cypress';

export default defineConfig({
  viewportWidth: 1280,
  viewportHeight: 800,
  e2e: {
    baseUrl: 'http://127.0.0.1:5174',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    testIsolation: true,
  },
});

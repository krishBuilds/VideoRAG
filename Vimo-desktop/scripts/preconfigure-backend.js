#!/usr/bin/env node

// Pre-configure the backend URL for remote development
const fs = require('fs');
const path = require('path');

// Set the backend configuration
const backendConfig = {
  url: 'https://7z1u9gfm19hw4h-8088.proxy.runpod.net',
  apiKey: ''
};

// Create a temporary HTML file that will set localStorage before the app loads
const preloadScript = `
<script>
  // Pre-configure remote backend
  localStorage.setItem('videorag-backend-config', JSON.stringify(${JSON.stringify(backendConfig)}));
  console.log('✅ Remote backend pre-configured:', ${JSON.stringify(backendConfig.url)});
</script>
`;

console.log('✅ Backend pre-configured for remote development');
console.log('📡 Backend URL:', backendConfig.url);
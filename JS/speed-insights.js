/**
 * Vercel Speed Insights initialization
 * This script loads and initializes Vercel Speed Insights for tracking web vitals
 * 
 * Based on @vercel/speed-insights v2.0.0
 * Documentation: https://vercel.com/docs/speed-insights/quickstart
 */

(function() {
  'use strict';
  
  // Initialize the Speed Insights queue (required before loading the script)
  if (!window.si) {
    window.si = function() {
      (window.siq = window.siq || []).push(arguments);
    };
  }
  
  // Create and configure the Speed Insights script
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  
  // Add SDK metadata
  script.dataset.sdkn = '@vercel/speed-insights/vanilla';
  script.dataset.sdkv = '2.0.0';
  
  // Error handler
  script.onerror = function() {
    console.log(
      '[Vercel Speed Insights] Failed to load script from ' + script.src + 
      '. Please check if any content blockers are enabled and try again.'
    );
  };
  
  // Inject the script into the page
  document.head.appendChild(script);
})();

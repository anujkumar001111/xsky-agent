// extract_assets.js
// Discovers stylesheets, scripts, and modules for resource awareness

(function() {
  function extractAssets() {
    const assets = {
      stylesheets: [],
      scripts: [],
      images: [] // Basic image discovery
    };

    // Stylesheets
    Array.from(document.styleSheets).forEach((sheet, index) => {
      try {
        assets.stylesheets.push({
          href: sheet.href,
          type: sheet.type,
          index: index,
          rulesCount: sheet.cssRules ? sheet.cssRules.length : 0
        });
      } catch (e) {
        // Cross-origin stylesheets might block access to cssRules
        assets.stylesheets.push({
            href: sheet.href,
            type: sheet.type,
            index: index,
            accessError: true
        });
      }
    });

    // Scripts
    Array.from(document.scripts).forEach((script, index) => {
      assets.scripts.push({
        src: script.src,
        type: script.type,
        async: script.async,
        defer: script.defer,
        index: index
      });
    });

    return assets;
  }

  return extractAssets();
})();

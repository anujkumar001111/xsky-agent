/**
 * Extracts information about all assets loaded on the current web page.
 *
 * This function analyzes the document's asset references including stylesheets,
 * scripts, and images. This information helps AI agents understand the page's
 * dependencies, styling, and interactive components for better automation decisions.
 *
 * Asset information includes:
 * - Stylesheets: URLs, types, and rule counts
 * - Scripts: Sources, loading attributes, and execution order
 * - Images: Sources and dimensions (when available)
 *
 * @returns Object containing arrays of stylesheets, scripts, and images
 */
export function extract_assets() {
    /**
     * Core asset extraction function.
     *
     * Scans the document for all linked assets and organizes them by type.
     * Handles cross-origin restrictions gracefully by catching access errors.
     *
     * @returns Structured object containing all page assets
     */
    function extractAssets() {
        const assets: any = {
            stylesheets: [],  // CSS stylesheets
            scripts: [],      // JavaScript files
            images: []        // Image assets (placeholder for future expansion)
        };

        // Extract stylesheet information
        // Note: Some stylesheets may be inaccessible due to CORS policies
        Array.from(document.styleSheets).forEach((sheet, index) => {
            try {
                assets.stylesheets.push({
                    href: sheet.href,                                    // Stylesheet URL
                    type: sheet.type,                                   // MIME type (usually 'text/css')
                    index: index,                                       // Load order index
                    rulesCount: sheet.cssRules ? sheet.cssRules.length : 0 // Number of CSS rules
                });
            } catch (e) {
                // Handle CORS-restricted stylesheets
                assets.stylesheets.push({
                    href: sheet.href,
                    type: sheet.type,
                    index: index,
                    accessError: true  // Indicates stylesheet couldn't be analyzed
                });
            }
        });

        // Extract script information
        Array.from(document.scripts).forEach((script, index) => {
            assets.scripts.push({
                src: script.src,        // Script URL (empty for inline scripts)
                type: script.type,      // Script MIME type
                async: script.async,    // Asynchronous loading flag
                defer: script.defer,    // Deferred execution flag
                index: index           // Load order index
            });
        });

        return assets;
    }

    return extractAssets();
}

export function extract_assets() {
    function extractAssets() {
        const assets: any = {
            stylesheets: [],
            scripts: [],
            images: []
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
}

export function extract_styles(root: any = document.body) {
    function extractStyles(root: any = document.body) {
        if (!root) return null;

        const allElements = root.querySelectorAll('*');
        const styles: any[] = [];

        const interestingProperties = [
            'display', 'visibility', 'opacity', 'z-index',
            'position', 'top', 'left', 'right', 'bottom',
            'color', 'background-color', 'font-size', 'font-family', 'font-weight',
            'cursor', 'pointer-events', 'overflow', 'overflow-x', 'overflow-y'
        ];

        const processElement = (el: any) => {
            const computed = window.getComputedStyle(el);
            const computedStyles: any = {};

            interestingProperties.forEach(prop => {
                computedStyles[prop] = computed.getPropertyValue(prop);
            });

            // Check for pseudo-elements (basic check)
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');

            const pseudo: any = {};
            if (before.content !== 'none') pseudo['::before'] = before.content;
            if (after.content !== 'none') pseudo['::after'] = after.content;

            return {
                tagName: el.tagName.toLowerCase(),
                id: el.id,
                path: getElementPath(el),
                computedStyles: computedStyles,
                pseudo: pseudo
            };
        };

        function getElementPath(element: any) {
            const path = [];
            let current = element;
            while (current) {
                let selector = current.tagName.toLowerCase();
                if (current.id) {
                    selector += `#${current.id}`;
                } else if (current.className && typeof current.className === 'string') {
                    selector += `.${current.className.split(/\s+/).join('.')}`;
                }
                path.unshift(selector);
                current = current.parentElement;
            }
            return path.join(' > ');
        }

        styles.push(processElement(root));
        allElements.forEach((el: any) => styles.push(processElement(el)));

        return styles;
    }

    return extractStyles(root);
}

/**
 * Extracts comprehensive DOM structure information for browser automation.
 *
 * This function analyzes the DOM tree starting from a root element and creates
 * a detailed representation of all elements, including their positions, attributes,
 * and relationships. This information enables AI agents to understand page layout
 * and make informed decisions about element interactions.
 *
 * The extraction includes:
 * - Element hierarchy and CSS selectors
 * - Bounding rectangles and scroll information
 * - Attributes and classes
 * - Shadow DOM support
 * - Element positioning and visibility data
 *
 * @param root - Root element to start extraction from (defaults to document.body)
 * @returns Array of element structure objects with comprehensive DOM information
 */
export function extract_structure(root: any = document.body) {
    /**
     * Generates a CSS selector path from an element to the document root.
     *
     * Creates a human-readable selector path that uniquely identifies an element
     * using tag names, IDs, and classes. This path can be used for element
     * targeting in automation scripts.
     *
     * @param element - DOM element to generate path for
     * @returns CSS selector path string (e.g., "div#content > section.main > button.submit")
     */
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

    /**
     * Core DOM structure extraction function.
     *
     * Performs a depth-first traversal of the DOM tree, collecting detailed
     * information about each element. Handles both regular DOM and Shadow DOM
     * to provide complete page structure analysis.
     *
     * @param root - Root element to start extraction from
     * @returns Array of processed element objects or null if root is invalid
     */
    function extractStructure(root: any = document.body) {
        if (!root) return null;

        const structure: any[] = [];

        /**
         * Recursive DOM traversal function with Shadow DOM support.
         *
         * Traverses the DOM tree in depth-first order, processing each element
         * and its children. Special handling for Shadow DOM ensures complete
         * coverage of modern web components.
         *
         * @param node - Current DOM node being processed
         */
        const traverse = (node: any) => {
            if (!node) return;

            // Process current node if it's an element
            if (node.nodeType === Node.ELEMENT_NODE) {
                structure.push(processElement(node));
            }

            // Traverse Shadow Root if present (for web components)
            if (node.shadowRoot) {
                Array.from(node.shadowRoot.children).forEach((child: any) => traverse(child));
            }

            // Traverse regular DOM children
            if (node.children) {
                Array.from(node.children).forEach((child: any) => traverse(child));
            }
        };

        /**
         * Processes a single DOM element into structured data.
         *
         * Extracts comprehensive information about an element including its
         * position, attributes, scroll state, and relationships. This data
         * enables AI agents to understand element properties and interactions.
         *
         * @param el - DOM element to process
         * @returns Structured object containing all element properties
         */
        const processElement = (el: any) => {
            const rect = el.getBoundingClientRect();

            // Extract all element attributes
            const attributes: any = {};
            if (el.hasAttributes()) {
                for (const attr of el.attributes) {
                    attributes[attr.name] = attr.value;
                }
            }

            // Build list of child element identifiers
            const childrenIds: string[] = [];
            if (el.children) {
                for (const child of el.children) {
                    childrenIds.push(child.id || child.tagName);
                }
            }

            // Indicate Shadow DOM presence
            if (el.shadowRoot) {
                childrenIds.push('#shadow-root');
            }

            return {
                tagName: el.tagName.toLowerCase(),  // Element type (div, button, etc.)
                id: el.id,                          // Element ID attribute
                className: el.className,            // CSS classes
                attributes: attributes,             // All HTML attributes
                rect: {                             // Viewport-relative positioning
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    left: rect.left,
                    bottom: rect.bottom,
                    right: rect.right
                },
                scroll: {                           // Scroll state information
                    scrollTop: el.scrollTop,
                    scrollLeft: el.scrollLeft,
                    scrollHeight: el.scrollHeight,
                    scrollWidth: el.scrollWidth,
                    clientHeight: el.clientHeight,
                    clientWidth: el.clientWidth
                },
                children: childrenIds,              // Child element identifiers
                path: getElementPath(el),           // CSS selector path
                inShadowDom: !!el.getRootNode && (el.getRootNode() instanceof ShadowRoot) // Shadow DOM context
            };
        };

        traverse(root);

        return structure;
    }

    return extractStructure(root);
}

// comprehensive_element_extractor.js
// Primary source providing HTML, styles, events, animations, and fonts

(function() {
    // Helper functions
    function getElementPath(element) {
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

    function getAttributes(el) {
        const attributes = {};
        if (el.hasAttributes()) {
            for (const attr of el.attributes) {
                attributes[attr.name] = attr.value;
            }
        }
        return attributes;
    }

    function getStyles(el) {
        const computed = window.getComputedStyle(el);
        const interestingProperties = [
            'display', 'visibility', 'opacity', 'z-index',
            'position', 'top', 'left', 'right', 'bottom',
            'color', 'background-color', 'font-size', 'font-family',
            'cursor', 'overflow'
        ];
        const styles = {};
        interestingProperties.forEach(prop => {
            styles[prop] = computed.getPropertyValue(prop);
        });
        return styles;
    }

    function getEvents(el) {
        // Basic check for inline and React
        const handlers = [];
        // Inline
        ['click', 'submit'].forEach(evt => {
            if (el.getAttribute(`on${evt}`)) handlers.push({type: evt, source: 'inline'});
        });
        return handlers;
    }

    function extractComprehensive(root = document.body) {
        if (!root) return null;

        const allElements = root.querySelectorAll('*');
        const elements = [];

        const processElement = (el) => {
            const rect = el.getBoundingClientRect();

            // Skip non-rendered elements to save space?
            // Maybe keep them but mark as hidden.
            const isVisible = rect.width > 0 && rect.height > 0; // simplified

            return {
                tagName: el.tagName.toLowerCase(),
                id: el.id,
                className: el.className,
                path: getElementPath(el),
                attributes: getAttributes(el),
                rect: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                },
                styles: getStyles(el),
                events: getEvents(el),
                isVisible: isVisible,
                innerText: el.innerText ? el.innerText.substring(0, 100) : '' // Limit text content
            };
        };

        elements.push(processElement(root));
        allElements.forEach(el => elements.push(processElement(el)));

        return elements;
    }

    return extractComprehensive();
})();

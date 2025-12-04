export function comprehensive_element_extractor(root: any = document.body) {
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

    function getAttributes(el: any) {
        const attributes: any = {};
        if (el.hasAttributes()) {
            for (const attr of el.attributes) {
                attributes[attr.name] = attr.value;
            }
        }
        return attributes;
    }

    function getStyles(el: any) {
        const computed = window.getComputedStyle(el);
        const interestingProperties = [
            'display', 'visibility', 'opacity', 'z-index',
            'position', 'top', 'left', 'right', 'bottom',
            'color', 'background-color', 'font-size', 'font-family',
            'cursor', 'overflow'
        ];
        const styles: any = {};
        interestingProperties.forEach(prop => {
            styles[prop] = computed.getPropertyValue(prop);
        });
        return styles;
    }

    function getEvents(el: any) {
        const handlers: any[] = [];
        ['click', 'submit'].forEach(evt => {
            if (el.getAttribute(`on${evt}`)) handlers.push({ type: evt, source: 'inline' });
        });
        return handlers;
    }

    function extractComprehensive(root: any = document.body) {
        if (!root) return null;

        const allElements = root.querySelectorAll('*');
        const elements: any[] = [];

        const processElement = (el: any) => {
            const rect = el.getBoundingClientRect();

            const isVisible = rect.width > 0 && rect.height > 0;

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
                innerText: el.innerText ? el.innerText.substring(0, 100) : ''
            };
        };

        elements.push(processElement(root));
        allElements.forEach((el: any) => elements.push(processElement(el)));

        return elements;
    }

    return extractComprehensive(root);
}

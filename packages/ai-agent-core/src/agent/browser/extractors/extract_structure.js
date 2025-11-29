// extract_structure.js
// Extracts basic DOM metadata (tag, id, class, attributes, dimensions, children, scroll info)

(function() {
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

  function extractStructure(root = document.body) {
    if (!root) return null;

    const structure = [];

    // Recursive traversal to handle Shadow DOM
    const traverse = (node) => {
        if (!node) return;

        // Process current node
        if (node.nodeType === Node.ELEMENT_NODE) {
            structure.push(processElement(node));
        }

        // Traverse Shadow Root if present
        if (node.shadowRoot) {
            // We treat shadow root contents as if they are children,
            // but we might want to mark them.
            // For now, simple recursion into children of shadow root.
            Array.from(node.shadowRoot.children).forEach(child => traverse(child));
        }

        // Traverse children
        if (node.children) {
            Array.from(node.children).forEach(child => traverse(child));
        }
    };

    const processElement = (el) => {
        const rect = el.getBoundingClientRect();

        const attributes = {};
        if (el.hasAttributes()) {
            for (const attr of el.attributes) {
                attributes[attr.name] = attr.value;
            }
        }

        const childrenIds = [];
        if (el.children) {
             for (const child of el.children) {
                 childrenIds.push(child.id || child.tagName);
             }
        }

        // Also include shadow children in list?
        if (el.shadowRoot) {
             childrenIds.push('#shadow-root');
        }

        return {
            tagName: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            attributes: attributes,
            rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right
            },
            scroll: {
                scrollTop: el.scrollTop,
                scrollLeft: el.scrollLeft,
                scrollHeight: el.scrollHeight,
                scrollWidth: el.scrollWidth,
                clientHeight: el.clientHeight,
                clientWidth: el.clientWidth
            },
            children: childrenIds,
            path: getElementPath(el),
            inShadowDom: !!el.getRootNode && (el.getRootNode() instanceof ShadowRoot)
        };
    };

    traverse(root);

    return structure;
  }

  return extractStructure();
})();

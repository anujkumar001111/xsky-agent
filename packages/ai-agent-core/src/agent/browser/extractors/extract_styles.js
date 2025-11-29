// extract_styles.js
// Provides computed CSS styles, matching CSS rules, and pseudo-elements

(function() {
  function extractStyles(root = document.body) {
    if (!root) return null;

    const allElements = root.querySelectorAll('*');
    const styles = [];

    const interestingProperties = [
      'display', 'visibility', 'opacity', 'z-index',
      'position', 'top', 'left', 'right', 'bottom',
      'color', 'background-color', 'font-size', 'font-family', 'font-weight',
      'cursor', 'pointer-events', 'overflow', 'overflow-x', 'overflow-y'
    ];

    const processElement = (el) => {
      const computed = window.getComputedStyle(el);
      const computedStyles = {};

      interestingProperties.forEach(prop => {
        computedStyles[prop] = computed.getPropertyValue(prop);
      });

      // Check for pseudo-elements (basic check)
      const before = window.getComputedStyle(el, '::before');
      const after = window.getComputedStyle(el, '::after');

      const pseudo = {};
      if (before.content !== 'none') pseudo['::before'] = before.content;
      if (after.content !== 'none') pseudo['::after'] = after.content;

      return {
        // We need a way to link this back to the element.
        // Using path or id from extract_structure.
        // For now, let's include basic ID/Tag info to correlate.
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        path: getElementPath(el),
        computedStyles: computedStyles,
        pseudo: pseudo
      };
    };

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

    styles.push(processElement(root));
    allElements.forEach(el => styles.push(processElement(el)));

    return styles;
  }

  return extractStyles();
})();

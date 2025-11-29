// extract_events.js
// Detects inline and framework-specific event handlers

(function() {
  function extractEvents(root = document.body) {
    if (!root) return null;

    const allElements = root.querySelectorAll('*');
    const events = [];

    const commonEvents = ['click', 'submit', 'change', 'input', 'keydown', 'keyup', 'mouseover', 'mouseout'];

    const processElement = (el) => {
      const eventHandlers = [];

      // Inline handlers
      commonEvents.forEach(evt => {
        const attr = el.getAttribute(`on${evt}`);
        if (attr) {
          eventHandlers.push({
            type: evt,
            hasHandler: true,
            isInline: true,
            source: attr // Might be truncated or omitted for security/size
          });
        }
      });

      // Framework detection (heuristics)
      // React
      const reactProps = Object.keys(el).find(key => key.startsWith('__reactProps'));
      if (reactProps) {
        const props = el[reactProps];
        if (props) {
            Object.keys(props).forEach(key => {
                if (key.startsWith('on') && typeof props[key] === 'function') {
                     eventHandlers.push({
                        type: key.substring(2).toLowerCase(),
                        hasHandler: true,
                        framework: 'react',
                        isInline: false
                     });
                }
            });
        }
      }

      // Vue (often attached to __vue__ or similar, but harder to inspect from outside without devtools)
      // jQuery (needs $._data(element, 'events'))
      if (window.jQuery) {
          try {
             const jqEvents = window.jQuery._data(el, 'events');
             if (jqEvents) {
                 Object.keys(jqEvents).forEach(evt => {
                     eventHandlers.push({
                         type: evt,
                         hasHandler: true,
                         framework: 'jquery',
                         isInline: false
                     });
                 });
             }
          } catch (e) {
              // Ignore
          }
      }

      // Angular (ng-click, etc. are attributes, handled by inline check somewhat, but modern Angular uses properties)
      // Angular Ivy is harder to detect.

      if (eventHandlers.length > 0) {
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          path: getElementPath(el),
          eventHandlers: eventHandlers
        };
      }
      return null;
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

    const rootRes = processElement(root);
    if(rootRes) events.push(rootRes);

    allElements.forEach(el => {
        const res = processElement(el);
        if (res) events.push(res);
    });

    return events;
  }

  return extractEvents();
})();

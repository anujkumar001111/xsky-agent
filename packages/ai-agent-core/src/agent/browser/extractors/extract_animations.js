// extract_animations.js
// Provides animation, transition, and transform data

(function() {
    function extractAnimations(root = document.body) {
        if (!root) return null;

        const allElements = root.querySelectorAll('*');
        const animations = [];

        const processElement = (el) => {
            const computed = window.getComputedStyle(el);

            const animationName = computed.animationName;
            const transitionProperty = computed.transitionProperty;

            const hasAnimation = animationName && animationName !== 'none';
            const hasTransition = transitionProperty && transitionProperty !== 'none';

            if (hasAnimation || hasTransition) {
                return {
                    tagName: el.tagName.toLowerCase(),
                    id: el.id,
                    path: getElementPath(el),
                    animation: hasAnimation ? {
                        name: animationName,
                        duration: computed.animationDuration,
                        delay: computed.animationDelay,
                        timingFunction: computed.animationTimingFunction,
                        iterationCount: computed.animationIterationCount
                    } : null,
                    transition: hasTransition ? {
                        property: transitionProperty,
                        duration: computed.transitionDuration,
                        delay: computed.transitionDelay,
                        timingFunction: computed.transitionTimingFunction
                    } : null
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
        if(rootRes) animations.push(rootRes);

        allElements.forEach(el => {
            const res = processElement(el);
            if (res) animations.push(res);
        });

        return animations;
      }

      return extractAnimations();
})();

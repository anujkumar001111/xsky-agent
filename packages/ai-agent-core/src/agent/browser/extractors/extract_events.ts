/**
 * Extracts information about event handlers attached to DOM elements.
 *
 * This function analyzes the page for interactive elements and their associated
 * event handlers. It detects both inline event handlers and framework-managed
 * events (React, jQuery), helping AI agents understand which elements are
 * interactive and how they respond to user actions.
 *
 * Event detection includes:
 * - Inline HTML event handlers (onclick, onsubmit, etc.)
 * - React synthetic events
 * - jQuery event bindings
 * - Common interaction events (click, input, keyboard, mouse)
 *
 * @param root - Root element to start extraction from (defaults to document.body)
 * @returns Array of elements with their associated event handlers
 */
export function extract_events(root: any = document.body) {
    /**
     * Core event extraction function.
     *
     * Scans all elements in the DOM subtree for event handlers using multiple
     * detection methods to handle different JavaScript frameworks and patterns.
     *
     * @param root - Root element to analyze
     * @returns Array of element event information or null if root invalid
     */
    function extractEvents(root: any = document.body) {
        if (!root) return null;

        const allElements = root.querySelectorAll('*');
        const events: any[] = [];

        // Common HTML events that indicate interactive elements
        const commonEvents = ['click', 'submit', 'change', 'input', 'keydown', 'keyup', 'mouseover', 'mouseout'];

        /**
         * Analyzes a single element for event handlers.
         *
         * Uses multiple detection strategies to find event handlers attached
         * through different methods (inline, React, jQuery, etc.).
         *
         * @param el - DOM element to analyze
         * @returns Event handler information or null if no handlers found
         */
        const processElement = (el: any) => {
            const eventHandlers: any[] = [];

            // Detect inline HTML event handlers (e.g., onclick="doSomething()")
            commonEvents.forEach(evt => {
                const attr = el.getAttribute(`on${evt}`);
                if (attr) {
                    eventHandlers.push({
                        type: evt,           // Event type (click, submit, etc.)
                        hasHandler: true,    // Confirms handler presence
                        isInline: true,      // Indicates inline HTML attribute
                        source: attr        // The actual handler code/function
                    });
                }
            });

            // Framework-specific event detection using heuristics

            // React synthetic events detection
            // React attaches event handlers to internal __reactProps objects
            const reactProps = Object.keys(el).find(key => key.startsWith('__reactProps'));
            if (reactProps) {
                const props = (el as any)[reactProps];
                if (props) {
                    Object.keys(props).forEach(key => {
                        if (key.startsWith('on') && typeof props[key] === 'function') {
                            eventHandlers.push({
                                type: key.substring(2).toLowerCase(), // Remove 'on' prefix and lowercase
                                hasHandler: true,
                                framework: 'react',    // Identifies as React-managed event
                                isInline: false       // Not inline HTML
                            });
                        }
                    });
                }
            }

            // jQuery event detection
            // jQuery stores event bindings in internal _data structure
            if ((window as any).jQuery) {
                try {
                    const jqEvents = (window as any).jQuery._data(el, 'events');
                    if (jqEvents) {
                        Object.keys(jqEvents).forEach(evt => {
                            eventHandlers.push({
                                type: evt,           // Event type from jQuery
                                hasHandler: true,
                                framework: 'jquery', // Identifies as jQuery-managed event
                                isInline: false
                            });
                        });
                    }
                } catch (e) {
                    // Ignore errors from accessing jQuery internals
                    // This can happen with different jQuery versions or security restrictions
                }
            }

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

        const rootRes = processElement(root);
        if (rootRes) events.push(rootRes);

        allElements.forEach((el: any) => {
            const res = processElement(el);
            if (res) events.push(res);
        });

        return events;
    }

    return extractEvents(root);
}

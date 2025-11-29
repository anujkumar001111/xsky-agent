// setup_mutation_observer.js
// Sets up a MutationObserver to track DOM changes and signal adaptive waits

(function() {
    if (window._domMutationObserver) {
        return; // Already setup
    }

    const signals = [];
    const MAX_SIGNALS = 50;

    function addSignal(type, data) {
        const signal = {
            type: type,
            timestamp: Date.now(),
            data: data
        };
        signals.push(signal);
        if (signals.length > MAX_SIGNALS) {
            signals.shift();
        }
        // Expose signals for external polling
        window._domSignals = signals;
    }

    const observer = new MutationObserver((mutations) => {
        const summary = {
            count: mutations.length,
            types: [...new Set(mutations.map(m => m.type))]
        };
        addSignal('mutation', summary);
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true,
        characterData: true
    });

    window._domMutationObserver = observer;

    // Listen for events?
    // Maybe critical events like load, etc.
    window.addEventListener('load', () => addSignal('load', {}));

    // Expose a function to clear signals or check status
    window.getDomSignals = function(sinceTimestamp = 0) {
        return signals.filter(s => s.timestamp > sinceTimestamp);
    };
})();

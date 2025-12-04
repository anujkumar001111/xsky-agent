export function setup_mutation_observer() {
    if ((window as any)._domMutationObserver) {
        return; // Already setup
    }

    const signals: any[] = [];
    const MAX_SIGNALS = 50;

    function addSignal(type: string, data: any) {
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
        (window as any)._domSignals = signals;
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

    (window as any)._domMutationObserver = observer;

    window.addEventListener('load', () => addSignal('load', {}));

    (window as any).getDomSignals = function(sinceTimestamp = 0) {
        return signals.filter(s => s.timestamp > sinceTimestamp);
    };
}

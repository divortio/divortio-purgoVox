export async function mtRequirements() {
    // --- MODIFICATION START ---
    // Use `self` as the global scope, which is available in both the main thread (`window`)
    // and in web workers (`self`). This makes the script environment-agnostic.
    const G = self;
    // --- MODIFICATION END ---

    const results = {
        isSecureContext: G.isSecureContext || false,
        crossOriginIsolated: G.crossOriginIsolated || false,
        crossOriginOpenerPolicy: null,
        crossOriginEmbedderPolicy: null
    };

    try {
        // --- MODIFICATION START ---
        // Fetch from the worker's own location, which is what FFMPEG cares about.
        const res = await fetch(G.location.href, { method: 'GET', cache: 'no-store' });
        // --- MODIFICATION END ---
        try {
            const coopHeader = res.headers.get('Cross-Origin-Opener-Policy');
            results.crossOriginOpenerPolicy = coopHeader === 'same-origin';
        } catch (e) {
            results.crossOriginOpenerPolicy = false;
        }

        try {
            const coepHeader = res.headers.get('Cross-Origin-Embedder-Policy');
            results.crossOriginEmbedderPolicy = coepHeader === 'require-corp';
        } catch (e) {
            results.crossOriginEmbedderPolicy = false;
        }

    } catch (e) {
        results.crossOriginOpenerPolicy = false;
        results.crossOriginEmbedderPolicy = false;
    }

    return results;
}

export async function isMultithreading() {
    const results = await mtRequirements();
    return results.isSecureContext === true &&
        results.crossOriginIsolated === true &&
        results.crossOriginOpenerPolicy === true &&
        results.crossOriginEmbedderPolicy === true;
}
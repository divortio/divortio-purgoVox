

export async function mtRequirements() {

    const results = {isSecureContext: window.isSecureContext || self.isSecureContext ||  false,
        crossOriginIsolated: window.crossOriginIsolated || self.crossOriginIsolated ||  false,
        crossOriginOpenerPolicy: null,
        crossOriginEmbedderPolicy: null
    }


    try {
        const res = await fetch(window.location.href, { method: 'GET', cache: 'no-store' });
        try {
            const coopHeader = res.headers.get('Cross-Origin-Opener-Policy');
            results.crossOriginOpenerPolicy = coopHeader === 'same-origin';
        }
        catch (e) {
            results.crossOriginOpenerPolicy = false;
        }

        try {
            const coepHeader = res.headers.get('Cross-Origin-Embedder-Policy');
            results.crossOriginEmbedderPolicy = coepHeader === 'require-corp';
        }
        catch (e) {
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
    return results.crossOriginIsolated === true && results.isSecureContext === true && results.crossOriginOpenerPolicy === true && results.crossOriginEmbedderPolicy === true;
}
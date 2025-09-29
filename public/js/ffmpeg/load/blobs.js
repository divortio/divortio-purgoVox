
/**
 * Fetches a script, patches its content to make it worker-safe, and returns a Blob URL.
 * @param {string} url - The URL of the script to fetch.
 * @param {string} mimeType - The MIME type of the script.
 * @param {(body: string) => string} patcher - A function to patch the script's text content.
 * @returns {Promise<string>} A promise that resolves to a Blob URL.
 */
export async function toBlobURLPatched(url, mimeType, patcher) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    let body = await resp.text();
    if (patcher) body = patcher(body);
    const blob = new Blob([body], { type: mimeType });
    return URL.createObjectURL(blob);
}

export async function toBlobURLWithProgress(url, mimeType, progressCallback) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const total = parseInt(resp.headers.get('Content-Length') || '0', 10);
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (progressCallback && total) {
            progressCallback(received / total);
        }
    }
    const blob = new Blob(chunks, {type: mimeType});
    return URL.createObjectURL(blob);
}
/**
 * @file This module is responsible for loading and initializing the FFmpeg.wasm library
 * for the main browser thread.
 */

import { CORE_VERSION, FFMPEG_VERSION, baseURLFFMPEG, baseURLCore, baseURLCoreMT } from '../../constants/config.js';

let ffmpeg = null;

/**
 * @callback PatcherFunction
 * @param {string} text - The original text content of the fetched script.
 * @returns {string} The modified text content.
 */

/**
 * @callback ProgressCallback
 * @param {number} ratio - The download progress, a float between 0.0 and 1.0.
 */

/**
 * Fetches a script, applies a patch to its text content in-memory, and returns
 * a Blob URL for safe execution. This is crucial for modifying library code before it runs.
 *
 * @param {string} url - The URL of the script to fetch.
 * @param {string} mimeType - The MIME type of the script (e.g., 'text/javascript').
 * @param {PatcherFunction} patcher - A function that takes the script text and returns the modified text.
 * @returns {Promise<string>} A promise that resolves to a Blob URL representing the patched script.
 * @throws {Error} If the fetch request fails.
 */
async function toBlobURLPatched(url, mimeType, patcher) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    let body = await resp.text();
    if (patcher) body = patcher(body);
    const blob = new Blob([body], { type: mimeType });
    return URL.createObjectURL(blob);
}

/**
 * Fetches a resource and converts it to a Blob URL while reporting download progress.
 * This is used for large files like the FFmpeg WASM binary to provide feedback to the user.
 *
 * @param {string} url - The URL of the resource to fetch.
 * @param {string} mimeType - The MIME type of the resource (e.g., 'application/wasm').
 * @param {ProgressCallback | null} progressCallback - An optional callback function to report download progress.
 * @returns {Promise<string>} A promise that resolves to a Blob URL representing the downloaded resource.
 * @throws {Error} If the fetch request fails.
 */
async function toBlobURLWithProgress(url, mimeType, progressCallback) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const total = parseInt(resp.headers.get('Content-Length') || '0', 10);
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (progressCallback && total) {
            progressCallback(received / total);
        }
    }
    const blob = new Blob(chunks, { type: mimeType });
    return URL.createObjectURL(blob);
}

/**
 * Initializes and loads the main FFmpeg instance for the application.
 * @param {ProgressCallback} progressCallback - Callback to report the loading progress of the WASM file.
 * @returns {Promise<import('./ffmpeg-pipeline.js').FFmpeg>} A promise that resolves to the initialized FFmpeg instance.
 */
export async function initialize(progressCallback) {
    if (ffmpeg) return ffmpeg;

    const ffmpegBlobURL = await toBlobURLPatched(
        `${baseURLFFMPEG}/ffmpeg.js`, 'text/javascript',
        (js) => js.replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );
    await import(ffmpegBlobURL);

    // @ts-ignore
    ffmpeg = new FFmpegWASM.FFmpeg();

    const isMt = self.crossOriginIsolated;
    const coreBaseURL = isMt ? baseURLCoreMT : baseURLCore;

    const config = {
        workerLoadURL: await toBlobURLWithProgress(`${baseURLFFMPEG}/814.ffmpeg.js`, 'text/javascript', null),
        coreURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript', null),
        wasmURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm', progressCallback),
        ...(isMt && { workerURL: await toBlobURLWithProgress(`${coreBaseURL}/ffmpeg-core.worker.js`, 'application/javascript', null) }),
    };

    await ffmpeg.load(config);
    return ffmpeg;
}
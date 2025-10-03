/**
 * @file A centralized and robust module for loading and initializing FFmpeg.wasm,
 * usable by both the main thread and web workers.
 */
import { toBlobURLPatched, toBlobURLWithProgress } from './load/blobs.js';
import { isMultithreading } from './load/mtCheck.js';
import { ffmpegURLs } from './load/urls.js';
import { FFMPEG_LOCAL_PATH } from '../../constants/ffmpeg.js';

let ffmpeg = null;

/**
 * Initializes and loads an FFmpeg instance.
 * @param {function(number): void} [progressCallback] - Optional callback for load progress.
 * @returns {Promise<any>} A promise that resolves to the initialized FFmpeg instance.
 */
export async function initializeFFmpeg(progressCallback = () => {}) {
    if (ffmpeg) return ffmpeg;

    const urls = await ffmpegURLs(undefined, undefined, FFMPEG_LOCAL_PATH);

    // --- MODIFICATION START ---
    // This complete patch makes the ffmpeg.js script safe for both the main thread and workers.
    // 1. It removes the dependency on `document.baseURI`, which is not available in workers.
    // 2. It intercepts the loading of `814.ffmpeg.js` and points it to our blob URL.
    const ffmpegPatchedURL = await toBlobURLPatched(
        urls.ffmpegJS,
        'text/javascript',
        (js) => js
            .replace('e.b=document.baseURI||self.location.href', 'e.b=self.location.href')
            .replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );
    // --- MODIFICATION END ---

    // Dynamically import the PATCHED ffmpeg.js script.
    await import(ffmpegPatchedURL);

    // @ts-ignore
    ffmpeg = new self.FFmpegWASM.FFmpeg();

    const isMt = await isMultithreading();
    console.log(`FFMPEG Initializing | Multithreading: ${isMt ? 'ON' : 'OFF'}`);

    const coreJS = isMt ? urls.coreMtJS : urls.coreJS;
    const coreWASM = isMt ? urls.coreMtWASM : urls.coreWASM;

    const config = {
        workerLoadURL: await toBlobURLWithProgress(urls.wasmJS, 'text/javascript'),
        coreURL: await toBlobURLWithProgress(coreJS, 'text/javascript'),
        wasmURL: await toBlobURLWithProgress(coreWASM, 'application/wasm', progressCallback),
        ...(isMt && { workerURL: await toBlobURLWithProgress(urls.coreMTWorker, 'application/javascript') }),
    };

    await ffmpeg.load(config);

    console.log("FFMPEG Core Loaded Successfully.");
    return ffmpeg;
}
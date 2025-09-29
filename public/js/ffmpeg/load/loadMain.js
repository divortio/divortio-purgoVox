/**
 * @file This module is responsible for loading and initializing FFmpeg.wasm within the main thread
 */

// import {baseURLCore, baseURLCoreMT, baseURLFFMPEG} from '../../config.js';

import {toBlobURLPatched, toBlobURLWithProgress} from './blobs.js';
import {isMultithreading} from "./mtCheck.js";
import {ffmpegURLs} from "./urls.js";


let ffmpeg = null;


/**
 * Initializes and loads an FFmpeg instance in the main
 * @returns {Promise<any>} A promise that resolves to the initialized FFmpeg instance.
 */
export async function initFFMPEGMain(coreVersion="0.12.10",
                                 ffmpegVersion="0.12.15",
                                 localPath=null,
                                 progressCallback) {

    const urls = await ffmpegURLs(coreVersion, ffmpegVersion, localPath);

    if (ffmpeg) return ffmpeg;

    // worker only
    // const ffmpegJS = await toBlobURLPatched(
    //     urls.ffmpegJS, 'text/javascript',
    //     (js) => js.replace('e.b=document.baseURI||self.location.href', 'e.b=self.location.href')
    //         .replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    // );
    // main only
    const ffmpegJS = await toBlobURLPatched(
        urls.ffmpegJS, 'text/javascript',
        (js) => js.replace('new URL(e.p+e.u(814),e.b)', 'r.workerLoadURL')
    );



    await import(ffmpegJS);
    console.log(`[main] Loaded ffmpegJS: "${urls.ffmpegJS}"`);

    // @ts-ignore
    ffmpeg = new FFmpegWASM.FFmpeg();


    const isMt = await isMultithreading();
    console.log(`[main:FFMPEG] Multithreading ${isMt === true ? 'ON' : 'OFF'}`);

    const coreJS = isMt ? urls.coreMtJS : urls.coreJS;
    const coreWASM = isMt ? urls.coreMtWASM : urls.coreWASM;

    const config = {
        workerLoadURL: await toBlobURLWithProgress(urls.wasmJS, 'text/javascript', progressCallback),
        coreURL: await toBlobURLWithProgress(coreJS, 'text/javascript', progressCallback),
        wasmURL: await toBlobURLWithProgress(coreWASM, 'application/wasm', progressCallback),
        ...(isMt && { workerURL: await toBlobURLWithProgress(urls.coreMTWorker, 'application/javascript', progressCallback) }),
    };

    await ffmpeg.load(config);
    console.log(`[main:FFMPEG] Loaded workerLoadURL: "${urls.wasmJS}"`);
    console.log(`[main:FFMPEG] Loaded coreURL: "${coreJS}"`);
    console.log(`[main:FFMPEG] Loaded wasmURL: "${coreWASM}"`);
    if (isMt === true) {
        console.log(`[main:FFMPEG] Loaded MT workerURL: "${urls.coreMTWorker}"`);
    }

    return ffmpeg;
}
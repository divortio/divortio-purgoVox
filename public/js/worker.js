
// import { FFmpeg } from '/vendor/@ffmpeg/ffmpeg/util/dist/esm/index.js';
import { toBlobURL, importScript } from './vendor/@ffmpeg/util/dist/esm/index.js';
import { ABS_WORKER_URL, ABS_CORE_URL, ABS_WASM_URL, ABS_FFMPEG_URL } from './config.js';

import { analyzeLoudness } from './src/jobs/worker/pass1_analyzeLoudness.js';
import { normalizeLoudness } from './src/jobs/worker/pass2_normalizeLoudness.js';
import { analyzeNormalized } from './src/jobs/worker/pass3_analyzeNormalized.js';
import { masterEncode } from './src/jobs/worker/pass4_masterEncode.js';

/**
 * @typedef {import('./src/jobs/main/step3-process-chunks.js').MasteringOptions} MasteringOptions
 */

let ffmpeg = null;
let isInitialized = false;

const logStore = {
    logs: '',
    append: function(message) { this.logs += message + '\n'; },
    get: function() { return this.logs; },
    clear: function() { this.logs = ''; }
};

/**
 * Handles incoming messages from the main thread.
 * @param {MessageEvent} e - The message event.
 */
self.onmessage = async (e) => {
    // const { command, ffmpegURL, coreURL, wasmURL, workerURL, ...processData } = e.data;
    const command = e.data.command;
    // const ffmpegURL = e.data.ffmpegURL

    if (command === 'init') {
        try {
            if (isInitialized) {
                self.postMessage({ status: 'ready' });
                return;
            }

            console.log("[Worker] 'init' command received. Starting initialization.");
            console.log(e.data.ffmpegConfig)
            const { FFmpeg } = await import(ABS_FFMPEG_URL);
            ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => {
                // You can post logs back to the main thread if needed,
                // but for now, we'll keep them in the worker's console.
                console.log(`[FFmpeg Worker Log]: ${message}`);
            });

            console.log("[Worker] Loading FFmpeg core...");
            await ffmpeg.load({
                coreURL: await toBlobURL(ABS_CORE_URL, 'text/javascript'),
                wasmURL: await toBlobURL(ABS_WASM_URL, 'application/wasm'),
                workerURL: await toBlobURL(ABS_WORKER_URL, 'text/javascript'),
            });

            console.log("[Worker] FFmpeg Core Loaded Successfully.");
            isInitialized = true;
            self.postMessage({ status: 'ready' });

        } catch (error) {
            console.error("[Worker] FATAL ERROR during initialization:", error);
            self.postMessage({
                status: 'error',
                context: 'initialization',
                error: { message: error.message, stack: error.stack, name: error.name }
            });
        }
        return;
    }

    if (command === 'process') {
        if (!isInitialized) {
            self.postMessage({ status: 'error', context: 'processing', error: { message: 'Worker is not initialized.' } });
            return;
        }

        const { chunkIndex, chunkData, channelLayout, masteringOptions } = processData;
        const workingDirectory = '/work';
        const chunkName = `chunk_${String(chunkIndex).padStart(4, '0')}.wav`;
        const chunkFilepath = `${workingDirectory}/${chunkName}`;

        const onProgress = (message) => {
            self.postMessage({ status: 'progress', chunkIndex, message });
        };

        try {
            await ffmpeg.createDir(workingDirectory);
            await ffmpeg.writeFile(chunkFilepath, new Uint8Array(chunkData));

            onProgress('Pass 1/4: Analyzing Loudness...');
            const loudnessData = await analyzeLoudness(ffmpeg, chunkFilepath, channelLayout, logStore);

            onProgress('Pass 2/4: Applying Loudness Correction...');
            const normalizedFile = await normalizeLoudness(ffmpeg, chunkFilepath, channelLayout, loudnessData, logStore);

            onProgress('Pass 3/4: Analyzing for Mastering...');
            const rmsLevel = await analyzeNormalized(ffmpeg, normalizedFile, logStore);

            onProgress('Pass 4/4: Applying Final Mastering...');
            const processedFilename = await masterEncode(ffmpeg, normalizedFile, rmsLevel, masteringOptions, logStore);

            const processedData = await ffmpeg.readFile(processedFilename);

            await ffmpeg.deleteFile(chunkFilepath);
            await ffmpeg.deleteFile(processedFilename);

            self.postMessage({
                status: 'success',
                chunkIndex,
                processedData: processedData.buffer, // Transfer the buffer
            }, [processedData.buffer]);

        } catch (error) {
            console.error(`Worker for chunk ${chunkIndex} failed:`, error);
            const errorMessage = `${error.message}\n\nFull Worker Log:\n${logStore.get()}`;
            self.postMessage({
                status: 'error',
                chunkIndex,
                context: 'processing',
                error: { message: errorMessage, stack: error.stack }
            });
        }
    }
};
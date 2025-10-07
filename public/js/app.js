/**
 * @file This is the main entry point and orchestrator for the MutterToButterWASM
 * application. This version is completely refactored to use the modern ESM
 * architecture, directly importing FFmpeg and orchestrating the worker pool.
 *
 * @version 6.1.0 (ESM Architecture, Corrected Imports)
 */

// --- Modern ESM Imports ---
// These are resolved by the importmap in index.html.
import { FFmpeg } from './vendor/@ffmpeg/ffmpeg/dist/esm/index.js';
import { fetchFile, toBlobURL } from './vendor/@ffmpeg/util/dist/esm/index.js'; // Corrected: fetchFile is from @ffmpeg/util

// --- Local Module Imports ---
import { UI } from './src/ui/ui.js';
import { runMasteringPipelineParallel } from './main.js';
import { WorkerPool } from './src/jobs/workerPool.js';
import { LogStore } from './src/ffmpeg/logStore.js';
// import {FFMPEG_URL, CORE_URL, WASM_URL, WORKER_URL} from './config.js';
// import {FFMPEG_URL, CORE_URL, WASM_URL, WORKER_URL} from './config.js';
import { ABS_WORKER_URL, ABS_CORE_URL, ABS_WASM_URL, ABS_FFMPEG_URL } from './config.js';

/**
 * @typedef {import('./src/jobs/workerPool.js').JobProgress} JobProgress
 * @typedef {import('./main.js').UIPayload} UIPayload
 */

class App {
    /**
     * Creates an instance of the main application class.
     */
    constructor() {
        this.ui = new UI();
        /** @type {FFmpeg | null} The main-thread FFmpeg instance for diagnostics. */
        this.ffmpeg = null;
        /** @type {WorkerPool | null} The pool of web workers for parallel processing. */
        this.workerPool = null;
        this.isReady = false;
        this.logStore = new LogStore();
    }

    /**
     * Initializes the entire application.
     * @returns {Promise<void>}
     */
    async init() {
        this.ui.displayLoadingState('Initializing Main Thread...');


        try {
            this.logStore.registerUI(this.ui);


            this.ffmpeg = new FFmpeg();
            this.ffmpeg.on('log', ({ message }) => this.logStore.append(message));


            this.ui.displayLoadingState('Loading FFmpeg Core...');

            await this.ffmpeg.load({
                coreURL: await toBlobURL(ABS_CORE_URL, 'text/javascript'),
                wasmURL: await toBlobURL(ABS_WASM_URL, 'application/wasm'),
                workerURL: await toBlobURL(ABS_WORKER_URL, 'text/javascript'),
            });

            this.ui.displayWorkerLoadingState('Creating Web Workers...');
            const workerScript = new URL('worker.js', import.meta.url).href
            console.log(workerScript)
            this.workerPool = new WorkerPool(workerScript);
// 1:8080/js/vendor/@ffmpeg/ffmpeg/dist/esm/ffmpeg-core.js
            // Initialize the worker pool by sending the plain string URLs.
            await this.workerPool.initialize({
                ffmpegURL: ABS_FFMPEG_URL,
                coreURL: ABS_CORE_URL,
                wasmURL:ABS_WASM_URL,
                workerURL: ABS_WORKER_URL
            }, (progress) => {
                this.ui.displayWorkerLoadingState(`Initializing Worker ${progress.ready} of ${progress.total}...`);
            });

            this.isReady = true;

            // Run initial diagnostic commands using the main-thread FFmpeg instance.
            this.logStore.clear();
            await this.ffmpeg.exec(['-version']);
            this.ui.update({ version: this.logStore.get() });

            this.logStore.clear();
            await this.ffmpeg.exec(['-filters']);
            this.ui.updateFilterList(this.logStore.get());

            this.ui.initializeEventListeners((file) => this.handleFileSelection(file));
            this.ui.displayInitialState();
            console.log("Parallel application is fully ready.");

            window.addEventListener('beforeunload', () => {
                if (this.workerPool) {
                    this.workerPool.terminate();
                }
            });

        } catch (error) {
            console.error("Critical Error during initialization.", error);
            this.ui.handleResult({
                error: new Error(`Initialization failed: ${error.message}`),
                executionTime: 0
            });
        }
    }

    /**
     * Handles the user's file selection and starts the mastering pipeline.
     * @param {File} file - The audio file selected by the user.
     * @returns {Promise<void>}
     */
    async handleFileSelection(file) {
        if (!this.isReady || !this.ffmpeg || !this.workerPool) {
            console.warn("FFmpeg or workers are not ready. Please wait for initialization to complete.");
            return;
        }
        this.ui.displayProcessingState(file);
        this.ui.initializeWorkerStatus(this.workerPool.poolSize);

        const masteringOptions = this.ui.getMasteringOptions();
        const fileData = await fetchFile(file);

        const onUpdate = (update) => {
            if (update.type === 'duration') {
                this.ui.updateDuration(update.duration);
            } else if (!('logs' in update)) {
                this.ui.update(update);
            }
        };

        const onProgress = ({ workerId, chunkIndex, message }) => {
            this.ui.updateWorkerStatus(workerId, `Chunk ${chunkIndex}: ${message}`);
        };

        // Note: We are no longer using the main-thread FFmpeg for the pipeline itself.
        const result = await runMasteringPipelineParallel(
            this.ffmpeg, // This is only used for `analyze` and `chunk` which are fast.
            this.workerPool,
            fileData,
            masteringOptions,
            { ui: this.ui, update: onUpdate },
            this.logStore,
            onProgress
        );

        this.ui.handleResult(result);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
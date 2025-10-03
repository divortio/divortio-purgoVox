import { UI } from './ui/ui.js';
import { runMasteringPipelineParallel } from './main/ffmpeg-pipeline.js';
import { initializeFFmpeg } from './ffmpeg/ffmpeg-loader.js'; // <-- MODIFIED
import { runDiagnostics } from './ui/diagnostics.js';
import { runFFmpeg } from './ffmpeg/run.js';
import { WorkerPool } from './main/worker-pool.js';

class App {
    constructor() {
        this.ui = new UI();
        this.ffmpeg = null;
        this.workerPool = null;
        this.isReady = false;
    }

    async init() {
        this.ui.displayLoadingState('Initializing Main Thread...');
        runDiagnostics();

        try {
            // --- MODIFICATION START ---
            // Use the new, simplified loader.
            this.ffmpeg = await initializeFFmpeg((ratio) => this.ui.updateLoadingProgress(ratio));

            this.ui.displayWorkerLoadingState('Creating Web Workers...');

            this.workerPool = new WorkerPool('./js/worker/process-chunk.worker.js');

            // The worker now handles its own loading, so we just initialize it.
            await this.workerPool.initialize((progress) => {
                this.ui.displayWorkerLoadingState(`Initializing Worker ${progress.ready} of ${progress.total}...`);
            });
            // --- MODIFICATION END ---


            this.isReady = true;

            const logStore = {
                logs: '',
                append: function (message) { this.logs += message + '\n'; },
                get: function () { return this.logs; },
                clear: function () { this.logs = ''; }
            };

            const logHandler = ({ message }) => logStore.append(message);
            this.ffmpeg.on('log', logHandler);

            logStore.clear();
            await runFFmpeg(this.ffmpeg, ['-version'], null, logStore);
            this.ui.update({ version: logStore.get() });

            logStore.clear();
            await runFFmpeg(this.ffmpeg, ['-filters'], null, logStore);
            this.ui.updateFilterList(logStore.get());

            this.ffmpeg.off('log', logHandler);

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

    // ... (rest of the file is unchanged)
    async handleFileSelection(file) {
        if (!this.isReady || !this.ffmpeg) {
            console.warn("FFmpeg or workers are not ready. Please wait for initialization to complete.");
            return;
        }
        this.ui.displayProcessingState(file);
        this.ui.initializeWorkerStatus(this.workerPool.poolSize);

        const masteringOptions = this.ui.getMasteringOptions();

        const onUpdate = (update) => {
            if (update.type === 'duration') {
                this.ui.updateDuration(update.duration);
            } else {
                this.ui.update(update);
            }
        };

        const onProgress = ({ workerId, chunkIndex, message }) => {
            this.ui.updateWorkerStatus(workerId, `Chunk ${chunkIndex}: ${message}`);
        };

        const result = await runMasteringPipelineParallel(
            this.ffmpeg,
            this.workerPool,
            file,
            masteringOptions,
            onUpdate,
            onProgress
        );

        this.ui.handleResult(result);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
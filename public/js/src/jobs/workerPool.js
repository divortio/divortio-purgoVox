/**
 * @file Manages a pool of Web Workers for parallel processing tasks.
 * This version includes enhanced error handling and logging to diagnose
 * initialization failures.
 *
 * @version 2.1.0
 */



/**
 * @typedef {object} WorkerProgress
 * @property {number} ready - The number of workers that have successfully initialized.
 * @property {number} total - The total number of workers in the pool.
 */

/**
 * @typedef {object} JobProgress
 * @property {number} workerId - The ID of the worker processing the job.
 * @property {number} chunkIndex - The index of the data chunk being processed.
 * @property {string} message - The progress message from the worker.
 */

export class WorkerPool {
    /**
     * Creates an instance of WorkerPool.
     * @param {string} workerScript - The path to the Web Worker script.
     * @param {number} [poolSize=navigator.hardwareConcurrency] - The number of workers to create in the pool.
     */
    constructor(workerScript, poolSize = navigator.hardwareConcurrency) {
        this.workerScript = workerScript;
        this.poolSize = poolSize;
        this.workers = [];
        this.jobQueue = [];
        this.activeJobs = new Map();
        this.workerState = new Map(); // Maps worker.id to chunkIndex

        console.log(`[WorkerPool] Creating ${this.poolSize} workers from script: ${this.workerScript}`);
        this._createWorkers();
    }

    /**
     * Creates the individual Web Workers and adds them to the pool.
     * @private
     */
    _createWorkers() {
        for (let i = 0; i < this.poolSize; i++) {
            try {
                // const worker = new Worker(this.workerScript);
                const worker = new Worker(this.workerScript, {type: 'module'});
                worker.id = i;
                // --- ENHANCED ERROR HANDLING ---
                worker.onerror = (e) => this._handleWorkerError(worker, e);
                this.workers.push(worker);
                console.log(`[WorkerPool] Successfully created Worker ${i}.`);
            } catch (e) {
                console.error(`[WorkerPool] FATAL: Failed to construct Worker ${i}. This often happens if the script path is wrong or a critical import is missing.`, e);
                throw e; // Re-throw to stop initialization
            }
        }
    }

    /**
     * Initializes all workers in the pool by sending them the FFmpeg configuration.
     *
     * @param {object} ffmpegConfig - The pre-loaded FFmpeg configuration object containing Blob URLs.
     * @param {(progress: WorkerProgress) => void} onProgress - A callback to report initialization progress.
     * @returns {Promise<void>} A promise that resolves when all workers are ready.
     */
    initialize(ffmpegConfig, onProgress) {
        console.log("[WorkerPool] Initializing all workers...");
        return new Promise((resolve, reject) => {
            let readyCount = 0;
            this.workers.forEach((worker) => {
                worker.onmessage = (e) => {
                    console.log(`[WorkerPool] Received message from Worker ${worker.id}:`, e.data);
                    if (e.data.status === 'ready') {
                        readyCount++;
                        if (onProgress) onProgress({ ready: readyCount, total: this.poolSize });
                        if (readyCount === this.poolSize) {
                            console.log("[WorkerPool] All workers are ready.");
                            this.workers.forEach(w => w.onmessage = (msg) => this._handleWorkerMessage(w, msg.data));
                            resolve();
                        }
                    } else if (e.data.status === 'error') {
                        const err = e.data.error;
                        const errorMessage = `Worker ${worker.id} reported an initialization error: ${err.message}\n${err.stack}`;
                        console.error(`[WorkerPool] ${errorMessage}`);
                        reject(new Error(errorMessage));
                    }
                };

                try {
                    console.log(`[WorkerPool] Posting 'init' message to Worker ${worker.id}: ${JSON.stringify(ffmpegConfig)}`);

                    worker.postMessage({ command: 'init', ffmpegConfig: ffmpegConfig });
                } catch (e) {
                    console.error(`[WorkerPool] FATAL: Failed to post 'init' message to Worker ${worker.id}. This can happen if the config object is not structured correctly.`, e);
                    reject(e);
                }
            });
        });
    }

    dispatch(message, transfer = [], onProgress) {
        return new Promise((resolve, reject) => {
            const availableWorker = this.workers.find(w => !w.isBusy);
            if (availableWorker) {
                this._assignJob(availableWorker, message, transfer, resolve, reject, onProgress);
            } else {
                this.jobQueue.push({ message, transfer, resolve, reject, onProgress });
            }
        });
    }

    _assignJob(worker, message, transfer, resolve, reject, onProgress) {
        worker.isBusy = true;
        const chunkIndex = message.chunkIndex;
        this.activeJobs.set(chunkIndex, { resolve, reject, onProgress });
        this.workerState.set(worker.id, chunkIndex);

        worker.postMessage({ command: 'process', ...message }, transfer);
    }

    _handleWorkerMessage(worker, data) {
        const { status, chunkIndex, processedData, message, error } = data;
        const job = this.activeJobs.get(chunkIndex);

        if (!job) return;

        if (status === 'progress') {
            if (job.onProgress) {
                job.onProgress({ workerId: worker.id, chunkIndex, message });
            }
            return;
        }

        if (status === 'success') {
            job.resolve({ chunkIndex, processedData });
        } else {
            const err = new Error(error.message);
            err.stack = error.stack;
            job.reject(err);
        }
        this.activeJobs.delete(chunkIndex);

        this.workerState.delete(worker.id);
        worker.isBusy = false;

        const nextJob = this.jobQueue.shift();
        if (nextJob) {
            this._assignJob(worker, nextJob.message, nextJob.transfer, nextJob.resolve, nextJob.reject, nextJob.onProgress);
        }
    }

    // --- ENHANCED ERROR HANDLING ---
    _handleWorkerError(worker, error) {
        // Prevent the default browser error message
        error.preventDefault();

        console.error(`[WorkerPool] Worker ${worker.id} threw a fatal, uncaught error. This is often due to a script loading or syntax issue inside the worker.`, {
            errorMessage: error.message,
            fileName: error.filename,
            lineNumber: error.lineno,
            fullErrorObject: error
        });

        const chunkIndex = this.workerState.get(worker.id);
        if (chunkIndex !== undefined) {
            const job = this.activeJobs.get(chunkIndex);
            if (job) {
                const jobError = new Error(`Worker ${worker.id} crashed while processing chunk ${chunkIndex}. See console for details.`);
                job.reject(jobError);
                this.activeJobs.delete(chunkIndex);
            }
        }
        // Also reject the main initialization promise if it's still pending
        const initReject = this.workers.find(w => w.id === worker.id)?.rejectPromise;
        if(initReject) {
            initReject(new Error(`Worker ${worker.id} encountered a fatal error during initialization:\nMessage: ${error.message}\nFile: ${error.filename}\nLine: ${error.lineno}`));
        }
    }


    terminate() {
        console.log("[WorkerPool] Terminating all workers.");
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }
}
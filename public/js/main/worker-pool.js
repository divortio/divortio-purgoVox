/**
 * @file Manages a pool of Web Workers for parallel processing tasks.
 */

export class WorkerPool {
    constructor(workerScript, poolSize = navigator.hardwareConcurrency) {
        this.workerScript = workerScript;
        this.poolSize = poolSize;
        this.workers = [];
        this.jobQueue = [];
        this.activeJobs = new Map();
        this.workerState = new Map();

        this._createWorkers();
    }

    _createWorkers() {
        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(this.workerScript, { type: 'module' });
            worker.id = i;
            worker.onerror = (e) => this._handleWorkerError(worker, e);
            this.workers.push(worker);
        }
    }

    // --- MODIFICATION START ---
    // This `initialize` signature now correctly matches the call from `app.js`.
    // It only expects the `onProgress` callback.
    initialize(onProgress) {
        // --- MODIFICATION END ---
        return new Promise((resolve, reject) => {
            let readyCount = 0;
            this.workers.forEach((worker) => {
                worker.onmessage = (e) => {
                    if (e.data.status === 'ready') {
                        readyCount++;
                        if (onProgress) onProgress({ ready: readyCount, total: this.poolSize });
                        if (readyCount === this.poolSize) {
                            this.workers.forEach(w => w.onmessage = (msg) => this._handleWorkerMessage(w, msg.data));
                            resolve();
                        }
                    } else if (e.data.status === 'error') {
                        const err = e.data.error;
                        const errorMessage = err.message ? `${err.message}\n${err.stack}` : `Initialization failed with an unknown error.`;
                        reject(new Error(`Worker ${worker.id} failed to initialize:\n${errorMessage}`));
                    } else {
                        reject(new Error(`Worker ${worker.id} sent an unexpected message during initialization.`));
                    }
                };

                worker.onerror = (e) => {
                    e.preventDefault();
                    const errorDetails = `Message: ${e.message}\nFile: ${e.filename}\nLine: ${e.lineno}`;
                    reject(new Error(`Worker ${worker.id} encountered a fatal error during initialization:\n${errorDetails}`));
                };

                // --- MODIFICATION START ---
                // The postMessage call now correctly sends a simple, clonable object.
                worker.postMessage({ command: 'init' });
                // --- MODIFICATION END ---
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

    _handleWorkerError(worker, error) {
        console.error(`Worker ${worker.id} crashed!`, error);
        const chunkIndex = this.workerState.get(worker.id);
        if (chunkIndex !== undefined) {
            const job = this.activeJobs.get(chunkIndex);
            if (job) {
                job.reject(new Error(`Worker ${worker.id} crashed while processing chunk ${chunkIndex}. The pipeline cannot continue.`));
                this.activeJobs.delete(chunkIndex);
            }
        }
    }

    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }
}
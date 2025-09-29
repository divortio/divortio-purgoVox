/**
 * @file This is the main orchestrator for the MutterToButter audio mastering pipeline.
 * This version uses a pool of Web Workers to process audio chunks in parallel.
 */

import { sanitize } from './pipeline/step0-sanitize.js';
import { analyze } from './pipeline/step1-analyze.js';
import { chunk } from './pipeline/step2-chunk.js';
import { concatenate } from './pipeline/step4-concatenate.js';

/**
 * @typedef {import('./pipeline/step3-process-chunks.js').MasteringOptions} MasteringOptions
 */

/**
 * @typedef {import('./worker-pool.js').WorkerPool} WorkerPool
 */

/**
 * @typedef {object} UIPayload
 * @property {string} [command] - The FFmpeg command being executed.
 * @property {string} [logs] - Log messages from the FFmpeg process.
 * @property {{current: number, total: number}} [progressStep] - The current step in the overall pipeline.
 * @property {string} [progressMessage] - A high-level message for the current step.
 * @property {string} [subProgressMessage] - A more granular message for sub-steps.
 * @property {number} [stepTime] - The time taken for a step to complete, in milliseconds.
 * @property {string} [version] - The FFmpeg version string.
 * @property {string} [type] - A special type for specific updates, e.g., 'duration'.
 * @property {number} [duration] - The audio duration, sent with type 'duration'.
 */

/**
 * @typedef {object} PipelineResult
 * @property {Blob} [audioBlob] - The final mastered audio file as a Blob.
 * @property {number} [audioDuration] - The duration of the audio in seconds.
 * @property {number} executionTime - The total time taken for the pipeline to run, in milliseconds.
 * @property {Error} [error] - An error object if the pipeline failed.
 */

/**
 * @callback LogCallback
 * @param {{ message: string }} log - The log object from FFmpeg.
 */

/**
 * @callback ProgressCallback
 * @param {{ progress: number, time: number }} progress - The progress object from FFmpeg.
 */

/**
 * Provides type hints to the IDE for the dynamically loaded FFmpeg instance.
 * @typedef {object} FFmpeg
 * @property {(...args: string[]) => Promise<void>} exec - Executes an FFmpeg command.
 * @property {(path: string, data: Uint8Array) => Promise<void>} writeFile - Writes a file to the virtual filesystem.
 * @property {(path: string) => Promise<Uint8Array>} readFile - Reads a file from the virtual filesystem.
 * @property {(path: string) => Promise<void>} deleteFile - Deletes a file from the virtual filesystem.
 * @property {(path: string) => Promise<void>} createDir - Creates a directory in the virtual filesystem.
 * @property {(path: string) => Promise<any[]>} listDir - Lists the contents of a directory.
 * @property {(fsType: string, options: object, mountPoint: string) => Promise<void>} mount - Mounts a filesystem.
 * @property {(mountPoint: string) => Promise<void>} unmount - Unmounts a filesystem.
 * @property {(event: 'log', callback: LogCallback) => void} on - Registers an event listener.
 * @property {(event: 'progress', callback: ProgressCallback) => void} on - Registers an event listener.
 * @property {(event: 'log', callback: LogCallback) => void} off - Unregisters an event listener.
 * @property {(event: 'progress', callback: ProgressCallback) => void} off - Unregisters an event listener.
 * @property {(config: object) => Promise<void>} load - Loads the FFmpeg core.
 */

/**
 * Executes the full audio mastering pipeline using a pre-initialized pool of Web Workers.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance for the main thread.
 * @param {WorkerPool} workerPool - The pre-initialized pool of workers.
 * @param {File} file - The user-uploaded audio file.
 * @param {MasteringOptions} options - User-selected mastering options from the UI.
 * @param {(payload: UIPayload) => void} updateUI - The UI update callback function.
 * @param {(progress: import('./worker-pool.js').ProgressMessage) => void} onProgress - Callback for real-time progress updates from workers.
 * @returns {Promise<PipelineResult>} The result of the pipeline execution.
 */
export async function runMasteringPipelineParallel(ffmpeg, workerPool, file, options, updateUI, onProgress) {
    const overallStartTime = performance.now();
    let audioDuration = 0;
    const cleanupPaths = [];
    const workingDirectory = '/work';

    const logStore = {
        logs: '',
        append: function (message) {
            this.logs += message + '\n';
            updateUI({ logs: message });
        },
        get: function () { return this.logs; },
        clear: function () { this.logs = ''; }
    };

    const logHandler = ({ message }) => logStore.append(message);

    const cleanup = async () => {
        for (const path of cleanupPaths) {
            try {
                await ffmpeg.deleteFile(path);
            } catch (e) { /* ignore */ }
        }
        try {
            await ffmpeg.unmount(workingDirectory);
        } catch(e) { /* ignore */ }
    };

    try {
        // --- BUG FIX ---
        // Explicitly create the working directory before mounting to it.
        await ffmpeg.createDir(workingDirectory);
        // --- END BUG FIX ---
        await ffmpeg.mount('WORKERFS', { files: [file] }, workingDirectory);
        const inputPath = `${workingDirectory}/${file.name}`;
        cleanupPaths.push(inputPath);

        ffmpeg.on('log', logHandler);

        updateUI({ progressMessage: 'Step 1/5: Sanitizing Audio...', progressStep: { current: 1, total: 5 } });
        const sanitizedAudioFile = await sanitize(ffmpeg, inputPath, workingDirectory, updateUI, logStore);
        cleanupPaths.push(sanitizedAudioFile);

        updateUI({ progressMessage: 'Step 2/5: Analyzing Audio...', progressStep: { current: 2, total: 5 } });
        const { duration, channelLayout } = await analyze(ffmpeg, sanitizedAudioFile, updateUI, logStore);
        audioDuration = duration;
        updateUI({ type: 'duration', duration: audioDuration });

        updateUI({ progressMessage: 'Step 3/5: Chunking Audio...', progressStep: { current: 3, total: 5 } });
        const chunkFiles = await chunk(ffmpeg, sanitizedAudioFile, workingDirectory, updateUI, logStore);
        cleanupPaths.push(...chunkFiles);

        updateUI({ progressMessage: `Step 4/5: Mastering ${chunkFiles.length} Chunks (in parallel)...`, progressStep: { current: 4, total: 5 } });
        const processingPromises = chunkFiles.map(async (chunkFilename, index) => {
            const chunkData = await ffmpeg.readFile(chunkFilename);
            return workerPool.dispatch(
                {
                    chunkIndex: index,
                    chunkData: chunkData,
                    channelLayout: channelLayout,
                    masteringOptions: options
                },
                [chunkData.buffer],
                onProgress
            );
        });

        const processedResults = await Promise.all(processingPromises);

        const processedFiles = [];
        for (const result of processedResults) {
            const processedFilename = `${workingDirectory}/processed_${String(result.chunkIndex).padStart(4, '0')}.mp3`;
            await ffmpeg.writeFile(processedFilename, result.processedData);
            processedFiles.push(processedFilename);
            cleanupPaths.push(processedFilename);
        }
        processedFiles.sort();

        updateUI({ progressMessage: 'Step 5/5: Assembling Final File...', progressStep: { current: 5, total: 5 } });
        const metadata = {
            title: `${file.name.split('.').slice(0, -1).join('.')} (Mastered)`,
            artist: 'MutterToButter WASM',
            album: new Date().toLocaleDateString(),
            date: new Date().getFullYear().toString(),
            comment: `Processed in parallel with MutterToButter WASM.`
        };
        const finalAudioFile = await concatenate(ffmpeg, processedFiles, metadata, workingDirectory, updateUI, logStore);
        cleanupPaths.push(finalAudioFile, `${workingDirectory}/concat_list.txt`);

        ffmpeg.off('log', logHandler);
        const data = await ffmpeg.readFile(finalAudioFile);
        const audioBlob = new Blob([data.buffer], { type: 'audio/mpeg' });

        await cleanup();
        return {
            audioBlob,
            audioDuration,
            executionTime: performance.now() - overallStartTime
        };

    } catch (error) {
        console.error("Caught error during parallel pipeline execution:", error);
        if (workerPool && workerPool.workerState && workerPool.workerState.size > 0) {
            console.error("State of workers at time of error:", Object.fromEntries(workerPool.workerState));
        }
        ffmpeg.off('log', logHandler);
        await cleanup();
        return { error, executionTime: performance.now() - overallStartTime };
    }
}
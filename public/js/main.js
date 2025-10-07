/**
 * @file This is the main orchestrator for the MutterToButter audio mastering pipeline.
 * This version uses a pool of Web Workers to process audio chunks in parallel and
 * has been refactored to use the centralized logging system.
 *
 * @version 3.0.0
 */

import { sanitize } from './src/jobs/main/step0-sanitize.js';
import { analyze } from './src/jobs/main/step1-analyze.js';
import { chunk } from './src/jobs/main/step2-chunk.js';
import { concatenate } from './src/jobs/main/step4-concatenate.js';

/**
 * @typedef {import('./src/jobs/main/step3-process-chunks.js').MasteringOptions} MasteringOptions
 * @typedef {import('./src/jobs/workerPool.js').WorkerPool} WorkerPool
 * @typedef {import('./app.js').UIPayload} UIPayload
 * @typedef {import('./app.js').LogStore} LogStore
 * @typedef {import('./app.js').UI} UI
 * @typedef {import('./main.js').FFmpeg} FFmpeg
 * @typedef {import('./src/jobs/workerPool.js').JobProgress} JobProgress
 */

/**
 * @typedef {object} PipelineResult
 * @property {Blob} [audioBlob] - The final mastered audio file as a Blob.
 * @property {number} [audioDuration] - The duration of the audio in seconds.
 * @property {number} executionTime - The total time taken for the pipeline to run, in milliseconds.
 * @property {Error} [error] - An error object if the pipeline failed.
 */

/**
 * Executes the full audio mastering pipeline using a pre-initialized pool of Web Workers.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance for the main thread.
 * @param {WorkerPool} workerPool - The pre-initialized pool of workers.
 * @param {File} file - The user-uploaded audio file.
 * @param {MasteringOptions} options - User-selected mastering options from the UI.
 * @param {{ui: UI, update: onUpdate}} updateUI - The UI update callback function.
 * @param {LogStore} logStore - The central log store.
 * @param {JobProgress} onProgress - Callback for real-time progress updates from workers.
 * @returns {Promise<PipelineResult>} The result of the pipeline execution.
 */
export async function runMasteringPipelineParallel(ffmpeg, workerPool, file, options, updateUI, logStore, onProgress) {
    const overallStartTime = performance.now();
    let audioDuration = 0;
    const cleanupPaths = [];
    const workingDirectory = '/work';
    const ui = updateUI.ui; // Get the UI instance from the updateUI object

    const cleanup = async () => {
        for (const path of cleanupPaths) {
            try { await ffmpeg.deleteFile(path); } catch (e) { /* ignore */ }
        }
        try { await ffmpeg.unmount(workingDirectory); } catch(e) { /* ignore */ }
    };

    try {
        await ffmpeg.createDir(workingDirectory);
        await ffmpeg.mount('WORKERFS', { files: [file] }, workingDirectory);
        const inputPath = `${workingDirectory}/${file.name}`;
        cleanupPaths.push(inputPath);

        // --- CORRECTION START ---
        // All calls to pipeline steps now pass the correct parameters.
        updateUI({ progressMessage: 'Step 1/5: Sanitizing Audio...', progressStep: { current: 1, total: 5 } });
        const sanitizedAudioFile = await sanitize(ffmpeg, inputPath, workingDirectory, ui);
        cleanupPaths.push(sanitizedAudioFile);

        updateUI({ progressMessage: 'Step 2/5: Analyzing Audio...', progressStep: { current: 2, total: 5 } });
        const { duration, channelLayout } = await analyze(ffmpeg, sanitizedAudioFile, ui, logStore);
        audioDuration = duration;
        updateUI({ type: 'duration', duration: audioDuration });

        updateUI({ progressMessage: 'Step 3/5: Chunking Audio...', progressStep: { current: 3, total: 5 } });
        const chunkFiles = await chunk(ffmpeg, sanitizedAudioFile, workingDirectory, ui);
        cleanupPaths.push(...chunkFiles);
        // --- CORRECTION END ---

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

        // --- CORRECTION START ---
        updateUI({ progressMessage: 'Step 5/5: Assembling Final File...', progressStep: { current: 5, total: 5 } });
        const metadata = {
            title: `${file.name.split('.').slice(0, -1).join('.')} (Mastered)`,
            artist: 'MutterToButter WASM',
            album: new Date().toLocaleDateString(),
            date: new Date().getFullYear().toString(),
            comment: `Processed in parallel with MutterToButter WASM.`
        };
        const finalAudioFile = await concatenate(ffmpeg, processedFiles, metadata, workingDirectory, ui);
        cleanupPaths.push(finalAudioFile, `${workingDirectory}/concat_list.txt`);
        // --- CORRECTION END ---

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
        await cleanup();
        return { error, executionTime: performance.now() - overallStartTime };
    }
}
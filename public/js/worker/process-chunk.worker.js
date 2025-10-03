/**
 * @file Web Worker for parallel audio chunk processing.
 */
import { initializeFFmpeg } from '../ffmpeg/ffmpeg-loader.js'; // <-- MODIFIED
import { analyzeLoudness } from './pipeline/pass1_analyzeLoudness.js';
import { normalizeLoudness } from './pipeline/pass2_normalizeLoudness.js';
import { analyzeNormalized } from './pipeline/pass3_analyzeNormalized.js';
import { masterEncode } from './pipeline/pass4_masterEncode.js';

let ffmpeg = null;
let isInitialized = false;

const logStore = {
    logs: '',
    append: function(message) { this.logs += message + '\n'; },
    get: function() { return this.logs; },
    clear: function() { this.logs = ''; }
};

self.onmessage = async (e) => {
    const { command } = e.data;

    if (command === 'init') {
        try {
            if (!ffmpeg) {
                // --- MODIFICATION START ---
                // The worker now calls the same loader as the main thread.
                ffmpeg = await initializeFFmpeg();
                // --- MODIFICATION END ---
                await ffmpeg.createDir('/work');
                ffmpeg.on('log', ({ message }) => logStore.append(message));
            }
            isInitialized = true;
            self.postMessage({ status: 'ready' });
        } catch (error) {
            console.error("Error during worker FFMPEG initialization:", error);
            self.postMessage({ status: 'error', context: 'initialization', error: { message: error.message, stack: error.stack } });
        }
        return;
    }

    if (command === 'process') {
        // ... (rest of the file is unchanged)
        if (!isInitialized) {
            self.postMessage({ status: 'error', context: 'processing', error: { message: 'Worker is not initialized.' } });
            return;
        }

        const { chunkIndex, chunkData, channelLayout, masteringOptions } = e.data;
        const workingDirectory = '/work';

        const onProgress = (message) => {
            self.postMessage({
                status: 'progress',
                chunkIndex,
                message
            });
        };

        const chunkName = `chunk_${String(chunkIndex).padStart(4, '0')}.wav`;
        const chunkFilepath = `${workingDirectory}/${chunkName}`;

        try {
            await ffmpeg.writeFile(chunkFilepath, chunkData);

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
                processedData,
            }, [processedData.buffer]);

        } catch (error) {
            console.error(`Worker for chunk ${chunkIndex} failed:`, error);
            const errorMessage = `${error.message}\n\nFull Worker Log:\n${logStore.get()}`;
            self.postMessage({
                status: 'error',
                chunkIndex,
                context: 'processing',
                error: {
                    message: errorMessage,
                    stack: error.stack
                }
            });
        }
    }
};
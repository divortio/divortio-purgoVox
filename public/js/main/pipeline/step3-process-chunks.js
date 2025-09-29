/**
 * @file Pipeline Step 3: Processes each audio chunk through a multi-pass mastering chain.
 * This script is used by the sequential pipeline and contains the core audio processing logic.
 */

import { runFFmpeg } from '../../ffmpeg/run.js';
import { parseLoudness, parseRmsLevel } from '../../log-parser.js';
import {
    TARGET_LOUDNESS_LUFS,
    TARGET_TRUE_PEAK_DBFS,
    TARGET_LOUDNESS_RANGE_LU,
    HIGH_PASS_FREQ_HZ,
    NOISE_FLOOR_DBFS,
    OUTPUT_FORMAT,
    OUTPUT_QUALITY
} from '../../../constants/config.js';

/**
 * @typedef {import('../../app.js').UIPayload} UIPayload
 */

/**
 * @typedef {object} MasteringOptions
 * @property {boolean} gate - Whether to enable the dynamic noise gate.
 * @property {boolean} clarity - Whether to enable the high-frequency clarity boost.
 * @property {boolean} tonal - Whether to enable the tonal balance EQ.
 * @property {boolean} softClip - Whether to enable the soft clipper.
 */

/**
 * Processes all audio chunks through a four-pass audio mastering workflow.
 * This function is designed to work within a `WORKERFS` environment where all input
 * and output files are expected to be within a specific working directory.
 *
 * @param {import('../ffmpeg-pipeline.js').FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} chunkFiles - A sorted array of full paths to the chunk files (e.g., ['/work/chunk_0000.wav']).
 * @param {string} channelLayout - The channel layout ('mono' or 'stereo') of the audio.
 * @param {MasteringOptions} options - User-selected mastering options.
 * @param {(payload: UIPayload) => void} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<{processedFiles: string[]}>} A promise that resolves with an object containing the list of processed file paths.
 */
export async function processChunks(ffmpeg, chunkFiles, channelLayout, options, updateUI, logStore) {
    /** @type {string[]} */
    const processedFiles = [];

    for (let i = 0; i < chunkFiles.length; i++) {
        const chunkFile = chunkFiles[i];

        // Correctly determine the working directory and filenames from the full input path.
        const pathParts = chunkFile.split('/');
        const chunkNameOnly = pathParts.pop();
        const workingDirectory = pathParts.join('/');
        const chunkBasename = chunkNameOnly.split('.')[0];

        const tempNormalizedFile = `${workingDirectory}/${chunkBasename}_norm.wav`;
        const finalOutputFile = `${workingDirectory}/${chunkBasename}_mastered.${OUTPUT_FORMAT}`;
        const rmsLogFile = `${workingDirectory}/rms_pass_${i}.txt`; // Unique name inside working dir

        updateUI({
            subProgressMessage: `Processing Chunk (${i + 1}/${chunkFiles.length})`,
        });

        // --- PASS 1: Loudness Analysis ---
        logStore.clear();
        const initialFilters = `aformat=channel_layouts=${channelLayout},highpass=f=${HIGH_PASS_FREQ_HZ},afftdn=nf=${NOISE_FLOOR_DBFS},deesser`;
        const loudnessAnalysisFilter = `${initialFilters},loudnorm=I=${TARGET_LOUDNESS_LUFS}:TP=${TARGET_TRUE_PEAK_DBFS}:LRA=${TARGET_LOUDNESS_RANGE_LU}:print_format=json`;
        const analysisArgs = ['-i', chunkFile, '-af', loudnessAnalysisFilter, '-f', 'null', '-'];
        await runFFmpeg(ffmpeg, analysisArgs, updateUI, logStore);
        const loudnessData = parseLoudness(logStore.get());

        // --- PASS 2: Loudness Normalization ---
        const loudnessCorrectionFilter = `${initialFilters},loudnorm=I=${TARGET_LOUDNESS_LUFS}:TP=${TARGET_TRUE_PEAK_DBFS}:LRA=${TARGET_LOUDNESS_RANGE_LU}:measured_I=${loudnessData.measured_I}:measured_TP=${loudnessData.measured_TP}:measured_LRA=${loudnessData.measured_LRA}:measured_thresh=${loudnessData.measured_thresh}:offset=${loudnessData.target_offset}`;
        const normalizeArgs = ['-i', chunkFile, '-af', loudnessCorrectionFilter, tempNormalizedFile];
        await runFFmpeg(ffmpeg, normalizeArgs, updateUI, logStore);

        // --- PASS 3: Mastering Analysis (RMS) ---
        const rmsAnalysisFilter = `astats=metadata=1,ametadata=mode=print:file=${rmsLogFile}`;
        const rmsArgs = ['-i', tempNormalizedFile, '-af', rmsAnalysisFilter, '-f', 'null', '-'];
        await runFFmpeg(ffmpeg, rmsArgs, updateUI, logStore);
        const rmsFileContent = new TextDecoder().decode(await ffmpeg.readFile(rmsLogFile));
        const rmsLevel = parseRmsLevel(rmsFileContent);
        await ffmpeg.deleteFile(rmsLogFile);

        if (isNaN(rmsLevel)) {
            throw new Error(`Failed to parse a valid RMS level for chunk ${chunkFile}.`);
        }

        // --- PASS 4: Final Mastering and Encoding ---
        const masteringFilters = [];
        const demudThreshold = rmsLevel + 3;

        masteringFilters.push(`adynamicequalizer=dfrequency=350:dqfactor=1.75:tfrequency=350:tqfactor=1.75:tftype=bell:threshold=${demudThreshold}:attack=20:release=50:knee=1:ratio=1:makeup=2:range=2:slew=1:mode=boost`);
        masteringFilters.push(`adynamicequalizer=dfrequency=7000:dqfactor=3.5:tfrequency=7000:tqfactor=3.5:tftype=bell:threshold=22:attack=20:release=50:knee=1:ratio=1:makeup=3:range=3:slew=1:mode=boost`);
        masteringFilters.push(`alimiter=limit=0.9`);

        if (options.gate) {
            const gateThresholdDb = rmsLevel - 18;
            const gateThresholdLinear = Math.pow(10, gateThresholdDb / 20);
            masteringFilters.push(`agate=threshold=${gateThresholdLinear}`);
        }
        if (options.clarity) {
            masteringFilters.push("equalizer=f=8000:t=h:g=3");
        }
        if (options.tonal) {
            masteringFilters.push("equalizer=f=92:width_type=h:w=50:g=1");
            masteringFilters.push("equalizer=f=185:width_type=h:w=100:g=1");
            masteringFilters.push("equalizer=f=5920:width_type=h:w=1000:g=1.5");
        }
        if (options.softClip) {
            masteringFilters.push("asoftclip=type=atan");
        }

        const finalFilterString = masteringFilters.join(',');
        const finalArgs = ['-i', tempNormalizedFile, '-af', finalFilterString, ...OUTPUT_QUALITY.split(' '), finalOutputFile];
        await runFFmpeg(ffmpeg, finalArgs, updateUI, logStore);

        await ffmpeg.deleteFile(tempNormalizedFile);
        processedFiles.push(finalOutputFile);
    }

    return {processedFiles};
}
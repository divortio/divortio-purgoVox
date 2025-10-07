/**
 * @file Worker Pipeline: Pass 2 - Loudness Normalization.
 * This module applies loudness correction based on the analysis from Pass 1.
 * This version is updated to use the refactored runFFmpeg utility.
 *
 * @version 2.0.0
 */

import { runFFmpeg } from '../../ffmpeg/run.js';
import {
    TARGET_LOUDNESS_LUFS,
    TARGET_TRUE_PEAK_DBFS,
    TARGET_LOUDNESS_RANGE_LU,
    HIGH_PASS_FREQ_HZ,
    NOISE_FLOOR_DBFS
} from '../../../config.js';

/**
 * @typedef {import('../../../main.js').FFmpeg} FFmpeg
 * @typedef {import('../../log-parser.js').LoudnessData} LoudnessData
 */

/**
 * Executes the second pass of loudness normalization, creating a temporary normalized file.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The full path to the input audio chunk.
 * @param {string} channelLayout - The channel layout of the audio.
 * @param {LoudnessData} loudnessData - The loudness data obtained from Pass 1.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} A promise that resolves with the full path to the temporary normalized WAV file.
 * @throws {Error} If the FFmpeg command fails or if the output file is not created.
 */
export async function normalizeLoudness(ffmpeg, inputFile, channelLayout, loudnessData, logStore) {
    console.log(`Pass 2: Normalizing loudness for ${inputFile}`);

    const pathParts = inputFile.split('/');
    const workingDirectory = pathParts.slice(0, -1).join('/');
    const baseName = pathParts.pop().split('.')[0];
    const tempNormalizedFile = `${workingDirectory}/${baseName}_norm.wav`;

    try {
        logStore.clear();
        const initialFilters = `aformat=channel_layouts=${channelLayout},highpass=f=${HIGH_PASS_FREQ_HZ},afftdn=nf=${NOISE_FLOOR_DBFS},deesser`;
        const loudnessCorrectionFilter = `${initialFilters},loudnorm=I=${TARGET_LOUDNESS_LUFS}:TP=${TARGET_TRUE_PEAK_DBFS}:LRA=${TARGET_LOUDNESS_RANGE_LU}:measured_I=${loudnessData.measured_I}:measured_TP=${loudnessData.measured_TP}:measured_LRA=${loudnessData.measured_LRA}:measured_thresh=${loudnessData.measured_thresh}:offset=${loudnessData.target_offset}`;

        const args = ['-i', inputFile, '-af', loudnessCorrectionFilter, tempNormalizedFile];

        // The ui and logStore parameters are removed from the call.
        await runFFmpeg(ffmpeg, args, null);

        // --- Strict Validation ---
        const dirList = await ffmpeg.listDir(workingDirectory);
        if (!dirList.some(f => f.name === `${baseName}_norm.wav`)) {
            throw new Error(`Output file "${tempNormalizedFile}" was not created.`);
        }

        return tempNormalizedFile;

    } catch (error) {
        console.error(`Error in Pass 2 (normalizeLoudness) for file ${inputFile}:`, error);
        throw error;
    }
}
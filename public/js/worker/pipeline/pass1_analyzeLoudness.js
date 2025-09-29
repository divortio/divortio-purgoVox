/**
 * @file Worker Pipeline: Pass 1 - Loudness Analysis.
 * This module performs the first pass of EBU R128 loudness analysis on an audio chunk.
 */

import { runFFmpeg } from '../../ffmpeg/run.js';
import { parseLoudness } from '../../log-parser.js';
import {
    TARGET_LOUDNESS_LUFS,
    TARGET_TRUE_PEAK_DBFS,
    TARGET_LOUDNESS_RANGE_LU,
    HIGH_PASS_FREQ_HZ,
    NOISE_FLOOR_DBFS
} from '../../../constants/config.js';

/**
 * @typedef {import('../../main/ffmpeg-pipeline.js').FFmpeg} FFmpeg
 * @typedef {import('../../log-parser.js').LoudnessData} LoudnessData
 */

/**
 * Executes the first pass of loudness analysis on an audio chunk.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The full path to the input audio chunk in the virtual filesystem.
 * @param {string} channelLayout - The channel layout of the audio ('mono' or 'stereo').
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<LoudnessData>} A promise that resolves with the parsed loudness data.
 * @throws {Error} If the FFmpeg command fails or if the loudness data cannot be parsed.
 */
export async function analyzeLoudness(ffmpeg, inputFile, channelLayout, logStore) {
    console.log(`Pass 1: Analyzing loudness for ${inputFile}`);
    try {
        logStore.clear();
        const initialFilters = `aformat=channel_layouts=${channelLayout},highpass=f=${HIGH_PASS_FREQ_HZ},afftdn=nf=${NOISE_FLOOR_DBFS},deesser`;
        const loudnessAnalysisFilter = `${initialFilters},loudnorm=I=${TARGET_LOUDNESS_LUFS}:TP=${TARGET_TRUE_PEAK_DBFS}:LRA=${TARGET_LOUDNESS_RANGE_LU}:print_format=json`;

        const args = ['-i', inputFile, '-af', loudnessAnalysisFilter, '-f', 'null', '-'];

        await runFFmpeg(ffmpeg, args, null, logStore);

        const loudnessData = parseLoudness(logStore.get());
        return loudnessData;

    } catch (error) {
        console.error(`Error in Pass 1 (analyzeLoudness) for file ${inputFile}:`, error);
        throw error; // Re-throw the error to be caught by the worker orchestrator
    }
}
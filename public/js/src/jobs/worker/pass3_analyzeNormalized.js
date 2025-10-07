/**
 * @file Worker Pipeline: Pass 3 - Mastering Analysis (RMS).
 * This module analyzes the normalized audio chunk to determine its RMS level, which
 * is used to dynamically set parameters in the final mastering pass.
 * This version is updated to use the refactored runFFmpeg utility.
 *
 * @version 2.0.0
 */

import { runFFmpeg } from '../../ffmpeg/run.js';
import {parseLoudness} from '../../ffmpeg/parse/loudness.js';
import {parseRmsLevel} from '../../ffmpeg/parse/rmsLevel.js';

/**
 * @typedef {import('../../../main.js').FFmpeg} FFmpeg
 */

/**
 * Executes the third pass of the mastering chain: RMS level analysis.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} normalizedFile - The full path to the temporary normalized audio file from Pass 2.
 * @param {object} logStore - The log store for capturing FFmpeg logs for parsing.
 * @returns {Promise<number>} A promise that resolves with the measured RMS level in dB.
 * @throws {Error} If the FFmpeg command fails or if the RMS level cannot be parsed.
 */
export async function analyzeNormalized(ffmpeg, normalizedFile, logStore) {
    console.log(`Pass 3: Analyzing RMS for ${normalizedFile}`);

    const pathParts = normalizedFile.split('/');
    const workingDirectory = pathParts.slice(0, -1).join('/');
    const baseName = pathParts.pop().split('_norm.')[0]; // Get original base name
    const rmsLogFile = `${workingDirectory}/${baseName}_rms.txt`;
    const rmsLogName = `${baseName}_rms.txt`;

    try {
        logStore.clear();
        const rmsAnalysisFilter = `astats=metadata=1,ametadata=mode=print:file=${rmsLogFile}`;
        const args = ['-i', normalizedFile, '-af', rmsAnalysisFilter, '-f', 'null', '-'];

        // The ui parameter is null as workers don't access the UI.
        await runFFmpeg(ffmpeg, args, null);

        // --- Strict Validation ---
        const dirList = await ffmpeg.listDir(workingDirectory);
        if (!dirList.some(f => f.name === rmsLogName)) {
            throw new Error(`RMS analysis output file "${rmsLogFile}" was not created.`);
        }

        const rmsFileContent = new TextDecoder().decode(await ffmpeg.readFile(rmsLogFile));
        const rmsLevel = parseRmsLevel(rmsFileContent);

        if (isNaN(rmsLevel)) {
            throw new Error(`Failed to parse a valid RMS level for chunk ${normalizedFile}.`);
        }

        return rmsLevel;

    } catch (error) {
        console.error(`Error in Pass 3 (analyzeNormalized) for file ${normalizedFile}:`, error);
        throw error;
    } finally {
        // --- Cleanup ---
        // Ensure the temporary log file is deleted even if parsing fails.
        try {
            await ffmpeg.deleteFile(rmsLogFile);
        } catch(e) { /* ignore */ }
    }
}
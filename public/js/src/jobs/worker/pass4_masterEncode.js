/**
 * @file Worker Pipeline: Pass 4 - Final Mastering and Encoding.
 * This module applies the final dynamic mastering chain and encodes the chunk to MP3.
 * It is also responsible for cleaning up the temporary file from Pass 2.
 * This version is updated to use the refactored runFFmpeg utility.
 *
 * @version 2.1.0
 */

import { runFFmpeg } from '../../ffmpeg/run.js';
import { OUTPUT_FORMAT, OUTPUT_QUALITY } from '../../../config.js';

/**
 * --- CORRECTION ---
 * The paths for these typedefs have been corrected.
 */
/**
 * @typedef {import('../../../main.js').FFmpeg} FFmpeg
 * @typedef {import('../main/step3-process-chunks.js').MasteringOptions} MasteringOptions
 */

/**
 * Executes the final pass of the mastering chain and encodes the output file.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} normalizedFile - The full path to the temporary normalized audio file from Pass 2.
 * @param {number} rmsLevel - The RMS level calculated in Pass 3.
 * @param {MasteringOptions} options - The user-selected mastering options.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} A promise that resolves with the full path of the final mastered MP3 file.
 * @throws {Error} If the FFmpeg command fails or the output file is not created.
 */
export async function masterEncode(ffmpeg, normalizedFile, rmsLevel, options, logStore) {
    console.log(`Pass 4: Mastering and encoding for ${normalizedFile}`);

    const pathParts = normalizedFile.split('/');
    const workingDirectory = pathParts.slice(0, -1).join('/');
    const baseName = pathParts.pop().split('_norm.')[0];
    const finalOutputFile = `${workingDirectory}/${baseName}_mastered.${OUTPUT_FORMAT}`;
    const finalOutputName = `${baseName}_mastered.${OUTPUT_FORMAT}`;

    try {
        logStore.clear();
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
        const args = ['-i', normalizedFile, '-af', finalFilterString, ...OUTPUT_QUALITY.split(' '), finalOutputFile];

        await runFFmpeg(ffmpeg, args, null);

        // --- Strict Validation ---
        const dirList = await ffmpeg.listDir(workingDirectory);
        if (!dirList.some(f => f.name === finalOutputName)) {
            throw new Error(`Output file "${finalOutputFile}" was not created.`);
        }

        return finalOutputFile;

    } catch (error) {
        console.error(`Error in Pass 4 (masterEncode) for file ${normalizedFile}:`, error);
        throw error;
    } finally {
        // --- Cleanup ---
        try {
            await ffmpeg.deleteFile(normalizedFile);
        } catch(e) { /* ignore */ }
    }
}
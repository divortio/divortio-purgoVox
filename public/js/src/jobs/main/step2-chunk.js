/**
 * @file Pipeline Step 2: Splits the input audio into large WAV chunks.
 * This version is updated to use the refactored runFFmpeg utility.
 *
 * @version 2.0.0
 */

import {runFFmpeg} from '../../ffmpeg/run.js';
import {CHUNK_DURATION} from '../../../config.js';

/**
 * @typedef {import('../../ui/ui.js').UI} UI
 * @typedef {import('../../../main.js').FFmpeg} FFmpeg
 */

/**
 * Splits the sanitized audio file into large WAV chunks for processing.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The name of the sanitized input file in the virtual filesystem.
 * @param {string} workingDirectory - The directory in the virtual FS to write output files to.
 * @param {UI} updateUI - The UI instance for updating the command display.
 * @returns {Promise<string[]>} A sorted list of the full paths to the created chunk filenames.
 */
export async function chunk(ffmpeg, inputFile, workingDirectory, updateUI) {
    const outputPattern = `${workingDirectory}/chunk_%04d.wav`;

    const chunkingArgs = [
        '-i', inputFile,
        '-f', 'segment',
        '-segment_time', String(CHUNK_DURATION),
        '-c:a', 'pcm_s16le',
        outputPattern
    ];

    // The logStore parameter is removed.
    await runFFmpeg(ffmpeg, chunkingArgs, updateUI);

    const dirList = await ffmpeg.listDir(workingDirectory);
    const chunkFiles = dirList
        .filter(f => f.name.startsWith('chunk_') && f.name.endsWith('.wav'))
        .map(f => `${workingDirectory}/${f.name}`)
        .sort();

    if (chunkFiles.length === 0) {
        throw new Error("Step 2 Failed: Audio file could not be chunked.");
    }

    return chunkFiles;
}
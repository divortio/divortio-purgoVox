/**
 * @file Pipeline Step 0: Sanitizes the input file by extracting only the audio stream into a clean WAV file.
 * This version is updated to use the refactored runFFmpeg utility.
 *
 * @version 2.0.0
 */

import {runFFmpeg} from '../../ffmpeg/run.js';

/**
 * @typedef {import('../../ui/ui.js').UI} UI
 * @typedef {import('../../../main.js').FFmpeg} FFmpeg
 */

/**
 * Creates a clean, audio-only WAV file from the input.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The path to the original input file in the virtual filesystem.
 * @param {string} workingDirectory - The directory in the virtual FS to write output files to (e.g., '/work').
 * @param {UI} updateUI - The UI instance for updating the command display.
 * @returns {Promise<string>} The full path of the sanitized audio file.
 */
export async function sanitize(ffmpeg, inputFile, workingDirectory, updateUI) {
    const sanitizedOutputName = 'sanitized_audio.wav';
    const sanitizedOutputFile = `${workingDirectory}/${sanitizedOutputName}`;

    const args = [
        '-hide_banner',
        '-i', inputFile,
        '-map', '0:a:0',
        '-c:a', 'pcm_s16le',
        sanitizedOutputFile
    ];

    // The logStore parameter is removed, as logging is now handled by a global listener.
    await runFFmpeg(ffmpeg, args, updateUI);

    const dirList = await ffmpeg.listDir(workingDirectory);
    if (!dirList.some(f => f.name === sanitizedOutputName)) {
        throw new Error(`Step 0 Failed: Sanitization did not produce the expected audio file in ${workingDirectory}.`);
    }

    return sanitizedOutputFile;
}
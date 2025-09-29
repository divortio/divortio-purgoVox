/**
 * @file Pipeline Step 0: Sanitizes the input file by extracting only the audio stream into a clean WAV file.
 */

import {runFFmpeg} from '../../ffmpeg/run.js';

/**
 * Creates a clean, audio-only WAV file from the input.
 *
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The path to the original input file in the virtual filesystem.
 * @param {string} workingDirectory - The directory in the virtual FS to write output files to (e.g., '/work').
 * @param {function} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} The full path of the sanitized audio file.
 */
export async function sanitize(ffmpeg, inputFile, workingDirectory, updateUI, logStore) {
    logStore.clear();
    const sanitizedOutputName = 'sanitized_audio.wav';
    const sanitizedOutputFile = `${workingDirectory}/${sanitizedOutputName}`;

    const args = [
        '-hide_banner',
        '-i', inputFile,
        '-map', '0:a:0',
        '-c:a', 'pcm_s16le',
        sanitizedOutputFile
    ];

    await runFFmpeg(ffmpeg, args, updateUI, logStore);

    const dirList = await ffmpeg.listDir(workingDirectory);
    if (!dirList.some(f => f.name === sanitizedOutputName)) {
        throw new Error(`Step 0 Failed: Sanitization did not produce the expected audio file in ${workingDirectory}.`);
    }

    return sanitizedOutputFile;
}
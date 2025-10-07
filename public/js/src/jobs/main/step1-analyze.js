/**
 * @file Pipeline Step 1: Analyzes the input audio file to determine its duration and channel layout.
 * This version is updated to work with the centralized LogStore.
 *
 * @version 2.0.0
 */

import {runFFmpeg} from '../../ffmpeg/run.js';

/**
 * @typedef {import('../../ui/ui.js').UI} UI
 * @typedef {import('../../../main.js').FFmpeg} FFmpeg
 * @typedef {import('../../ffmpeg/logStore.js').LogStore} LogStore
 */

/**
 * @typedef {object} AnalysisResult
 * @property {number} duration - The duration of the audio in seconds.
 * @property {string} channelLayout - The layout string ('mono' or 'stereo').
 */

/**
 * Analyzes the audio file to get its properties.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string} inputFile - The path to the input file in the virtual filesystem.
 * @param {UI} updateUI - The UI instance for updating the command display.
 * @param {LogStore} logStore - The central log store for capturing FFmpeg logs.
 * @returns {Promise<AnalysisResult>} The duration and channel information of the audio.
 * @throws {Error} If properties cannot be determined.
 */
export async function analyze(ffmpeg, inputFile, updateUI, logStore) {
    // Clear the central log store before running the analysis command.
    logStore.clear();

    // Run a minimal command to force FFmpeg to print stream info to the log.
    const args = ['-hide_banner', '-i', inputFile, '-f', 'null', '-'];
    await runFFmpeg(ffmpeg, args, updateUI);

    // Get the log output that was just generated.
    const logText = logStore.get();

    const durationMatch = logText.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!durationMatch) {
        throw new Error("Step 1 Failed: Could not determine audio duration.");
    }
    const [, hours, minutes, seconds, centiseconds] = durationMatch;
    const duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;

    // This regex is designed to find the channel layout from the main audio stream info.
    const streamMatch = logText.match(/Stream #\d+:\d+.*: Audio: .*?, (stereo|mono),/);
    if (!streamMatch || !streamMatch[1]) {
        throw new Error("Step 1 Failed: Could not determine audio channel layout (mono/stereo) from the FFmpeg log.");
    }
    const channelLayout = streamMatch[1];

    return {duration, channelLayout};
}
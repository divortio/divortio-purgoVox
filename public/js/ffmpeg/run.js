/**
 * @file A centralized and robust helper for executing FFmpeg commands.
 * This module ensures that all FFmpeg errors are caught and reported with rich context.
 */

/**
 * Executes an FFmpeg command with robust error handling.
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} args - An array of arguments for the FFmpeg command.
 * @param {object} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<void>}
 * @throws {Error} Throws a detailed error if the command fails.
 */
export async function runFFmpeg(ffmpeg, args, updateUI, logStore) {
    const commandString = `ffmpeg ${args.join(' ')}`;
    if (updateUI) {
        updateUI({command: commandString});
    }
    console.log("Executing FFmpeg command:", commandString);

    try {
        await ffmpeg.exec(...args);
    } catch (error) {

        // Create a much more detailed error message for better debugging.
        const detailedError = new Error(
            `FFmpeg command failed: ${error.message}\n\n` +
            `Failed Command:\n${commandString}\n\n` +
            `Full Log:\n${logStore.get()}`
        );
        detailedError.name = 'FFmpegExecutionError';
        throw detailedError;

    }
}
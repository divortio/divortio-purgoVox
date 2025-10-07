/**
 * @file A centralized and robust helper for executing FFmpeg commands.
 * This refactored version updates the UI with the command being run and
 * relies on a global listener for log capturing.
 *
 * @version 2.0.0
 */

/**
 * Provides type hints for the UI and FFmpeg classes.
 * @typedef {import('../ui/ui.js').UI} UI
 * @typedef {import('../../main.js').FFmpeg} FFmpeg
 */

/**
 * Executes an FFmpeg command with robust error handling.
 *
 * @param {FFmpeg} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} args - An array of arguments for the FFmpeg command.
 * @param {UI | null} ui - The main UI instance, used to display the command. Can be null if no UI update is needed.
 * @returns {Promise<void>}
 * @throws {Error} Throws a detailed error if the command fails. The full log will be available in the main console UI.
 */
export async function runFFmpeg(ffmpeg, args, ui) {
    const commandString = `ffmpeg ${args.join(' ')}`;

    if (ui) {
        // Update the UI to show the command that is about to be executed.
        ui.update({ command: commandString });
    }
    console.log("Executing FFmpeg command:", commandString);

    try {
        await ffmpeg.exec(...args);
    } catch (error) {
        // Create a more detailed error message for better debugging.
        // The full log will be visible in the UI via the global LogStore.
        const detailedError = new Error(
            `FFmpeg command failed: ${error.message}\n\n` +
            `Failed Command:\n${commandString}`
        );
        detailedError.name = 'FFmpegExecutionError';
        throw detailedError;
    }
}
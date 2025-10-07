/**
 * @file A centralized store for managing and displaying FFmpeg logs.
 * This class ensures that all log messages from any FFmpeg process are
 * captured in one place and immediately relayed to the UI.
 *
 * @version 1.0.0
 */

/**
 * Provides type hints for the UI class.
 * @typedef {import('../ui/ui.js').UI} UI
 */

export class LogStore {
    /**
     * Creates an instance of LogStore.
     */
    constructor() {
        /**
         * The UI instance to which logs will be pushed.
         * @private
         * @type {UI | null}
         */
        this.ui = null;

        /**
         * An array holding all log messages for the current session.
         * @private
         * @type {string[]}
         */
        this.logs = [];
    }

    /**
     * Registers the main UI instance with the log store.
     * This is necessary for the store to push real-time log updates to the DOM.
     * @param {UI} ui - The application's main UI instance.
     */
    registerUI(ui) {
        this.ui = ui;
    }

    /**
     * Appends a new message to the log store and updates the UI.
     * @param {string} message - The log message from FFmpeg.
     */
    append(message) {
        this.logs.push(message);
        if (this.ui) {
            // Push the individual log line to the UI for real-time updates.
            this.ui.update({ logs: message + '\n' });
        }
    }

    /**
     * Retrieves the entire log history as a single string.
     * Useful for populating static UI elements like version and filter info.
     * @returns {string} The complete log history.
     */
    get() {
        return this.logs.join('\n');
    }

    /**
     * Clears all messages from the log store. This does not clear the UI;
     * it's intended to be used before running a new command whose output
     * you want to capture in isolation with get().
     */
    clear() {
        this.logs = [];
    }
}
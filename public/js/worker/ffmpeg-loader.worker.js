/**
 * @file This module is responsible for loading and initializing the FFmpeg.wasm core engine
 * inside a "classic" Web Worker.
 */

// Use an absolute path from the public root, as classic workers resolve paths differently.
const CORE_PATH = '/vendor/ffmpeg-core-mt.js';

let ffmpeg = null;

/**
 * A simple proxy class to make the low-level FFmpeg Module API compatible
 * with the higher-level API our pipeline expects.
 * @private
 */
class FFmpegProxy {
    constructor(core) {
        this.core = core;
        this.logCallback = null;
        // The low-level API uses `setLogger`, which we can adapt to our `on('log', ...)` pattern.
        this.core.setLogger((log) => {
            if (this.logCallback) {
                this.logCallback({ message: log.message });
            }
        });
    }

    on(event, callback) {
        if (event === 'log') {
            this.logCallback = callback;
        }
    }

    async exec(...args) {
        this.core.exec(...args);
    }

    async writeFile(path, data) {
        this.core.FS.writeFile(path, data);
    }

    async readFile(path) {
        return this.core.FS.readFile(path);
    }

    async deleteFile(path) {
        this.core.FS.unlink(path);
    }

    async createDir(path) {
        this.core.FS.mkdir(path);
    }
}


/**
 * Initializes and loads an FFmpeg instance within the worker by directly
 * loading the core engine using importScripts.
 * @returns {Promise<FFmpegProxy>} A promise that resolves to the initialized FFmpeg proxy.
 */
export async function initialize() {
    if (ffmpeg) return ffmpeg;

    // Load the core FFmpeg script using the classic worker method.
    self.importScripts(CORE_PATH);

    const core = await self.createFFmpegCore();
    ffmpeg = new FFmpegProxy(core);
    return ffmpeg;
}
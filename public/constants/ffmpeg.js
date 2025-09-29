
// --- FFmpeg CDN Configuration ---
/** @constant {string} The version of the FFmpeg core library to use. */
export const CORE_VERSION = "0.12.10";
/** @constant {string} The version of the FFmpeg application library to use. */
export const FFMPEG_VERSION = "0.12.15";

// no trailing slash
export const FFMPEG_LOCAL_PATH = "../vendor";

/**
 * @constant {string[]} A list of all FFmpeg filters used in the mastering pipeline.
 */
export const FFMPEG_FILTERS_USED = [
    'aformat',
    'highpass',
    'afftdn',
    'deesser',
    'loudnorm',
    'astats',
    'ametadata',
    'adynamicequalizer',
    'alimiter',
    'agate',
    'equalizer',
    'asoftclip'
];
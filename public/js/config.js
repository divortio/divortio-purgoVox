/**
 * @file Central configuration for the MutterToButter audio processing pipeline.
 * This file contains all the tunable parameters for FFmpeg commands and pipeline behavior.
 * This version is updated to use modern ESM paths for the multi-threaded core.
 *
 * @version 2.0.0
 */


export const FFMPEG_URL = `/js/vendor/@ffmpeg/ffmpeg/dist/esm/index.js`;
export const CORE_URL = `/js/vendor/@ffmpeg/core-mt/dist/esm/ffmpeg-core.js`;
export const WASM_URL = `/js/vendor/@ffmpeg/core-mt/dist/esm/ffmpeg-core.wasm`;
export const WORKER_URL = `/js/vendor/@ffmpeg/core-mt/dist/esm/ffmpeg-core.worker.js`;

export const ABS_FFMPEG_URL = new URL(FFMPEG_URL, import.meta.url).href;
export const ABS_CORE_URL = new URL(CORE_URL, import.meta.url).href;
export const ABS_WASM_URL = new URL(WASM_URL, import.meta.url).href;
export const ABS_WORKER_URL = new URL(WORKER_URL, import.meta.url).href;

// --- Pipeline Configuration ---
/**
 * @constant {number} The duration of each audio chunk in seconds.
 */
export const CHUNK_DURATION = 300;
/**
 * @constant {string} The audio format/codec for the final output chunks.
 */
export const OUTPUT_FORMAT = "mp3";
/**
 * @constant {string} The default quality setting for the MP3 encoder.
 * '5' = High quality, '9' = Low quality.
 */
export const OUTPUT_QUALITY = "-q:a 9";


// --- Audio Mastering Parameters ---

// 1. Loudness Normalization (EBU R 128)
/** @constant {number} Integrated Loudness Target in LUFS. */
export const TARGET_LOUDNESS_LUFS = -14;
/** @constant {number} Maximum True Peak in dBFS. */
export const TARGET_TRUE_PEAK_DBFS = -1.0;
/** @constant {number} Loudness Range Target in LU. */
export const TARGET_LOUDNESS_RANGE_LU = 11;

// 2. Core Cleanup Filters
/** @constant {number} Frequency for the high-pass filter to remove rumble (in Hz). */
export const HIGH_PASS_FREQ_HZ = 80;
/** @constant {number} Noise floor for the spectral noise reduction filter (afftdn) (in dBFS). */
export const NOISE_FLOOR_DBFS = -25;
/**
 * @typedef {object} VersionObject
 * @property {number | null} version - The primary FFmpeg version number parsed as a decimal (e.g., 8.0).
 * @property {string | null} compiler - The full string describing the compiler used (e.g., 'Apple clang version 14.0.0 (clang-1400.0.29.202)').
 */

// Regex to capture the version number string from the first line
// Captures digits and dots after "ffmpeg version "
const VERSION_STRING_REGEX = /ffmpeg version (\d+\.\d+)/;

// Regex to capture the compiler details from the second line
// Captures everything after "built with " up to the end of the line
const COMPILER_REGEX = /built with\s+(.*)/;

/**
 * Parses the raw string output of 'ffmpeg -hide_banner -version' to extract
 * the primary version number as a decimal and the compiler details.
 * * @param {string} versionOutput - The full, multi-line string output from the 'ffmpeg -version' command.
 * @returns {VersionObject} A structured object containing the version and compiler.
 */
export function parseFFmpegVersion(versionOutput) {
    const lines = versionOutput.trim().split('\n');

    /** @type {VersionObject} */
    const result = {
        version: null,
        compiler: null
    };

    // --- 1. Process the first line for the version number ---
    if (lines.length > 0) {
        const versionMatch = lines[0].match(VERSION_STRING_REGEX);
        if (versionMatch && versionMatch[1]) {
            const versionString = versionMatch[1].trim();
            const versionDecimal = parseFloat(versionString);

            // Assign the decimal value if it's a valid number, otherwise keep null
            if (!isNaN(versionDecimal)) {
                result.version = versionDecimal; // Expected: 8.0
            }
        }
    }

    // --- 2. Process the second line for the compiler details ---
    if (lines.length > 1) {
        const compilerMatch = lines[1].match(COMPILER_REGEX);
        // The regex captures everything after "built with "
        if (compilerMatch && compilerMatch[1]) {
            result.compiler = compilerMatch[1].trim(); // Expected: 'Apple clang version 14.0.0 (clang-1400.0.29.202)'
        }
    }

    return result;
}
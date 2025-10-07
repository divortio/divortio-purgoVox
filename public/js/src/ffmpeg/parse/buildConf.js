/**
 * @typedef {object} FlagObject
 * @property {string[]} enabled - Array of fully qualified enabled features (e.g., '--enable-shared').
 * @property {string[]} disabled - Array of fully qualified disabled features (e.g., '--disable-htmlpages').
 */

/**
 * @typedef {object} BuildConfObject
 * @property {string | null} prefix - The installation prefix path.
 * @property {string | null} cc - The C compiler used (e.g., 'clang').
 * @property {string | null} hostCFlags - The host C compiler flags.
 * @property {string | null} hostLDFlags - The host linker flags.
 * @property {FlagObject} flags - Object containing arrays of enabled and disabled build features.
 */

// Precompile regex to capture configuration lines
// Captures a flag/option (--key=value or --key) and its associated value if present
const CONF_LINE_REGEX = /(--[a-zA-Z0-9_-]+)(?:=(.*))?/;

/**
 * Parses the raw string output of 'ffmpeg -hide_banner -buildconf' into a structured object.
 * This function extracts core variables and lists all enabled and disabled features.
 * * @param {string} confOutput - The full, multi-line string output from the 'ffmpeg -buildconf' command.
 * @returns {BuildConfObject} A structured configuration object.
 */
export function parseFFmpegBuildConf(confOutput) {
    const lines = confOutput.trim().split('\n');

    /** @type {BuildConfObject} */
    const result = {
        prefix: null,
        cc: null,
        hostCFlags: null,
        hostLDFlags: null,
        flags: {
            enabled: [],
            disabled: []
        }
    };

    // Use a standard for loop for iteration performance
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i].trim();
        // Skip metadata lines like "configuration:"
        if (rawLine.startsWith('[') || rawLine.startsWith('Exiting')) continue;

        const match = rawLine.match(CONF_LINE_REGEX);

        if (match) {
            const flag = match[1]; // e.g., '--prefix', '--enable-shared'
            const value = match[2] ? match[2].trim() : ''; // e.g., '/usr/local/Cellar/ffmpeg/8.0'

            if (flag.startsWith('--enable-')) {
                // Feature is enabled (e.g., --enable-gpl)
                result.flags.enabled.push(flag);
            } else if (flag.startsWith('--disable-')) {
                // Feature is disabled (e.g., --disable-htmlpages)
                result.flags.disabled.push(flag);
            } else {
                // Core variables (prefix, cc, host-cflags, etc.)
                switch (flag) {
                    case '--prefix':
                        result.prefix = value;
                        break;
                    case '--cc':
                        result.cc = value;
                        break;
                    case '--host-cflags':
                        // Store the full flag and value as the C code uses it, but also clean the value
                        result.hostCFlags = value || '';
                        break;
                    case '--host-ldflags':
                        // Store the full flag and value as the C code uses it, but also clean the value
                        result.hostLDFlags = value || '';
                        break;
                    // Note: If you want to include all other non-enable/disable flags,
                    // you would add them to a separate "options" array here.
                }
            }
        }
    }

    return result;
}
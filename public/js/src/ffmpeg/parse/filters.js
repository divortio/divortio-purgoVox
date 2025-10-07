/**
 * @file parseFFmpegFilters.js
 * @typedef {object} FFmpegFilter
 * @property {string} name - The unique name of the FFmpeg filter (e.g., 'acopy', 'ebur128').
 * @property {string} description - A short, explanatory description of the filter's function.
 * @property {'Audio'|'Video'|'Source'|'Sink'|'General/Mixed'|'Mixed I/O'} type - The primary category of the filter.
 * @property {'Audio'|'Video'|'Dynamic'|'Source'|'Sink'|'Unknown'} input - The type of stream(s) the filter consumes.
 * @property {'Audio'|'Video'|'Dynamic'|'Sink'|'Unknown'} output - The type of stream(s) the filter produces.
 * @property {number} numInputs - The number of input stream ports (1 or more).
 * @property {number} numOutputs - The number of output stream ports (1 or more).
 * @property {object} flags - Boolean flags indicating special filter properties.
 * @property {boolean} flags.timeline - True if the filter supports Timeline editing (T..).
 * @property {boolean} flags.sliceThreading - True if the filter supports Slice Threading (.S.).
 * @property {boolean} flags.audio - True if the filter handles audio streams.
 * @property {boolean} flags.video - True if the filter handles video streams.
 * @property {boolean} flags.dynamic - True if the filter supports a dynamic number or type of I/O streams (N).
 * @property {boolean} flags.isSource - True if the filter acts as a source (input is '|').
 * @property {boolean} flags.isSink - True if the filter acts as a sink (output is '|').
 */

// Precompile the regular expression outside the function for maximum speed.
const FILTER_LINE_REGEX = /^(?:\\s*)?([T\.\s][S\.\s][\.\s]\s*)([a-zA-Z0-9_]+)\s+([A-Z]*[\|]?[A-Z]*->[A-Z]*[\|]?)\s+(.*)$/;
const START_OF_DATA_REGEX = /^[T\.][S\.]|^\s*[\.][\s]/; // Used for skipping the header

/**
 * Helper function to determine the primary stream type from the raw I/O string.
 * @param {string} str - The raw I/O signature string (e.g., 'AA', 'V', '|').
 * @returns {'Audio'|'Video'|'Dynamic'|'Marker'|'Unknown'}
 */
const getStreamType = (str) => {
    if (str === '|') return 'Marker';
    if (str.includes('N')) return 'Dynamic';
    if (str.includes('V')) return 'Video';
    if (str.includes('A')) return 'Audio';
    return 'Unknown';
};

/**
 * Helper function to determine the number of streams from the raw I/O string.
 * @param {string} str - The raw I/O signature string.
 * @returns {number}
 */
const getNumStreams = (str) => {
    // N and | are counted as 1 port/stream
    if (str.includes('N') || str.includes('|')) return 1;
    // Otherwise, the number of characters equals the number of streams
    return str.length;
};


/**
 * Parses the raw string output of 'ffmpeg -hide_banner -filters' into a structured array
 * of FFmpegFilter objects.
 * This function is optimized for speed by pre-compiling regex and minimizing internal function calls.
 * @param {string} filterOutput - The full, multi-line string output from the 'ffmpeg -filters' command.
 * @returns {Array<FFmpegFilter>} An array of structured filter objects.
 */
export function parseFFmpegFilters(filterOutput) {
    // Use String.split() only once to create the array of lines
    const lines = filterOutput.trim().split('\n');
    const filters = [];
    let dataStarted = false;

    // Use a standard for loop for fastest iteration performance
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Skip the header section
        if (!dataStarted) {
            if (line.match(START_OF_DATA_REGEX)) {
                dataStarted = true;
            } else {
                continue;
            }
        }

        // 2. Attempt to match the filter line pattern
        const match = line.match(FILTER_LINE_REGEX);

        if (match) {
            // Destructure the captured groups for clarity
            const [, flagsStr, name, signature, description] = match;
            const [inputStr, outputStr] = signature.split('->');

            // --- Determine I/O Properties ---
            const numInputs = getNumStreams(inputStr);
            const numOutputs = getNumStreams(outputStr);

            const isSource = inputStr.includes('|');
            const isSink = outputStr.includes('|');

            // --- Determine Verbose Input/Output Names ---
            let inputName = getStreamType(inputStr);
            let outputName = getStreamType(outputStr);

            if (isSource) inputName = 'Source';
            if (isSink) outputName = 'Sink';
            // Final type resolution for 'Marker'
            if (inputName === 'Marker') inputName = 'Unknown';
            if (outputName === 'Marker') outputName = 'Unknown';

            // --- Determine Filter Category ---
            let filterType;
            if (isSource || isSink) {
                filterType = isSource && isSink ? 'Mixed I/O' : (isSource ? 'Source' : 'Sink');
            } else if (inputStr.includes('V') || outputStr.includes('V')) {
                filterType = 'Video';
            } else if (inputStr.includes('A') || outputStr.includes('A')) {
                filterType = 'Audio';
            } else {
                filterType = 'General/Mixed';
            }

            /** @type {FFmpegFilter} */
            const filterObject = {
                name: name.trim(),
                description: description.trim(),
                type: filterType,

                input: inputName,
                output: outputName,
                numInputs: numInputs,
                numOutputs: numOutputs,

                flags: {
                    timeline: flagsStr.includes('T'),
                    sliceThreading: flagsStr.includes('S'),
                    audio: inputStr.includes('A') || outputStr.includes('A'),
                    video: inputStr.includes('V') || outputStr.includes('V'),
                    dynamic: inputStr.includes('N') || outputStr.includes('N'),
                    isSource: isSource,
                    isSink: isSink
                }
            };

            filters.push(filterObject);
        }
    }

    return filters;
}
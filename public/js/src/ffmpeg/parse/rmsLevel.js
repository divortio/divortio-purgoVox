
/**
 * Parses the ametadata file content to find the RMS level.
 * @param {string} fileContent - The string content of the ametadata output file.
 * @returns {number} The measured RMS level in dB.
 * @throws {Error} If the RMS level cannot be found.
 */
export function parseRmsLevel(fileContent) {
    // This is the user-provided, correct regex.
    const rmsRegex = /Overall\.RMS_level=(.+)/;
    const match = fileContent.match(rmsRegex);

    if (match && match[1]) {
        // This correctly handles parsing '-inf' by defaulting to 0.00
        return parseFloat(match[1]) || 0.00;
    }
    throw new Error("Log Parser Failed: Could not find Overall.RMS_level in the analysis file.");
}
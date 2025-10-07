
/**
 * @typedef {object} LoudnessData
 * @property {string} measured_I - The measured integrated loudness.
 * @property {string} measured_TP - The measured true peak.
 * @property {string} measured_LRA - The measured loudness range.
 * @property {string} measured_thresh - The measured threshold.
 * @property {string} target_offset - The calculated target offset.
 */

/**
 * Parses the FFmpeg log output to find and extract the JSON block generated
 * by the `loudnorm` filter's first pass.
 */
export function parseLoudness(logText) {
    const jsonStart = logText.lastIndexOf('{');
    const jsonEnd = logText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error("Log Parser Failed: Could not find the loudnorm JSON block in the FFmpeg logs.");
    }

    const jsonString = logText.substring(jsonStart, jsonEnd + 1);

    try {
        const parsed = JSON.parse(jsonString);
        return {
            measured_I: parsed.input_i,
            measured_TP: parsed.input_tp,
            measured_LRA: parsed.input_lra,
            measured_thresh: parsed.input_thresh,
            target_offset: parsed.target_offset,
        };
    } catch (e) {
        throw new Error(`Log Parser Failed: Could not parse the loudnorm JSON data. Details: ${e.message}`);
    }
}

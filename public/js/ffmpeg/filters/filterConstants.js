/**
 * @file This file contains a centralized metadata object for all FFmpeg filters
 * used in the MutterToButter audio mastering pipeline. This serves as a single
 * source of truth for filter descriptions, parameters, their types, and default values.
 */

/**
 * @typedef {object} FilterParameter
 * @property {string} type - The expected JavaScript data type ('number', 'integer', 'string', 'boolean').
 * @property {string} description - A brief explanation of what the parameter does.
 * @property {any} defaultValue - The default value for the parameter according to FFmpeg 5.1 docs.
 * @property {boolean} isUsed - Whether this parameter is currently used in our application's filter chain.
 */

/**
 * @typedef {object} FilterDefinition
 * @property {string} description - A high-level description of the FFmpeg filter.
 * @property {string} link - A URL to the official FFmpeg documentation for the filter.
 * @property {boolean} isUsed - Whether this filter is currently used in our application's filter chain.
 * @property {Object.<string, FilterParameter>} parameters - A map of the parameters for the filter.
 */

/**
 * A comprehensive object defining the FFmpeg filters used in the application.
 * @type {Object.<string, FilterDefinition>}
 */
export const FFMPEG_FILTERS = {
    aformat: {
        description: 'Sets the output audio format constraints.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#aformat',
        isUsed: true,
        parameters: {
            channel_layouts: { type: 'string', description: 'A string representing the channel layout (e.g., "stereo" or "mono").', defaultValue: '', isUsed: true }
        }
    },
    highpass: {
        description: 'Applies a high-pass filter to remove low-frequency rumble.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#highpass',
        isUsed: true,
        parameters: {
            f: { type: 'integer', description: 'The cutoff frequency in Hz.', defaultValue: 200, isUsed: true }
        }
    },
    afftdn: {
        description: 'Applies a noise reduction filter in the frequency domain.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#afftdn',
        isUsed: true,
        parameters: {
            nf: { type: 'number', description: 'The noise floor in dBFS.', defaultValue: -50, isUsed: true }
        }
    },
    deesser: {
        description: 'Applies a de-esser to reduce sibilance. Uses default settings.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#deesser',
        isUsed: true,
        parameters: {}
    },
    loudnorm: {
        description: 'Performs loudness normalization according to EBU R128.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#loudnorm',
        isUsed: true,
        parameters: {
            i: { type: 'number', description: 'Target integrated loudness in LUFS.', defaultValue: -24, isUsed: true },
            tp: { type: 'number', description: 'Maximum true peak in dBFS.', defaultValue: -2.0, isUsed: true },
            lra: { type: 'number', description: 'Target loudness range in LU.', defaultValue: 7.0, isUsed: true },
            print_format: { type: 'string', description: 'Output format for analysis data (e.g., "json" or "none").', defaultValue: 'none', isUsed: true },
            measured_i: { type: 'string', description: 'Measured integrated loudness from the first pass.', defaultValue: '', isUsed: true },
            measured_tp: { type: 'string', description: 'Measured true peak from the first pass.', defaultValue: '', isUsed: true },
            measured_lra: { type: 'string', description: 'Measured loudness range from the first pass.', defaultValue: '', isUsed: true },
            measured_thresh: { type: 'string', description: 'Measured threshold from the first pass.', defaultValue: '', isUsed: true },
            offset: { type: 'string', description: 'Calculated target offset from the first pass.', defaultValue: '', isUsed: true }
        }
    },
    astats: {
        description: 'Collects audio statistics.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#astats',
        isUsed: true,
        parameters: {
            metadata: { type: 'integer', description: 'Set to 1 to inject metadata into the frame.', defaultValue: 0, isUsed: true }
        }
    },
    ametadata: {
        description: 'Manipulates audio frame metadata.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#ametadata',
        isUsed: true,
        parameters: {
            mode: { type: 'string', description: 'The operating mode (e.g., "print").', defaultValue: 'select', isUsed: true },
            file: { type: 'string', description: 'The file to write metadata to.', defaultValue: '', isUsed: true }
        }
    },
    adynamicequalizer: {
        description: 'Applies a dynamic equalizer to the audio. Note: FFmpeg 5.1 uses different parameter names than later versions.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#adynamicequalizer',
        isUsed: true,
        parameters: {
            dfrequency: { type: 'number', description: 'Detection center frequency.', defaultValue: 1000, isUsed: true },
            dqfactor: { type: 'number', description: 'Detection Q-factor.', defaultValue: 1.0, isUsed: true },
            tfrequency: { type: 'number', description: 'Target center frequency.', defaultValue: 1000, isUsed: true },
            tqfactor: { type: 'number', description: 'Target Q-factor.', defaultValue: 1.0, isUsed: true },
            tftype: { type: 'string', description: 'Target filter type (e.g., "bell").', defaultValue: 'bell', isUsed: true },
            threshold: { type: 'number', description: 'The threshold for the dynamic action in dBFS.', defaultValue: 0, isUsed: true },
            attack: { type: 'number', description: 'The attack time in milliseconds.', defaultValue: 20, isUsed: true },
            release: { type: 'number', description: 'The release time in milliseconds.', defaultValue: 200, isUsed: true },
            knee: { type: 'number', description: 'The knee value in dB.', defaultValue: 0, isUsed: true },
            ratio: { type: 'number', description: 'The compression/expansion ratio.', defaultValue: 1, isUsed: true },
            makeup: { type: 'number', description: 'The makeup gain in dB.', defaultValue: 0, isUsed: true },
            range: { type: 'number', description: 'The maximum gain range in dB.', defaultValue: 10, isUsed: true },
            slew: { type: 'number', description: 'The slew rate in dB per second.', defaultValue: 1000, isUsed: true },
            mode: { type: 'string', description: 'The mode of operation (e.g., "boost" or "cut").', defaultValue: 'cut', isUsed: true }
        }
    },
    alimiter: {
        description: 'Applies a peak limiter to the audio.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#alimiter',
        isUsed: true,
        parameters: {
            limit: { type: 'number', description: 'The maximum allowed sample level (from 0.0 to 1.0).', defaultValue: 1.0, isUsed: true },
            level: { type: 'boolean', description: 'Set to false to operate on stereo channels independently.', defaultValue: true, isUsed: false }
        }
    },
    agate: {
        description: 'Applies a noise gate to the audio.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#agate',
        isUsed: true,
        parameters: {
            threshold: { type: 'number', description: 'The threshold for the gate in linear amplitude (0.0 to 1.0).', defaultValue: 0.125, isUsed: true },
            attack: { type: 'integer', description: 'The attack time in milliseconds.', defaultValue: 20, isUsed: false },
            release: { type: 'integer', description: 'The release time in milliseconds.', defaultValue: 250, isUsed: false }
        }
    },
    equalizer: {
        description: 'Applies a two-pole peaking equalizer.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#equalizer',
        isUsed: true,
        parameters: {
            f: { type: 'integer', description: 'The center frequency of the band in Hz.', defaultValue: 1000, isUsed: true },
            width_type: { type: 'string', description: 'The unit for the band width (e.g., "h" for Hz, "q" for Q-factor).', defaultValue: 'q', isUsed: true },
            w: { type: 'number', description: 'The width of the band.', defaultValue: 1.0, isUsed: true },
            g: { type: 'number', description: 'The gain or reduction in dB.', defaultValue: 0, isUsed: true }
        }
    },
    asoftclip: {
        description: 'Applies a soft-clipping effect to the audio.',
        link: 'https://ffmpeg.org/ffmpeg-filters.html#asoftclip',
        isUsed: true,
        parameters: {
            type: { type: 'string', description: 'The type of soft-clipping function (e.g., "atan", "tanh").', defaultValue: 'tanh', isUsed: true }
        }
    }
};
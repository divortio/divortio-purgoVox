/**
 * @file Pipeline Step 4: Concatenates individual mastered audio segments into a single MP3 file and injects metadata.
 */

import {runFFmpeg} from '../../ffmpeg/run.js';

/**
 * @typedef {import('./step3-process-chunks.js').MasteringOptions} MasteringOptions
 */

/**
 * Concatenates mastered audio segments into a single file and applies ID3 metadata.
 *
 * @param {object} ffmpeg - The initialized FFmpeg instance.
 * @param {string[]} processedFiles - A sorted list of the mastered audio segment filenames.
 * @param {object} metadata - An object containing the ID3 tags for the final file.
 * @param {string} workingDirectory - The directory in the virtual FS where files are located.
 * @param {function} updateUI - The UI update callback function.
 * @param {object} logStore - The log store for capturing FFmpeg logs.
 * @returns {Promise<string>} The filename of the final concatenated file.
 */
export async function concatenate(ffmpeg, processedFiles, metadata, workingDirectory, updateUI, logStore) {
    const concatListPath = `${workingDirectory}/concat_list.txt`;
    const outputFilename = `${workingDirectory}/final_mastered.mp3`;

    const concatList = processedFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile(concatListPath, concatList);

    const metadataArgs = [
        '-metadata', `title=${metadata.title}`,
        '-metadata', `artist=${metadata.artist}`,
        '-metadata', `album=${metadata.album}`,
        '-metadata', `date=${metadata.date}`,
        '-metadata', `comment=${metadata.comment}`,
        '-metadata', `genre=Podcast`,
        '-metadata', `album_artist=MutterToButter WASM`
    ];

    const concatArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        ...metadataArgs,
        outputFilename
    ];

    await runFFmpeg(ffmpeg, concatArgs, updateUI, logStore);

    const dirList = await ffmpeg.listDir(workingDirectory);
    if (!dirList.some(f => f.name === 'final_mastered.mp3')) {
        throw new Error("Step 4 Failed: Concatenation did not produce the expected output file.");
    }

    return outputFilename;
}
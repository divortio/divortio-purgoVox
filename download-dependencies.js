// download-dependencies.js

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

// --- Configuration ---
const FFMPEG_VERSION = "0.12.15";
const CORE_VERSION = "0.12.10";
const UTIL_VERSION = "0.12.1";

const VENDOR_DIR = path.join('public', 'vendor');
const UNPKG_BASE_URL = 'https://unpkg.com';

const packagesToProcess = [
    { pkg: '@ffmpeg/ffmpeg', version: FFMPEG_VERSION, path: 'dist/' },
    { pkg: '@ffmpeg/core', version: CORE_VERSION, path: 'dist/' },
    { pkg: '@ffmpeg/core-mt', version: CORE_VERSION, path: 'dist/' },
    { pkg: '@ffmpeg/util', version: UTIL_VERSION, path: 'dist/' }
];

// --- Helper Functions ---

/**
 * @typedef {object} FileMeta
 * @property {string} path - The full path of the file from the package root.
 * @property {number} size - The size of the file in bytes.
 */

/**
 * Fetches and validates the file listing from unpkg's ?meta API.
 * @param {string} pkg - The package name.
 * @param {string} version - The package version.
 * @param {string} dirPath - The directory path to scan.
 * @returns {Promise<FileMeta[]>} A promise resolving to an array of file metadata objects.
 */
async function getFilesFromMeta(pkg, version, dirPath) {
    const url = `${UNPKG_BASE_URL}/${pkg}@${version}/${dirPath}?meta`;
    let responseText = '';

    try {
        const response = await fetch(url);
        responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = JSON.parse(responseText);

        if (!data || !Array.isArray(data.files) || data.files.length === 0) {
            throw new Error('Metadata response is invalid or contains no files.');
        }

        // --- THE FIX ---
        // The API returns a flat list of all files in the directory.
        // We do not need to filter by `type`, as all items are files.
        return data.files.map(item => ({
            path: item.path.substring(1), // Remove leading '/'
            size: item.size
        }));
        // --- END FIX ---

    } catch (error) {
        console.error(`\n❌ FATAL: Error fetching or parsing metadata for package "${pkg}@${version}"`);
        console.error(`   URL: ${url}`);
        console.error(`   Reason: ${error.message}`);
        if (responseText) {
            console.error('\n--- RAW SERVER RESPONSE ---');
            console.error(responseText);
            console.error('--- END RESPONSE ---\n');
        }
        throw error;
    }
}

/**
 * Downloads a single file.
 * @param {string} url - The URL to download from.
 * @param {string} destPath - The local destination path.
 */
async function downloadFile(url, destPath) {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: Status ${response.status}`);
    }
    await pipeline(response.body, fs.createWriteStream(destPath));
}

// --- Main Execution ---

async function main() {
    console.log(`Ensuring vendor directory exists at: ${VENDOR_DIR}`);
    if (!fs.existsSync(VENDOR_DIR)) {
        fs.mkdirSync(VENDOR_DIR, { recursive: true });
    }

    const allDiscoveredFiles = [];

    // --- Phase 1: Discover and Download All Versioned Files ---
    console.log('\n--- Phase 1: Discovering and Downloading Versioned Files ---');
    try {
        for (const { pkg, version, path: dirPath } of packagesToProcess) {
            const files = await getFilesFromMeta(pkg, version, dirPath);
            console.log(`🔎 Found ${files.length} files for ${pkg}@${version}. Verifying local cache...`);

            const downloadPromises = files.map(async (file) => {
                const destPath = path.join(VENDOR_DIR, `${pkg}@${version}`, file.path);
                allDiscoveredFiles.push({ ...file, pkg, version }); // Add to list for subsequent phases

                if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== file.size) {
                    console.log(`- Queuing download for: ${path.relative(VENDOR_DIR, destPath)}`);
                    const url = `${UNPKG_BASE_URL}/${pkg}@${version}/${file.path}`;
                    await downloadFile(url, destPath);
                    console.log(`✅ Downloaded: ${path.relative(VENDOR_DIR, destPath)}`);
                }
            });
            await Promise.all(downloadPromises);
        }
    } catch (error) {
        console.error(`\n❌ A critical error occurred during Phase 1. The script cannot continue.`);
        process.exit(1);
    }

    console.log('\n✅ All versioned files are present and up-to-date.');

    // --- Phase 2: Sync Files to Version-Agnostic Directories ---
    console.log('\n--- Phase 2: Syncing to Version-Agnostic ("latest") Directories ---');
    let copyCount = 0;
    for (const { pkg, version, path: filePath, size } of allDiscoveredFiles) {
        const sourcePath = path.join(VENDOR_DIR, `${pkg}@${version}`, filePath);
        const destPath = path.join(VENDOR_DIR, pkg, filePath);

        if (!fs.existsSync(sourcePath)) continue;

        if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== size) {
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(sourcePath, destPath);
            console.log(`- Synced: ${path.relative(VENDOR_DIR, destPath)}`);
            copyCount++;
        }
    }

    if (copyCount > 0) {
        console.log(`\n✅ Sync phase complete. Synced ${copyCount} files.`);
    } else {
        console.log('\n✅ All version-agnostic files are already up-to-date.');
    }

    // --- Phase 3: The "Damn Check" ---
    console.log('\n--- Phase 3: Verifying All Directories and Files ---');
    let allOk = true;
    for (const { pkg } of packagesToProcess) {
        const agnosticDir = path.join(VENDOR_DIR, pkg);
        if (fs.existsSync(agnosticDir)) {
            console.log(`✔️  OK: Directory exists: ${path.relative(process.cwd(), agnosticDir)}`);
        } else {
            console.error(`❌ FAILED: Directory is missing: ${path.relative(process.cwd(), agnosticDir)}`);
            allOk = false;
        }
    }

    if (!allOk) {
        console.error("\nVerification failed. Not all version-agnostic directories were created.");
        process.exit(1);
    }

    console.log('\n✅ Verification successful. All directories are in place.');
    console.log('\nAll dependencies are successfully downloaded and synced!');
}

main().catch(() => {
    process.exit(1);
});
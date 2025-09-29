/**
 * @file This module runs and displays diagnostics for the browser environment,
 * focusing on capabilities required for multi-threading (SharedArrayBuffer).
 * @version 1.1.0
 */

/**
 * A type definition for the result of a single diagnostic check.
 * @typedef {object} DiagnosticResult
 * @property {string} text - The human-readable description of the diagnostic check.
 * @property {boolean} success - A boolean indicating if the check passed (`true`) or failed (`false`).
 */


import {isMultithreading, mtRequirements} from '../ffmpeg/load/mtCheck.js';

/**
 * Creates the HTML markup for a single item in the diagnostic checklist.
 * @private
 * @param {DiagnosticResult} result - The result object for a single check.
 * @returns {string} The HTML string representing the diagnostic item.
 */
function renderDiagItem({ text, success }) {
    const icon = success ? '✅' : '❌';
    return `
        <div class="diag-item">
            <span>${icon}</span>
            <span>${text}</span>
        </div>
    `;
}

/**
 * Asynchronously runs a series of environment checks and renders the results
 * into the designated diagnostics container in the DOM.
 * @async
 * @returns {Promise<void>} A promise that resolves when the diagnostics have been rendered.
 */
export async function runDiagnostics() {
    const mtDiagnosticsElement = document.getElementById('mtDiagnostics');
    if (!mtDiagnosticsElement) {
        console.error("Diagnostics UI element #mtDiagnostics not found.");
        return;
    }

    const mtReq = await mtRequirements();

    /** @type {DiagnosticResult[]} */
    const results = [];

    // Check 1: Secure Context (required for SharedArrayBuffer)
    results.push({
        text: 'isSecureContext',
        success: mtReq.isSecureContext
    });

    results.push({
        text: `crossOriginIsolated`,
        success: mtReq.crossOriginIsolated
    });

    results.push({
        text: `crossOriginOpenerPolicy`,
        success:  mtReq.crossOriginOpenerPolicy
    });
    results.push({
        text: `crossOriginEmbedderPolicy`,
        success:  mtReq.crossOriginEmbedderPolicy
    });


    mtDiagnosticsElement.innerHTML = results.map(renderDiagItem).join('');
}
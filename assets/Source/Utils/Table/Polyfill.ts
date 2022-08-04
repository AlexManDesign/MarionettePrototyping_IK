import process from 'process/browser.js';

if (typeof globalThis.process === 'undefined') {
    globalThis.process = process;
}

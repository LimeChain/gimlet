const vscode = require('vscode');

let channel = null;

function getChannel() {
    if (!channel) {
        channel = vscode.window.createOutputChannel('Gimlet');
    }
    return channel;
}

function format(args) {
    return args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
}

function log(...args) {
    const ts = new Date().toISOString();
    getChannel().appendLine(`[${ts}] ${format(args)}`);
}

function error(...args) {
    const ts = new Date().toISOString();
    getChannel().appendLine(`[${ts}] ERROR: ${format(args)}`);
}

module.exports = { log, error };

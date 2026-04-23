const fs = require('fs');
const vscode = require('vscode');

async function safeReadDir(dirPath) {
    try {
        return await fs.promises.readdir(dirPath);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Error reading directory after V1 build: ${err}`
        );
        return null;
    }
}

module.exports = { safeReadDir };

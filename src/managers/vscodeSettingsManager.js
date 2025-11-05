const vscode = require('vscode');

// Configures and sets VS Code settings in the user workspace
class VSCodeSettingsManager {
    constructor(section) {
        this.section = section;
        this.config = vscode.workspace.getConfiguration(section);
        this.originalValues = {};
        this.modifiedKeys = new Set();
    }

    async disable(key) {
        this.originalValues[key] = this.config.get(key);
        await this.config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        this.modifiedKeys.add(key);
        vscode.window.showInformationMessage(`Temporarily disabled ${this.section}.${key}`);
    }

    async set(key, value) {
        this.originalValues[key] = this.config.get(key);
        await this.config.update(key, value, vscode.ConfigurationTarget.Workspace);
        this.modifiedKeys.add(key);
        vscode.window.showInformationMessage(`${this.section}.${key} set to: ${value}`);
    }

    async restore(key) {
        if (!this.modifiedKeys.has(key)) return;
        await this.config.update(key, this.originalValues[key], vscode.ConfigurationTarget.Workspace);
        this.modifiedKeys.delete(key);
        vscode.window.showInformationMessage(`Restored ${this.section}.${key} to original value.`);
    }

    async restoreAll() {
        for (const key of this.modifiedKeys) {
            await this.config.update(key, this.originalValues[key], vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Restored ${this.section}.${key} to original value.`);
        }
        this.modifiedKeys.clear();
    }
}

// ===== Instantiate managers for specific VS Code settings sections =====

const lldbSettingsManager = new VSCodeSettingsManager('lldb');
// Example usage: lldbSettingsManager.set('library', '/path/to/liblldb.dylib');

const rustAnalyzerSettingsManager = new VSCodeSettingsManager('rust-analyzer');

const editorSettingsManager = new VSCodeSettingsManager('editor');  

module.exports = { VSCodeSettingsManager, lldbSettingsManager, rustAnalyzerSettingsManager, editorSettingsManager };
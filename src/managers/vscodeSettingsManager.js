const vscode = require('vscode');

// Configures and sets VS Code settings in the user workspace
class VSCodeSettingsManager {
    constructor(section) {
        this.section = section;
        this.config = vscode.workspace.getConfiguration(section);
    }

    async set(key, value) {
        await this.config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }
}

// ===== Instantiate managers for specific VS Code settings sections =====

const rustAnalyzerSettingsManager = new VSCodeSettingsManager('rust-analyzer');

const editorSettingsManager = new VSCodeSettingsManager('editor');

module.exports = { rustAnalyzerSettingsManager, editorSettingsManager };
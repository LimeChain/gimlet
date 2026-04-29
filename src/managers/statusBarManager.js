const vscode = require('vscode');
const { globalState } = require('../state/globalState');

class StatusBarManager {
    constructor() {
        this.item = null;
        this.subscription = null;
    }

    activate(monitor) {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'gimlet.statusView.focus';
        this.item.show();
        this.render(monitor.state);
        this.subscription = monitor.onDidChangeState((state) => this.render(state));
    }

    render(state) {
        if (!this.item) return;
        const port = globalState.tcpPort;

        if (state === 'attached') {
            this.item.text = `$(debug-start) Gimlet: Attached`;
            this.item.tooltip = `Gimlet debug session live on port ${port}.`;
            this.item.backgroundColor = undefined;
            return;
        }

        if (state === 'ready') {
            this.item.text = `$(debug-alt) Gimlet: Ready`;
            this.item.tooltip = `gdbstub is listening on port ${port}. Open the Gimlet pane to attach.`;
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            return;
        }

        this.item.text = `$(debug-disconnect) Gimlet: Idle`;
        this.item.tooltip = `No gdbstub on port ${port}. Run a test to begin.`;
        this.item.backgroundColor = undefined;
    }

    dispose() {
        if (this.subscription) {
            this.subscription.dispose();
            this.subscription = null;
        }
        if (this.item) {
            this.item.dispose();
            this.item = null;
        }
    }
}

module.exports = { StatusBarManager };

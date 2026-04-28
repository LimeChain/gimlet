const vscode = require('vscode');
const { globalState } = require('../state/globalState');
const { isSessionRunning } = require('../debug');
const portManager = require('./portManager');

const POLL_MS = 1000;

// Single global status bar surface. Reflects three states based on
// whether tcpPort has a gdbstub bound and whether a debug session is live.
// Click delegates to `gimlet.debugAtLine`, so attaching is always a single 
// click away regardless of which editor is focused.
class StatusBarManager {
    constructor() {
        this.item = null;
        this.timer = null;
    }

    activate() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'gimlet.debugAtLine';
        this.item.show();
        this.refresh();
        this.timer = setInterval(() => this.refresh(), POLL_MS);
    }

    async refresh() {
        if (!this.item) return;
        const port = globalState.tcpPort;

        if (isSessionRunning()) {
            this.item.text = `$(debug-start) Sbpf: Attached`;
            this.item.tooltip = `Gimlet debug session live on port ${port}.`;
            this.item.backgroundColor = undefined;
            return;
        }

        // Double-probing wastes systeminformation calls and can
        // flicker the label between "Ready" and "Attached".
        if (portManager.isPolling()) return;

        const open = await portManager.isPortOpen(port);
        if (!this.item) return; // disposed during the await

        if (open) {
            this.item.text = `$(debug-alt) Sbpf: Ready`;
            this.item.tooltip = `gdbstub is listening on port ${port}. Click to attach.`;
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.item.text = `$(debug-disconnect) Sbpf: Idle`;
            this.item.tooltip = `No gdbstub on port ${port}. Start a Mollusk/LiteSVM test that opens the gdbstub, then click here.`;
            this.item.backgroundColor = undefined;
        }
    }

    dispose() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.item) {
            this.item.dispose();
            this.item = null;
        }
    }
}

module.exports = { StatusBarManager };

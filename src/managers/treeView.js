const vscode = require('vscode');
const { globalState } = require('../state/globalState');

const VIEW_ID = 'gimlet.statusView';

class TreeView {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.state = 'idle';
        this.registration = null;
        this.subscription = null;
    }

    activate(monitor) {
        this.registration = vscode.window.registerTreeDataProvider(VIEW_ID, this);
        this.state = monitor.state;
        this.subscription = monitor.onDidChangeState((state) => {
            this.state = state;
            this._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        const port = globalState.tcpPort;
        return [makeStatusItem(this.state, port), makeActionItem(this.state), makeDocsItem()];
    }

    dispose() {
        if (this.subscription) {
            this.subscription.dispose();
            this.subscription = null;
        }
        if (this.registration) {
            this.registration.dispose();
            this.registration = null;
        }
        this._onDidChangeTreeData.dispose();
    }
}

function makeStatusItem(state, port) {
    const labels = {
        idle: 'Idle — no gdbstub bound',
        ready: 'Ready — gdbstub is listening',
        attached: 'Attached — debug session live',
    };
    const icons = { idle: 'debug-disconnect', ready: 'debug-alt', attached: 'debug-start' };
    const item = new vscode.TreeItem(labels[state]);
    item.iconPath = new vscode.ThemeIcon(icons[state]);
    item.description = `port ${port}`;
    item.tooltip = item.label;
    return item;
}

function makeActionItem(state) {
    if (state === 'attached') {
        const item = new vscode.TreeItem('Stop Session');
        item.iconPath = new vscode.ThemeIcon('debug-stop');
        item.command = { command: 'gimlet.stopSession', title: 'Stop Session' };
        return item;
    }
    const item = new vscode.TreeItem('Attach Debugger');
    item.iconPath = new vscode.ThemeIcon('play');
    item.command = { command: 'gimlet.debugAtLine', title: 'Attach Debugger' };
    return item;
}

function makeDocsItem() {
    const item = new vscode.TreeItem('Documentation');
    item.iconPath = new vscode.ThemeIcon('book');
    item.tooltip = 'Open Gimlet documentation in your browser';
    item.command = {
        command: 'vscode.open',
        title: 'Open Documentation',
        arguments: [vscode.Uri.parse('https://github.com/LimeChain/gimlet#readme')],
    };
    return item;
}

module.exports = { TreeView };

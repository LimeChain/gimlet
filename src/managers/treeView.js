const vscode = require('vscode');
const { globalState } = require('../state/globalState');

const VIEW_ID = 'gimlet.statusView';

class TreeView {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.state = 'idle';
        this.view = null;
        this.subscription = null;
        this.visibilitySubscription = null;
        this.monitor = null;
    }

    activate(monitor) {
        this.monitor = monitor;
        this.subscription = monitor.onDidChangeState((state) => {
            this.state = state;
            this._onDidChangeTreeData.fire();
        });
        this.state = monitor.state;
        this.view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: this });
        monitor.setObserved(this.view.visible);
        this.visibilitySubscription = this.view.onDidChangeVisibility((e) => {
            monitor.setObserved(e.visible);
        });
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        const port = globalState.tcpPort;
        const items = [makeStatusItem(this.state, port)];
        const action = makeActionItem(this.state);
        if (action) items.push(action);
        items.push(makeDocsItem());
        return items;
    }

    dispose() {
        if (this.subscription) {
            this.subscription.dispose();
            this.subscription = null;
        }
        if (this.visibilitySubscription) {
            this.visibilitySubscription.dispose();
            this.visibilitySubscription = null;
        }
        if (this.monitor) {
            this.monitor.setObserved(false);
            this.monitor = null;
        }
        if (this.view) {
            this.view.dispose();
            this.view = null;
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
    return item;
}

function makeActionItem(state) {
    if (state === 'attached') {
        const item = new vscode.TreeItem('Stop Session');
        item.iconPath = new vscode.ThemeIcon('debug-stop');
        item.command = { command: 'gimlet.stopSession', title: 'Stop Session' };
        return item;
    }
    if (state === 'ready') {
        const item = new vscode.TreeItem('Attach Debugger');
        item.iconPath = new vscode.ThemeIcon('play');
        item.command = { command: 'gimlet.attachDebugger', title: 'Attach Debugger' };
        return item;
    }
    return null;
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

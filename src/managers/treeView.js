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
        idle: 'Idle - No test detected',
        ready: 'Ready - Attach below',
        attached: 'Attached - Debug session live',
    };
    const icons = { idle: 'debug-disconnect', ready: 'debug-alt', attached: 'debug-start' };
    const item = new vscode.TreeItem(labels[state]);
    item.iconPath = new vscode.ThemeIcon(icons[state]);
    item.description = state === 'idle' ? `port ${port} · hover for help` : `port ${port}`;
    if (state === 'idle') {
        item.tooltip = makeIdleTooltip(port);
    }
    return item;
}

function makeIdleTooltip(port) {
    const version = globalState.platformToolsVersion;
    const tracePath = globalState.sbfTracePath || 'target/sbf/trace';
    const env = `SBF_DEBUG_PORT=${port} SBF_TRACE_DIR=$PWD/${tracePath}`;
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`Gimlet attaches once a test process binds to port **${port}** with the sbpf-debugger.\n\n`);
    md.appendMarkdown(`For Mollusk / LiteSVM, enable the \`sbpf-debugger\` feature on the \`litesvm\` / \`mollusk-svm\` dependency in your Cargo.toml, then build your programs:`);
    md.appendCodeblock(
        [
            `RUSTFLAGS="-Copt-level=0 -C strip=none -C debuginfo=2" cargo-build-sbf --tools-version v${version} --debug --arch v1`,
        ].join('\n'),
        'bash'
    );
    md.appendMarkdown('And finally, run your test:');
    md.appendCodeblock(
        [
            `${env} cargo test`,
        ].join('\n'),
        'bash'
    );
    md.appendMarkdown(`\nThis view flips to **Ready** once the port is bound.`);
    return md;
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

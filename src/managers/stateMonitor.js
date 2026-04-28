const vscode = require('vscode');
const { globalState } = require('../state/globalState');
const { isSessionRunning } = require('../debug');
const portManager = require('./portManager');

const POLL_MS = 1000;

class StateMonitor {
    constructor() {
        this.state = 'idle';
        this.timer = null;
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeState = this._emitter.event;
    }

    activate() {
        this.tick();
        this.timer = setInterval(() => this.tick(), POLL_MS);
    }

    async tick() {
        let next;
        if (isSessionRunning()) {
            next = 'attached';
        } else if (portManager.isPolling()) {
            // Hold last known state while the attach polling loop owns the port.
            next = this.state;
        } else {
            const open = await portManager.isPortOpen(globalState.tcpPort);
            next = open ? 'ready' : 'idle';
        }
        if (next !== this.state) {
            this.state = next;
            this._emitter.fire(next);
        }
    }

    dispose() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this._emitter.dispose();
    }
}

module.exports = { StateMonitor };

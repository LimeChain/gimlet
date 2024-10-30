// const {
//   DebugSession,
//   InitializedEvent,
//   TerminatedEvent,
//   StoppedEvent,
//   OutputEvent,
//   Thread,
//   StackFrame,
//   Scope,
//   Source,
//   Handles,
// } = require("vscode-debugadapter");
// const { DebugProtocol } = require("vscode-debugprotocol");
// const { exec } = require("child_process");
// const path = require("path");
// const os = require("os");

// class SolanaDebugSession extends DebugSession {
//   constructor() {
//     super();
//     this._variableHandles = new Handles();
//   }

//   initializeRequest(response, args) {
//     response.body = response.body || {};
//     response.body.supportsConfigurationDoneRequest = true;
//     this.sendResponse(response);
//     this.sendEvent(new InitializedEvent());
//   }

//   launchRequest(response, args) {
//     const program = args.program;
//     const solanalldbPath = path.join(
//       os.homedir(),
//       ".local",
//       "share",
//       "solana",
//       "install",
//       "active_release",
//       "bin",
//       "sdk",
//       "sbf",
//       "dependencies",
//       "platform-tools",
//       "llvm",
//       "bin",
//       "solana-lldb"
//     );

//     const command = `${solanalldbPath} ${program}`;

//     exec(command, (err, stdout, stderr) => {
//       if (err) {
//         this.sendEvent(new OutputEvent(`Error: ${stderr}\n`));
//         this.sendEvent(new TerminatedEvent());
//         return;
//       }

//       this.sendEvent(new OutputEvent(`Output: ${stdout}\n`));
//       this.sendEvent(new TerminatedEvent());
//     });

//     this.sendResponse(response);
//   }
// }

// DebugSession.run(SolanaDebugSession);

const vscode = require("vscode");
const { exec } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

let breakpointMap = new Map();

// This starts from 1 because in lldb breakpoints start from index 1.
let bpCounter = 1;
let breakpointListenerDisposable = null;
let activeTerminal = null;

function getCommandPath(command) {
  const homeDir = os.homedir();
  const agaveLedgerToolPath = path.join(
    homeDir,
    ".local",
    "share",
    "solana",
    "install",
    "active_release",
    "bin",
    "agave-ledger-tool"
  );

  let solanalldbPath = path.join(
    homeDir,
    ".local",
    "share",
    "solana",
    "install",
    "active_release",
    "bin",
    "sdk",
    "sbf",
    "dependencies",
    "platform-tools",
    "llvm",
    "bin",
    "solana-lldb"
  );

  const customSolanalldbPath = vscode.workspace
    .getConfiguration("solanaDebugger")
    .get("solanaLldbPath");
  if (customSolanalldbPath) {
    solanalldbPath = customSolanalldbPath;
  }

  if (command.includes("agave-ledger-tool")) {
    return agaveLedgerToolPath;
  } else if (command.includes("solana-lldb")) {
    return solanalldbPath;
  } else {
    vscode.window.showErrorMessage(`Unknown command: ${command}`);
    return "";
  }
}

function runCommand(command, args = "") {
  const commandPath = getCommandPath(command);

  if (!commandPath) {
    vscode.window.showErrorMessage(`Command path for ${command} not found.`);
    return;
  }

  const terminal = vscode.window.createTerminal(`Run ${command}`);
  terminal.show();
  terminal.sendText(`${commandPath} ${args}`);
}

function startSolanaDebugger() {
  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const projectFolderName = path.basename(workspaceFolder);
  const depsPath = `${workspaceFolder}/target/debug/deps`;

  if (breakpointListenerDisposable) {
    breakpointListenerDisposable.dispose();
    breakpointListenerDisposable = null;
  }

  bpCounter = 1;
  breakpointMap.clear();

  vscode.window.terminals.forEach((terminal) => {
    if (terminal.name === "Solana LLDB Debugger") {
      terminal.dispose();
    }
  });

  if (!fs.existsSync(depsPath)) {
    vscode.window.showInformationMessage(
      "Target folder not found. Cargo is installing necessary tools."
    );
  }

  exec(
    `cargo test --no-run --lib --package=${projectFolderName}`,
    { cwd: workspaceFolder },
    (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Build error: ${stderr}`);
        return;
      }

      try {
        if (!fs.existsSync(depsPath)) {
          vscode.window.showErrorMessage(`Executable not found: ${depsPath}`);
          return;
        }

        fs.readdir(depsPath, (readDirErr, files) => {
          if (readDirErr) {
            vscode.window.showErrorMessage(
              `Error reading directory: ${readDirErr}`
            );
            return;
          }

          const transformedProjectFolderName = projectFolderName.replace(
            /-/g,
            "_"
          );

          const executableFile = files.find(
            (file) =>
              file.startsWith(`${transformedProjectFolderName}-`) &&
              !file.includes(".")
          );

          const executablePath = `${depsPath}/${executableFile}`;

          console.log(projectFolderName);
          console.log(`Executable path: ${executablePath}`);
          console.log(`Executable file: ${executableFile}`);

          const debuggerCommand = "solana-lldb";

          const terminal = vscode.window.createTerminal("Solana LLDB Debugger");
          activeTerminal = terminal;
          terminal.show();
          terminal.sendText(debuggerCommand);

          setTimeout(() => {
            terminal.sendText(`target create ${executablePath}`);
            terminal.sendText("process launch -- --nocapture");

            const allBreakpoints = vscode.debug.breakpoints;
            if (allBreakpoints && allBreakpoints.length > 0) {
              allBreakpoints.forEach((bp) => {
                if (bp.location) {
                  const line = bp.location.range.start.line + 1;
                  terminal.sendText(
                    `breakpoint set --file ${bp.location.uri.fsPath} --line ${line}`
                  );
                  breakpointMap.set(bp.id, bpCounter);
                  bpCounter++;
                }
              });
            }
          }, 500);

          breakpointListenerDisposable = vscode.debug.onDidChangeBreakpoints(
            (event) => {
              if (!activeTerminal) return;

              if (event.added.length > 0) {
                event.added.forEach((bp) => {
                  const line = bp.location.range.start.line + 1;
                  activeTerminal.sendText(
                    `breakpoint set --file ${bp.location.uri.fsPath} --line ${line}`
                  );

                  breakpointMap.set(bp.id, bpCounter);
                  bpCounter++;
                });
              }

              if (event.removed.length > 0) {
                event.removed.forEach((bp) => {
                  const breakpoint = breakpointMap.get(bp.id);

                  if (breakpoint) {
                    activeTerminal.sendText(`breakpoint delete ${breakpoint}`);
                    breakpointMap.delete(bp.id);
                  }
                });
              }
            }
          );

          terminal.onDidClose(() => {
            if (activeTerminal === terminal) {
              activeTerminal = null;
            }
          });
        });
      } catch (e) {
        vscode.window.showErrorMessage(`Error: ${e}`);
        vscode.window.showErrorMessage(`Stderr Stack: ${stderr}`);
      }
    }
  );
}

function reRunProcessLaunch() {
  const terminal = vscode.window.terminals.find(
    (t) => t.name === "Solana LLDB Debugger"
  );

  if (terminal) {
    activeTerminal = terminal;
    terminal.sendText("process launch -- --nocapture");
  } else {
    vscode.window.showErrorMessage("Solana LLDB Debugger terminal not found.");
    startSolanaDebugger();
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // This line of code will only be executed once when your extension is activated
  console.log("Gimlet is now active!");

  const disposable = vscode.commands.registerCommand(
    "extension.runAgaveLedgerTool",
    () => {
      vscode.window
        .showInputBox({ prompt: "Enter agave-ledger-tool subcommand" })
        .then((subcommand) => {
          if (subcommand) {
            runCommand("agave-ledger-tool", subcommand);
          } else {
            vscode.window.showErrorMessage("No subcommand provided.");
          }
        });
    }
  );

  context.subscriptions.push(disposable);

  const disposable2 = vscode.commands.registerCommand(
    "extension.runSolanaLLDB",
    () => {
      startSolanaDebugger();
    }
  );

  context.subscriptions.push(disposable2);

  const disposable3 = vscode.commands.registerCommand(
    "extension.reRunProcessLaunch",
    () => {
      reRunProcessLaunch();
    }
  );

  context.subscriptions.push(disposable3);
}

function deactivate() {
  if (breakpointListenerDisposable) {
    breakpointListenerDisposable.dispose();
    breakpointListenerDisposable = null;
  }
  activeTerminal = null;
}

module.exports = {
  activate,
  deactivate,
};

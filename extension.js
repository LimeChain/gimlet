const vscode = require("vscode");
const { exec } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

let breakpointMap = new Map();

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

  const solanalldbPath = path.join(
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
  // const editor = vscode.window.activeTextEditor;
  // if (!editor) {
  //   vscode.window.showErrorMessage(
  //     "No active editor found. Please open your lib.rs file."
  //   );
  //   return;
  // }

  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const projectFolderName = path.basename(workspaceFolder);
  const depsPath = `${workspaceFolder}/target/debug/deps`;

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

          const executableFile = files.find(
            (file) =>
              file.startsWith(`${projectFolderName}-`) && !file.includes(".")
          );

          const executablePath = `${depsPath}/${executableFile}`;

          const terminal = vscode.window.createTerminal("Solana Debugger");
          terminal.show();
          terminal.sendText("solana-lldb");
          terminal.sendText(`target create ${executablePath}`);
          terminal.sendText("process launch -- --nocapture");

          vscode.window.showInformationMessage(
            "Debugger launched successfully with executable:",
            executablePath
          );

          vscode.debug.onDidChangeBreakpoints((event) => {
            if (event.added.length > 0) {
              event.added.forEach((bp) => {
                const line = bp.location.range.start.line + 1;
                terminal.sendText(
                  `breakpoint set --file ${bp.location.uri.fsPath} --line ${line}`
                );

                setTimeout(() => {
                  terminal.sendText("breakpoint list");
                }, 500);

                // terminal.sendText("breakpoint list", (output) => {
                //   const match = output.match(/^\d+: /);
                //   console.log(match);
                //   if (match) {
                //     const bpId = match[1];
                //     console.log(match);
                //     breakpointMap.set(bp, bpId);
                //   }
                // });
              });
            }
            if (event.removed.length > 0) {
              event.removed.forEach((bp) => {
                const bpId = breakpointMap.get(bp);
                console.log(bpId);
                console.log("removing bp");
                if (bpId) {
                  terminal.sendText(`breakpoint delete ${bpId}`);
                  breakpointMap.delete(bp);
                }
              });
            }
          });

          vscode.window.onDidWriteTerminalData((event) => {
            console.log("event", event);
            if (event.terminal === terminal) {
              const output = event.data;
              console.log("output", output);
              const match = output.match(/^\d+: /);
              if (match) {
                const bpId = match[1];
                // console.log(match);
                vscode.debug.breakpoints.forEach((bp) => {
                  if (!breakpointMap.has(bp)) {
                    breakpointMap.set(bp, bpId);
                  }
                });
              }
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

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // This line of code will only be executed once when your extension is activated
  console.log("Solana Step Debugger is now active!");

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
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

const vscode = require("vscode");
const { exec } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

let breakpointMap = new Map();

// This starts from 1 because in lldb breakpoints start from index 1.
let bpCounter = 1;

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
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
function findSolanaLldbPath() {
  const osPaths = {
      'darwin': [
          `${process.env.HOME}/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin/solana-lldb`,
          '/usr/local/bin/solana-lldb'
      ],
      'linux': [
          `${process.env.HOME}/.cache/solana/**/platform-tools/llvm/bin/solana-lldb`,
          '/usr/bin/solana-lldb',
          '/home/linuxbrew/.linuxbrew/bin/solana-lldb'
      ],
      'win32': [
          path.join(process.env.APPDATA, 'solana', 'bin', 'solana-lldb.exe'),
          path.join(process.env.LOCALAPPDATA, 'solana', 'bin', 'solana-lldb.exe')
      ]
  };

  // 1. Search in system path
  const pathCheck = which.sync('solana-lldb', {nothrow: true});
  if (pathCheck) return pathCheck;

  // 2. Search in more OS specific routes
  const platformPaths = osPaths[process.platform] || [];
  for (const p of platformPaths) {
      const files = glob.sync(p);
      if (files.length > 0) return files[0];
  }

  // 3. Fallback: project directory
  const projectPath = path.join(workspaceRoot, 'cache', 'solana', '**', 'platform-tools', 'llvm', 'bin', 'solana-lldb');
  const projectFiles = glob.sync(projectPath);
  return projectFiles[0] || null;
}
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________

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

  vscode.window.terminals.forEach((terminal) => {
    if (terminal.name === "Solana Debugger") {
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

          bpCounter = 1;

          const debuggerCommand = "solana-lldb";

          const terminal = vscode.window.createTerminal("Solana LLDB Debugger");
          terminal.show();
          terminal.sendText(debuggerCommand);

          setTimeout(() => {
            terminal.sendText(`target create ${executablePath}`);
            terminal.sendText("process launch -- --nocapture");
          }, 500);

          vscode.debug.onDidChangeBreakpoints((event) => {
            if (event.added.length > 0) {
              event.added.forEach((bp) => {
                const line = bp.location.range.start.line + 1;
                terminal.sendText(
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
                  terminal.sendText(`breakpoint delete ${breakpoint}`);
                  breakpointMap.delete(bp.id);
                }
              });
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
    terminal.sendText("process launch -- --nocapture");
  } else {
    vscode.window.showErrorMessage("Solana LLDB Debugger terminal not found.");
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

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

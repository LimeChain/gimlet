const vscode = require("vscode");
const { spawn, exec } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

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

  // const child = spawn(commandPath, args ? args.split(" ") : [], {
  //   shell: true,
  // });

  // child.stdout.on("data", (data) => {
  //   vscode.window.showInformationMessage(`Output: ${data}`);
  // });

  // child.stderr.on("data", (data) => {
  //   vscode.window.showErrorMessage(`Error: ${data}`);
  // });

  // child.on("close", (code) => {
  //   if (code !== 0) {
  //     vscode.window.showErrorMessage(`Command failed with code ${code}`);
  //   }
  // });
}

function startSolanaDebugger() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

  // Read the Cargo.toml to get the package name
  const cargoTomlPath = path.join(workspaceFolder, "Cargo.toml");
  const cargoTomlContent = fs.readFileSync(cargoTomlPath, "utf8");
  const packageNameMatch = cargoTomlContent.match(/name\s*=\s*"([^"]+)"/);
  if (!packageNameMatch) {
    vscode.window.showErrorMessage(
      "Could not determine package name from Cargo.toml."
    );
    return;
  }

  const packageName = packageNameMatch[1];
  const programPath = path.join(
    workspaceFolder,
    "target",
    "debug",
    packageName
  );

  exec("cargo build", { cwd: workspaceFolder }, (err, stdout, stderr) => {
    if (err) {
      vscode.window.showErrorMessage(`Build error: ${stderr}`);
      return;
    }

    if (!fs.existsSync(programPath)) {
      vscode.window.showErrorMessage(`Executable not found: ${programPath}`);
      return;
    }

    const debugConfiguration = {
      type: "lldb",
      request: "launch",
      name: "Debug Solana Program",
      program: programPath,
      args: [],
      cwd: workspaceFolder,
      stopOnEntry: false,
      runInTerminal: true,
    };

    vscode.debug.startDebugging(undefined, debugConfiguration).then(
      (success) => {
        if (!success) {
          vscode.window.showErrorMessage("Failed to start the debugger.");
        }
      },
      (error) => {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    );
  });
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

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("solana-debugger", {
      provideDebugConfigurations(folder, token) {
        return [
          {
            type: "solana-step-debugger",
            request: "launch",
            name: "Launch Solana Debugger",
          },
        ];
      },
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

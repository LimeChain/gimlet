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
  const homeDir = os.homedir(); // get the home dir /Users/emilroydev in my case
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

  // The idea of this is to get the `solanaLldbPath` from the settings and set this value of `customSolanalldbPath`
  // If u are interested go in settings and search for `solanaLldbPath` to see it. It is just a input field
  const customSolanalldbPath = vscode.workspace
    .getConfiguration("solanaDebugger")
    .get("solanaLldbPath");
  if (customSolanalldbPath) {
    solanalldbPath = customSolanalldbPath;
  }

  // So when i run command it retunrs the approriate path based on the command passed
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

  // Creates a new terminal with the commandPath and args
  const terminal = vscode.window.createTerminal(`Run ${command}`);
  terminal.show();
  terminal.sendText(`${commandPath} ${args}`);
}

function startSolanaDebugger() {
  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath; // extract my workspace folder path (e.g. /Users/emilroydev/Projects/solana-demo) for example
  const projectFolderName = path.basename(workspaceFolder); // this set the project folder name (e.g. solana-demo) for logs 
  const depsPath = `${workspaceFolder}/target/debug/deps`; // Path to compiled dependency files (.rlib, .d, .rmeta, etc.) -> created on `cargo build` or `cargo test`

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

  // Find the Cargo.toml based on common Solana framework structures
  let cargoTomlPath = null;
  let packageName = null;

  // Try paths for the three common frameworks
  const potentialPaths = [
    path.join(workspaceFolder, "program", "src", "Cargo.toml"), // Steel & Native
    path.join(workspaceFolder, "program", "Cargo.toml"), // Alternative structure
    path.join(workspaceFolder, "Cargo.toml"), // Root level
  ];
  // Find first available Cargo.toml from common locations
  for (const potentialPath of potentialPaths) {
    if (fs.existsSync(potentialPath)) {
      try {
        const cargoToml = fs.readFileSync(potentialPath, "utf8");
        const packageNameMatch = cargoToml.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (packageNameMatch) {
          packageName = packageNameMatch[1];
          break;
        }
      } catch (error) {
        // Properly handle errors reading Cargo.toml
        console.error(`Failed to read or parse ${potentialPath}: ${error.message}`);
        vscode.window.showWarningMessage(
          `Error processing ${path.basename(potentialPath)}: ${error.message}`
        );
        // Continue checking other paths
      }
    }
  }

  // Check Anchor structure (programs/[package-name]/Cargo.toml)
  if (!packageName) {
    const programsDir = path.join(workspaceFolder, "programs");
    if (fs.existsSync(programsDir)) {
      try {
        const programDirs = fs.readdirSync(programsDir).filter((item) => {
          try {
            return fs.statSync(path.join(programsDir, item)).isDirectory();
          } catch (statError) {
            console.error(
              `Failed to check if ${item} is directory: ${statError.message}`
            );
            return false;
          }
        });

        for (const dir of programDirs) {
          const anchorCargoPath = path.join(programsDir, dir, "Cargo.toml");
          if (fs.existsSync(anchorCargoPath)) {
            try {
              const cargoToml = fs.readFileSync(anchorCargoPath, "utf8");
              const packageNameMatch = cargoToml.match(/^\s*name\s*=\s*"([^"]+)"/m);
              if (packageNameMatch) {
                packageName = packageNameMatch[1];
                break;
              }
            } catch (readError) {
              console.error(`Failed to read ${anchorCargoPath}: ${readError.message}`);
              vscode.window.showWarningMessage(
                `Error reading program ${dir} Cargo.toml: ${readError.message}`
              );
              // Continue checking other directories
            }
          }
        }
      } catch (error) {
        console.error(`Failed to scan programs directory: ${error.message}`);
        vscode.window.showWarningMessage(
          `Error scanning program directories: ${error.message}`
        );
      }
    }
  }

  if (!packageName) {
    vscode.window.showErrorMessage("Could not find package name in any Cargo.toml");
    return;
  }

  const anchorTomlPath = path.join(workspaceFolder, "Anchor.toml");
  const isAnchorProject = fs.existsSync(anchorTomlPath);

  if (isAnchorProject) {
    // use anchor-lldb generate
    exec(
      // This use to compile the Anchor instructions to generate binary executable for debugging
      `anchor-lldb generate --package ${packageName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(`Build error: ${stderr}`);
          return;
        }
        
        // Extract the binary path from the output of the anchor-lldb
        const binOutLine = stdout
          .split("\n")
          .find(line => line.startsWith("::BIN_OUT::"));
  
        // Check if its empty
        if (!binOutLine) {
          vscode.window.showErrorMessage("No binary output found in anchor-lldb generate output.");
          return;
        }
  
        const executablePath =  binOutLine.replace("::BIN_OUT::", "").trim();
        console.log("Binary path: ", executablePath);
        continueWithDebugger(executablePath);
      }
    );
  } else {
    // Fallback to native cargo build
    exec(
      `cargo test --no-run --lib --package=${packageName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(`Build error: ${stderr}`);
          return;
        }

        if (!fs.existsSync(depsPath)) {
          vscode.window.showErrorMessage(
            "Target folder not found. Please run `cargo build` or `cargo test` first."
          );
          return;
        }

        fs.readdir(depsPath, (readDirErr, files) => {
          if (readDirErr) {
              vscode.window.showErrorMessage(`Error reading directory: ${readDirErr}`);
              return;
          }

          const transformedProjectFolderName = packageName.replace(/-/g, "_");
          const executableFile = files.find(
            (file) =>
              file.startsWith(`${transformedProjectFolderName}-`) && !file.includes(".")
          );

          if (!executableFile) {
            vscode.window.showErrorMessage(`Executable not found for ${transformedProjectFolderName}`);
            return;
          }

          const executablePath = `${depsPath}/${executableFile}`;
          continueWithDebugger(executablePath);
        });
      }
    )
  }z
}

// It checks if the executable path exists and then starts the terminal with gimlet-cli
// and sets the breakpoints if any are set in the editor
// It also listens for breakpoint changes and updates the terminal accordingly
// It also handles the case when the terminal is closed and resets the activeTerminal variable
function continueWithDebugger(executablePath) {
  if (!fs.existsSync(executablePath)) {
    vscode.window.showErrorMessage(`Executable not found: ${executablePath}`);
    return;
  }

  fs.stat(executablePath, (err, stats) => {
    if (err) {
      vscode.window.showErrorMessage(`Error reading file: ${err}`);
      return;
    }

    if (!stats.isFile()) {
      vscode.window.showErrorMessage(`Path is not a file: ${executablePath}`);
      return;
    }

    const terminal = vscode.window.createTerminal("Solana LLDB Debugger");
    activeTerminal = terminal;
    terminal.show();
    terminal.sendText("gimlet-cli");

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

    breakpointListenerDisposable = vscode.debug.onDidChangeBreakpoints((event) => {
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
    });

    terminal.onDidClose(() => {
      if (activeTerminal === terminal) {
        activeTerminal = null;
      }
    });
  });
}


function reRunProcessLaunch() {
  const terminal = vscode.window.terminals.find((t) => t.name === "Solana LLDB Debugger");

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

  const disposable2 = vscode.commands.registerCommand("extension.runSolanaLLDB", () => {
    startSolanaDebugger();
  });

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

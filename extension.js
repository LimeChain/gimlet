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

// util for finding the executable file in the target/deploy directory
function findExecutableFile(files, projectName, extension) {
  const transformedProjectName = projectName.replace(/-/g, "_");
  return files.find(
    (file) =>
      file.startsWith(`${transformedProjectName}`) && file.endsWith(extension)
  );
}

async function startSolanaDebugger() {
  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const projectFolderName = path.basename(workspaceFolder);
  const depsPath = `${workspaceFolder}/target/deploy`;

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
    const programsList = []; // Contains the names of all programs

    if (fs.existsSync(programsDir)) {
      try {
        const programDirs = fs.readdirSync(programsDir).filter((item) => {
          try {
            // Add the program name to the list
            programsList.push(item);
            return fs.statSync(path.join(programsDir, item)).isDirectory();
          } catch (statError) {
            console.error(
              `Failed to check if ${item} is directory: ${statError.message}`
            );
            return false;
          }
        });

        // Bellow is the logic to handle multiple programs in an anchor project
        if (programsList.length > 1) {
          const programOptions = programsList.map((item) => ({
            label: item,
            description: "Select a program to debug",
          }));

          const selected = await vscode.window.showQuickPick(programOptions, {
            placeHolder: "Select one of your programs to debug",
          });

          if (!selected) {
            vscode.window.showErrorMessage("Gimlet: Please select a program to debug.");
            return;
          }
          
          const anchorCargoPath = path.join(programsDir, selected.label, "Cargo.toml");
          const foundPackageName = checkIfAnchorCargoExists(anchorCargoPath, selected.label);
          if (foundPackageName) {
            packageName = foundPackageName;
          } else {
            vscode.window.showErrorMessage(
              `Cargo.toml not found in selected program: ${selected.label}`
            );
            return;
          }
        } else {
          for (const dir of programDirs) {
            const anchorCargoPath = path.join(programsDir, dir, "Cargo.toml");
            const foundPackageName = checkIfAnchorCargoExists(anchorCargoPath, dir);
            if (foundPackageName) {
              packageName = foundPackageName;
              break;
            } else {
              vscode.window.showErrorMessage(
                `Cargo.toml not found in program: ${dir}`
              );
              return;
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

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Building Solana program, for a multi-program project it can take some time because of compiling",
    cancellable: false
  }, (progress) => {
    progress.report({ increment: 0, message: "Starting build..." });
    
    return new Promise((resolve) => {
      exec(
        // Build the SBF program using cargo
        `cargo build-sbf --debug`,
        { cwd: workspaceFolder },
        (err, stdout, stderr) => {
          if (err) {
            vscode.window.showErrorMessage(`Build error: ${stderr}`);
            resolve(); // Complete progress even on error
            return;
          }

          progress.report({ increment: 50, message: "Setting up debugger..." });      try {
        if (!fs.existsSync(depsPath)) {
          vscode.window.showErrorMessage(`Executable not found: ${depsPath}`);
          return;
        }

        fs.readdir(depsPath, (readDirErr, files) => {
          if (readDirErr) {
            vscode.window.showErrorMessage(`Error reading directory: ${readDirErr}`);
            return;
          }

          const transformedProjectFolderName = packageName.replace(/-/g, "_");
          console.log("Transformed Project Folder", transformedProjectFolderName);

          const executableFile = findExecutableFile(files, packageName, ".debug");

          const executablePath = `${depsPath}/${executableFile}`;

          console.log(projectFolderName);
          console.log(`Executable path: ${executablePath}`);
          console.log(`Executable file: ${executableFile}`);

          const bpfCompiledFile = findExecutableFile(files, packageName, ".so");
          const bpfCompiledPath = `${depsPath}/${bpfCompiledFile}`;

          console.log(`BPF compiled path: ${bpfCompiledPath}`);
          const agaveLedgerToolCommand = `agave-ledger-tool program run -l ledger -e debugger ${bpfCompiledPath}`

          const agaveTerminal = vscode.window.createTerminal("Agave Ledger Tool");
          agaveTerminal.show();
          agaveTerminal.sendText(agaveLedgerToolCommand);

          const debuggerCommand = "solana-lldb";

          const terminal = vscode.window.createTerminal("Solana LLDB Debugger");
          activeTerminal = terminal;
          terminal.show();
          terminal.sendText(debuggerCommand);

          setTimeout(() => {
            terminal.sendText(`target create ${executablePath}`);
            terminal.sendText(`gdb-remote 127.0.0.1:9001`); // Connect to the gdb server that agave-ledger-tool started on 
            // terminal.sendText("process launch -- --nocapture");

            progress.report({ increment: 100, message: "Build complete!" });
            resolve(); // Complete the progress

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
          resolve(); // Complete progress even on error
        }
      });
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

function checkIfAnchorCargoExists(anchorCargoPath, dir) {
  if (fs.existsSync(anchorCargoPath)) {
    try {
      const cargoToml = fs.readFileSync(anchorCargoPath, "utf8");
      const packageNameMatch = cargoToml.match(/^\s*name\s*=\s*"([^"]+)"/m);
      if (packageNameMatch) {
        return packageNameMatch[1]; // Return the package name instead of setting global variable
      }
    } catch (readError) {
      console.error(`Failed to read ${anchorCargoPath}: ${readError.message}`);
      vscode.window.showWarningMessage(
        `Error reading program ${dir} Cargo.toml: ${readError.message}`
      );
    }
  }
  return null; // Return null if not found
}
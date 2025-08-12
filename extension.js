const vscode = require("vscode");
const { exec } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const FUNCTION_ADDRESS_MAP_NAME = "function_address_map.txt";
let breakpointMap = new Map();

// This starts from 1 because in lldb breakpoints start from index 1.
let bpCounter = 1;
let breakpointListenerDisposable = null;
let activeTerminal = null;

// State variables
let globalWorkspaceFolder = null;
let globalBpfCompiledPath = null;
let globalInputPath = null;
let functionAddressMapPath = null;
let isLldbConnected = false; // Track if LLDB is connected to the gdb server
let isAnchor = false; // Track if the project is an Anchor project
let selectedAnchorProgramName = null; // If it's an Anchor project with multiple programs, this will hold the selected program name(if its null then its single program project) 

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
  // TODO: Maybe these can be moved to a separate config file with all the validation checks
  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  globalWorkspaceFolder = workspaceFolder;

  const projectFolderName = path.basename(workspaceFolder);
  const depsPath = `${workspaceFolder}/target/deploy`;
  const inputPath = `${workspaceFolder}/input`;
  globalInputPath = inputPath;

  isLldbConnected = false; // Reset the connection status
  selectedAnchorProgramName = null; // Reset the selected program name

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
          selectedAnchorProgramName = selected.label; // Store the selected program name
          if (foundPackageName) {
            packageName = foundPackageName;
            isAnchor = true; // Set the project as Anchor
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
              isAnchor = true; // Set the project as Anchor
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

          const executablePath = `${depsPath}/${executableFile}`; // holds the .debug file that needs to be loaded in agave-ledger-tool and used for generating function_address_map

          console.log(projectFolderName);
          console.log(`Executable path: ${executablePath}`);
          console.log(`Executable file: ${executableFile}`);

          const bpfCompiledFile = findExecutableFile(files, packageName, ".so");
          const bpfCompiledPath = `${depsPath}/${bpfCompiledFile}`;
          globalBpfCompiledPath = bpfCompiledPath;

          console.log(`BPF compiled path: ${bpfCompiledPath}`);

          // This creates a function address map file (Where the address will be used to set breakpoints)
          // This will execute every time user runs `Run Solana LLDB Debugger` command, so every time the code compiles it will update the function address map
          functionAddressMapPath = path.join(os.tmpdir(), FUNCTION_ADDRESS_MAP_NAME) // Used TempDir
          const functionMapCommand = `llvm-objdump -t ${executablePath} --demangle | grep ' F ' | awk '{print $1, $6}' > ${functionAddressMapPath}`;
          exec(functionMapCommand, {cwd: workspaceFolder}, (error, stdout, stderr) => {
            if (error) {
              vscode.window.showErrorMessage(`Error generating function address map: ${stderr}`);
              return;
            }
            console.log(`Function address map generated: ${functionAddressMapName}`);
          })
       
          const debuggerCommand = "solana-lldb";

          const terminal = vscode.window.createTerminal("Solana LLDB Debugger");
          activeTerminal = terminal;
          terminal.show();
          terminal.sendText(debuggerCommand);

          setTimeout(() => {
            terminal.sendText(`target create ${executablePath}`);

            progress.report({ increment: 100, message: "Build complete!" });
            resolve(); // Complete the progress

            const allBreakpoints = vscode.debug.breakpoints;
            if (allBreakpoints && allBreakpoints.length > 0) {
              allBreakpoints.forEach((bp) => {
                if (bp.location) {
                  const line = bp.location.range.start.line + 1;
                  const functionName = getFunctionNameAtLine(bp.location.uri.fsPath, line);
                  if (!functionName) {
                    vscode.window.showErrorMessage(
                      `Could not find function name at line ${line} in ${bp.location.uri.fsPath}`
                    );
                    return;
                  }

                  const BpAddress = getAddressFromFunctionName(functionName);
                  if (!isAnchor) {
                    terminal.sendText(
                      `breakpoint set --name ${BpAddress}`
                    )
                  } else {
                    terminal.sendText(
                      `breakpoint set --address ${BpAddress}`
                    );
                  }

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
                  const functionName = getFunctionNameAtLine(bp.location.uri.fsPath, line);
                  if (!functionName) {
                    vscode.window.showErrorMessage(
                      `Could not find function name at line ${line} in ${bp.location.uri.fsPath}`
                    );
                    return;
                  }

                  const BpAddress = getAddressFromFunctionName(functionName);
                  if (!isAnchor) {
                    terminal.sendText(
                      `breakpoint set --name ${BpAddress}`
                    )
                  } else {
                    terminal.sendText(
                      `breakpoint set --address ${BpAddress}`
                    );
                  }
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
  const terminal = getTerminalByName("Solana LLDB Debugger");
  
  if (terminal) {
    activeTerminal = terminal;
    terminal.sendText("continue"); // Resume the process in the LLDB debugger (process launch -- --nocapture)
  } else {
    vscode.window.showErrorMessage("Solana LLDB Debugger terminal not found.");
    startSolanaDebugger();
  }
}

// ============== VSCODE COMMANDS ==============
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // This line of code will only be executed once when your extension is activated
  console.log("Gimlet is now active!");

  // This is automated script to check dependencies for Gimlet
  const setupDisposable = vscode.commands.registerCommand(
    "extension.runGimletSetup",
    () => {
      const scriptPath = path.join(__dirname, 'scripts/gimlet-setup.sh');
      
      // Create a terminal to show the beautiful output
      const terminal = vscode.window.createTerminal("Gimlet Setup");
      terminal.show();
      terminal.sendText(`bash "${scriptPath}"`);
    }
  );

  context.subscriptions.push(setupDisposable);

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

  const disposable4 = vscode.commands.registerCommand(
    "extension.runAgaveLedgerToolForBreakpoint",
    () => {
      runAgaveLedgerToolForBreakpoint();
    }
  );

  context.subscriptions.push(disposable4);
}

function deactivate() {
  if (breakpointListenerDisposable) {
    breakpointListenerDisposable.dispose();
    breakpointListenerDisposable = null;
  }
  activeTerminal = null;

  if (functionAddressMapPath && fs.existsSync(functionAddressMapPath)) {
    fs.unlinkSync(functionAddressMapPath); // Delete the function address map file
    functionAddressMapPath = null; // Clear the path after deletion
  }
}

module.exports = {
  activate,
  deactivate,
};

// ============== UTILITIES ==============
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

// This func is used to get the function name from a specific line in a file
// It reads the lib.rs file, tracks the function definitions, and returns the function name at the specified line number
function getFunctionNameAtLine(filePath, lineNumber) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let depth = 0
  let name = null;

  for (let i = 0; i < lines.length; i++) {
    if (/fn\s+(\w+)/.test(lines[i])) { 
      name = RegExp.$1; 
      depth = 0; 
    };

    depth += (lines[i].match(/{/g)||[]).length;
    depth -= (lines[i].match(/}/g)||[]).length;

    if (i + 1 === lineNumber) return depth > 0 ? name : null;
  }

  return null;
}

function runAgaveLedgerToolForBreakpoint() {
  // get all breakpoints
  const allBreakpoints = vscode.debug.breakpoints;
  const latestTerminal = getTerminalByName("Agave Ledger Tool");
  let bpObject = null;

  if (latestTerminal) {
    latestTerminal.dispose(); // closes the previous terminal if it exists
  }

  let lldbTerminal = getTerminalByName("Solana LLDB Debugger");
  if (!lldbTerminal) {
    vscode.window.showErrorMessage("Solana LLDB Debugger terminal not found. Use `Run Solana LLDB` from Command Pallette to start it!");
    return;
  }

  if (!allBreakpoints || allBreakpoints.length === 0) {
    vscode.window.showErrorMessage("No breakpoints found. Please set a breakpoint first.");
    return;
  }

  // if one breakpoint, just run it instantly
  if (allBreakpoints.length === 1) {
    const bp = allBreakpoints[0];
    if (bp.location) {
      const line = bp.location.range.start.line + 1;
      const functionName = getFunctionNameAtLine(bp.location.uri.fsPath, line);
      bpObject = bp;

      if (functionName) {
        runAgaveLedgerTool(globalWorkspaceFolder, globalBpfCompiledPath, functionName, globalInputPath, bpObject);
      } else {
        vscode.window.showErrorMessage("Breakpoint is not inside a function.");
      }
    }
    return;
  }

  // if more than one breakpoints, let user select one
  const breakpointOptions = allBreakpoints.filter(bp => bp.location)
    .map((bp, index) => {
      const line = bp.location.range.start.line + 1;
      const fileName = path.basename(bp.location.uri.fsPath);
      const functionName = getFunctionNameAtLine(bp.location.uri.fsPath, line);
      

       return {
        label: `${fileName}:${line}`,
        description: functionName ? `Function: ${functionName}` : "Not in a function",
        breakpoint: bp,
        functionName: functionName
      };
  });

  vscode.window.showQuickPick(breakpointOptions, {
    placeHolder: "Select a breakpoint to run agave-ledger-tool for"
  }).then(selected => {
    if (selected && selected.functionName) {
      bpObject = selected.breakpoint;
      runAgaveLedgerTool(globalWorkspaceFolder, globalBpfCompiledPath, selected.functionName, globalInputPath, bpObject);
    } else if (selected) {
      vscode.window.showErrorMessage("Selected breakpoint is not inside a function.");
    }
  });
}

// This function run the agave-ledger-tool with the provided parameters
function runAgaveLedgerTool(workspaceFolder, bpfCompiledPath, instructionName, inputPath, bpObject) {
  // I want if its multi program anchor project, to use path like `input/program_name/instruction_name.json`
  // If its single program anchor project, then use path like `input/instruction_name.json
  let instructionInput = `${inputPath}/${instructionName}.json`;
  if (selectedAnchorProgramName) {
    instructionInput = `${inputPath}/${selectedAnchorProgramName}/${instructionName}.json`;
  }
  
  if (!fs.existsSync(instructionInput)) {
    vscode.window.showErrorMessage(`Instruction input file not found: ${instructionInput}`);
    return;
  }
  
  const agaveLedgerToolCommand = `agave-ledger-tool program run ${bpfCompiledPath} --ledger ledger --mode debugger -i ${instructionInput}`;
  
  const agaveTerminal = vscode.window.createTerminal("Agave Ledger Tool");
  agaveTerminal.show();
  agaveTerminal.sendText(agaveLedgerToolCommand);

  // Connect to the Solana LLDB Debugger terminal
  // Wait some time before connecting LLDB to ensure agave-ledger-tool is ready
  setTimeout(() => {
    connectSolanaLLDBToAgaveLedgerTool();

    // Remove and re-add the specific breakpoint
    // Note: Implemented because of the `agave-ledger-tool`, needs to set the breakpoint after i have connected to the gdb-remote server
    vscode.debug.removeBreakpoints([bpObject]);
    setTimeout(() => {
      vscode.debug.addBreakpoints([bpObject]);
      console.log('Breakpoint re-added:', bpObject.location);
    }, 1000); // small delay to ensure removal is processed

  }, 5000); 
}


function connectSolanaLLDBToAgaveLedgerTool() {
  const terminal = getTerminalByName("Solana LLDB Debugger");

  if (isLldbConnected) {
    terminal.sendText("process detach"); // Detach from the previous process if already connected
  }
  
  if (terminal) {
    activeTerminal = terminal;
    terminal.sendText(`gdb-remote 127.0.0.1:9001`); // Connect to the gdb server that agave-ledger-tool started on 
    isLldbConnected = true; // Set the connection status to true
  };
}

function getTerminalByName(name) {
  return vscode.window.terminals.find((terminal) => terminal.name === name);
}

// This takes the `address` from the map file for a given function name
function getAddressFromFunctionName(functionName) {
  // const mapFilePath = path.join(globalWorkspaceFolder, functionAddressMapName);
  const mapFilePath = functionAddressMapPath;
  const lines = fs.readFileSync(mapFilePath, "utf8").split("\n");
  for (const line of lines) {
    if (isAnchor) {
        // `global::` is Anchor's internal naming convention for an instruction discriminator
      if (line.match(new RegExp(`global::${functionName}(::|$)`))) {
        return line.split(' ')[0]; // Return the address part of the line
      }
    } else {
      /**
       * Note: This is for native Solana programs.
       * If the user uses the `#[no_mangle]` attribute, the function name will be preserved as is.
       * If the user uses the `#[inline(never)]` attribute, they will be able to debug the function.
       * (This is necessary if the function is too simple and Rust optimizes logic at compile time.)
       */
      // TODO: Find a way to handle this without making the user to use `#[no_mangle]` and `#[inline(never)]` macros
      if (line.match(new RegExp(`${functionName}`))) {
      /**
       * Note: If we use the raw address instead of the function name, Solana sometimes remaps
       * this address in LLDB to another (invalid) address. This can cause breakpoints to be set
       * incorrectly or not trigger as expected. Using the function name is more reliable for
       * setting breakpoints in this context.
       */
        return functionName;
      }
    }
  }
  return null;
}
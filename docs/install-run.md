## Install Gimlet

- Open VS Marketplace
- Search Solana step debugger or click this [link](https://marketplace.visualstudio.com/items?itemName=limechain.solana-step-debugger)
- Install
- Restart VS Code if necessary

## Steps to Debug a Solana Program

1. **Launch the Debugger**:

   - Press `Cmd + Shift + P` (on Mac) or `Ctrl + Shift + P` (on Windows).
   - Select `Run Solana LLDB` from the command palette.
   - This will launch the debugger and run the file that is currently open in the VSCode window.

2. **Add Breakpoints**:

   - After the file has run, you can add breakpoints.
   - To add a breakpoint, you can click on a row in the breakpoint area or press `F9`.
   - You can add and remove breakpoints, and commands will automatically be executed in the Solana LLDB terminal to reflect these changes.
   - **Note**: If the debugger is stopped, you will need to add all of the breakpoints again.

3. **Re-run the Debugger**:

   - Press `Cmd + Shift + P` (on Mac) or `Ctrl + Shift + P` (on Windows) again.
   - Select `Re-run process launch` to run the debugger with the breakpoints.

4. **Hit Breakpoints**:
   - When a breakpoint is hit, you will see the memory address location, frame, file, and row of the breakpoint in the terminal.
   - To continue execution, type `continue` in the terminal.
   - The program execution will continue to the next breakpoint or until it finishes.

## Running the Example Project

To run the example project, follow these steps:

1. Open a terminal in the `example-project/solana_test_extension` folder.
2. Open the `lib.rs` file located in the `src` directory.
3. Press `Cmd + Shift + P` (on Mac) or `Ctrl + Shift + P` (on Windows) to open the Command Palette.
4. Select `Run Solana LLDB` from the Command Palette.
5. A popup will appear in the right corner with the message "Target folder not found. Cargo is installing necessary tools." Wait while Cargo installs the necessary tools.
6. Once the installation is complete, the debugger will automatically start and execute the program.
7. After the program finishes executing, you can set breakpoints and run it again using the Command Pallette and selecting `Re-run process launch`

## Additional LLDB Commands

Refer to this site [LLDB Commands](https://lldb.llvm.org/use/map.html)

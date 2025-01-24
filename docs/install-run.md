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

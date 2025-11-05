const vscode = require('vscode');

const LENS_TITLE= "Sbpf Debug";

// Custom CodeLens provider that shows "Gimlet Debug" button above Rust test functions
class GimletCodeLensProvider {
    // Vs code calls this method automatically 
    // whenever it needs to show or update CodeLens annotations in the editor for supported files.
    provideCodeLenses(document) {
    const lenses = [];
    const isRust = document.languageId === 'rust';
    const isTypeScript = document.languageId === 'typescript';

    if (isRust) {
        return vscode.commands.executeCommand(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        ).then(symbols => {
            if (!symbols) return lenses;

            // Recursively process symbols to find test functions
            const processSymbols = (symbols) => {
                for (const symbol of symbols) {
                    if (symbol.kind === vscode.SymbolKind.Function) {
                        const functionName = symbol.name;
                        const line = symbol.range.start.line;

                        if (this.hasTestAttribute(document, line, functionName)) {
                            lenses.push(
                                new vscode.CodeLens(symbol.range, {
                                    title: `$(debug-alt) ${LENS_TITLE}`,
                                    command: "gimlet.debugAtLine",
                                    arguments: [document, line],
                                })
                            );
                        }
                    }
                    if (symbol.children && symbol.children.length > 0) {
                        processSymbols(symbol.children);
                    }
                }
            };
            processSymbols(symbols);
            return lenses;
        });
        
    } else if (isTypeScript) {
        return vscode.commands.executeCommand(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        ).then(symbols => {
            if (!symbols) return lenses;
            // Recursively process symbols to find describe/it/test blocks
            const processSymbols = (symbols) => {
                for (const symbol of symbols) {
                    if (symbol.name && /^(describe)\b/i.test(symbol.name)) {
                        const range = symbol.range;
                        const functionName = this.extractTestNameFromSymbolName(symbol.name);
                        const TS_LENS_TITLE = 'Sbpf Debug All';
                        const line = range.start.line;

                        lenses.push(
                            new vscode.CodeLens(range, {
                                title: `$(debug-alt) ${TS_LENS_TITLE}`,
                                command: "gimlet.debugAtLine",
                                arguments: [document, line],
                            })
                        );
                    }
                    if (symbol.children && symbol.children.length > 0) {
                        processSymbols(symbol.children);
                    }
                }
            };
            processSymbols(symbols);
            return lenses;
        });
    }

    return lenses;
}
    /**
     * Checks for test-related attributes above a function
     */
    hasTestAttribute(document, lineIndex) {
        for (let i = lineIndex; i >= 0; i--) {
            const line = document.lineAt(i);
            const trimmed = line.text.trim();

            // Check for various test attributes
            const testAttributes = [
                /#\[test\]/,
                /#\[tokio::test\]/,
            ];

            if (testAttributes.some(attr => attr.test(trimmed))) {
                return true;
            }

            // Skip empty lines, comments, and other attributes
            if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#[")) {
                continue;
            }

            // Hit non-attribute code, stop searching
            break;
        }

        return false;
    }

    extractTestNameFromSymbolName(symbolName) {
        // Matches it("name"), test('name'), describe(`name`)
        const match = symbolName.match(/^(?:it|test|describe)\s*\(\s*['"`](.+?)['"`]\s*\)/);
        return match ? match[1] : symbolName;
    }
}

module.exports = {
    GimletCodeLensProvider
}
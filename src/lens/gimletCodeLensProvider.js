const vscode = require('vscode');

const LENS_TITLE = "Sbpf Debug";
const TEST_ATTR_PATTERNS = [/#\[test\]/, /#\[tokio::test\]/];
const FN_PATTERN = /^\s*(pub\s+)?(async\s+)?fn\s+(\w+)/;

class GimletCodeLensProvider {
    provideCodeLenses(document) {
        const lenses = [];

        if (document.languageId === 'rust') {
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i).text.trim();

                if (TEST_ATTR_PATTERNS.some(attr => attr.test(line))) {
                    // Find the fn line after the attribute
                    for (let j = i + 1; j < document.lineCount; j++) {
                        const fnLine = document.lineAt(j).text;
                        const trimmed = fnLine.trim();

                        // Skip empty lines, comments, more attributes
                        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#[')) continue;

                        const match = FN_PATTERN.exec(fnLine);
                        if (match) {
                            const attrRange = new vscode.Range(i, 0, i, document.lineAt(i).text.length);
                            lenses.push(new vscode.CodeLens(attrRange, {
                                title: `$(debug-alt) ${LENS_TITLE}`,
                                command: 'gimlet.debugAtLine',
                                arguments: [document, j],
                            }));
                        }
                        break;
                    }
                }
            }
        } else if (document.languageId === 'typescript') {
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i).text;
                if (/\bdescribe\s*\(/.test(line)) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    lenses.push(new vscode.CodeLens(range, {
                        title: `$(debug-alt) Sbpf Debug All`,
                        command: 'gimlet.debugAtLine',
                        arguments: [document, i],
                    }));
                }
            }
        }

        return lenses;
    }
}

module.exports = { GimletCodeLensProvider };

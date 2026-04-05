import * as Diff from 'diff';
export function computeDiff(oldContent, newContent) {
    const changes = Diff.diffLines(oldContent, newContent);
    const hunks = [];
    let currentHunk = null;
    let oldLineNum = 1;
    let newLineNum = 1;
    let hasChanges = false;
    for (const change of changes) {
        if (change.added || change.removed) {
            hasChanges = true;
        }
        const lines = change.value.split('\n');
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        if (change.added) {
            if (!currentHunk) {
                currentHunk = {
                    oldStart: oldLineNum,
                    oldLines: 0,
                    newStart: newLineNum,
                    newLines: 0,
                    lines: []
                };
            }
            for (const line of lines) {
                currentHunk.lines.push(`+ ${line}`);
                currentHunk.newLines++;
                newLineNum++;
            }
        }
        else if (change.removed) {
            if (!currentHunk) {
                currentHunk = {
                    oldStart: oldLineNum,
                    oldLines: 0,
                    newStart: newLineNum,
                    newLines: 0,
                    lines: []
                };
            }
            for (const line of lines) {
                currentHunk.lines.push(`- ${line}`);
                currentHunk.oldLines++;
                oldLineNum++;
            }
        }
        else {
            if (currentHunk) {
                hunks.push(currentHunk);
                currentHunk = null;
            }
            oldLineNum += lines.length;
            newLineNum += lines.length;
        }
    }
    if (currentHunk) {
        hunks.push(currentHunk);
    }
    return { hunks, hasChanges };
}
export function formatDiff(oldContent, newContent) {
    const { hunks } = computeDiff(oldContent, newContent);
    if (hunks.length === 0)
        return '';
    let result = '--- original\n+++ modified\n';
    for (const hunk of hunks) {
        result += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
        result += hunk.lines.join('\n') + '\n';
    }
    return result;
}
export function applyDiff(content, diff) {
    const lines = content.split('\n');
    let result = [];
    let oldLineNum = 1;
    let hunkIndex = 0;
    let diffLineIndex = 0;
    while (oldLineNum <= lines.length || hunkIndex < diff.hunks.length) {
        if (hunkIndex >= diff.hunks.length) {
            result.push(...lines.slice(oldLineNum - 1));
            break;
        }
        const hunk = diff.hunks[hunkIndex];
        if (oldLineNum < hunk.oldStart) {
            result.push(...lines.slice(oldLineNum - 1, hunk.oldStart - 1));
            oldLineNum = hunk.oldStart;
        }
        if (oldLineNum === hunk.oldStart) {
            const hunkLines = [];
            while (diffLineIndex < hunk.lines.length) {
                const line = hunk.lines[diffLineIndex];
                if (line.startsWith('- ')) {
                    oldLineNum++;
                    diffLineIndex++;
                }
                else if (line.startsWith('+ ')) {
                    hunkLines.push(line.slice(2));
                    diffLineIndex++;
                }
                else {
                    break;
                }
            }
            result.push(...hunkLines);
            if (diffLineIndex >= hunk.lines.length) {
                hunkIndex++;
                diffLineIndex = 0;
            }
        }
    }
    return result.join('\n');
}
export function applyPatch(original, patch) {
    const changes = Diff.diffLines(original, patch);
    let result = '';
    for (const change of changes) {
        result += change.value;
    }
    return result;
}
export function rollbackPatch(original, patch) {
    const changes = Diff.diffLines(patch, original);
    let result = '';
    for (const change of changes) {
        result += change.value;
    }
    return result;
}
//# sourceMappingURL=compute.js.map
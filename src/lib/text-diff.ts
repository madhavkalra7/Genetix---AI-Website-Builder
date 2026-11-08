/**
 * Small line-based diff (Myers O((N+M)·D)) producing unified-diff style lines.
 * No dependencies; bounded work so huge or wildly different files can't stall the server.
 */

export type DiffOp = { type: "equal" | "add" | "del"; line: string };

/** Files longer than this (in lines, either side) are not line-diffed. */
export const MAX_DIFF_LINES = 5000;
/** Give up when the edit distance exceeds this (the diff would be unreadable anyway). */
const MAX_EDIT_DISTANCE = 2000;
/** Hard cap on lines returned for a single file. */
const MAX_OUTPUT_LINES = 3000;

export const splitLines = (text: string): string[] => {
    const normalized = text.replace(/\r\n?/g, "\n");
    if (normalized === "") return [];
    const lines = normalized.split("\n");
    // A trailing newline should not produce a phantom empty last line
    if (lines[lines.length - 1] === "") lines.pop();
    return lines;
};

/** Myers shortest edit script between two line arrays, or null if over budget. */
export function diffLines(a: string[], b: string[], maxD = MAX_EDIT_DISTANCE): DiffOp[] | null {
    // Trim the common prefix/suffix first: most edits are local
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
        endA--;
        endB--;
    }

    const prefix: DiffOp[] = a.slice(0, start).map((line) => ({ type: "equal", line }));
    const suffix: DiffOp[] = a.slice(endA).map((line) => ({ type: "equal", line }));
    const A = a.slice(start, endA);
    const B = b.slice(start, endB);
    const n = A.length;
    const m = B.length;

    let middle: DiffOp[];
    if (n === 0) {
        middle = B.map((line) => ({ type: "add", line }));
    } else if (m === 0) {
        middle = A.map((line) => ({ type: "del", line }));
    } else {
        const max = n + m;
        const limit = Math.min(max, maxD);
        const offset = max + 1;
        const v = new Int32Array(2 * max + 3);
        v[offset + 1] = 0;
        // trace[d] = snapshot of v for k in [-d-1, d+1] taken before step d
        const trace: Int32Array[] = [];
        let found = -1;

        outer: for (let d = 0; d <= limit; d++) {
            trace.push(v.slice(offset - d - 1, offset + d + 2));
            for (let k = -d; k <= d; k += 2) {
                let x: number;
                if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
                    x = v[offset + k + 1];
                } else {
                    x = v[offset + k - 1] + 1;
                }
                let y = x - k;
                while (x < n && y < m && A[x] === B[y]) {
                    x++;
                    y++;
                }
                v[offset + k] = x;
                if (x >= n && y >= m) {
                    found = d;
                    break outer;
                }
            }
        }

        if (found === -1) return null;

        const ops: DiffOp[] = [];
        let x = n;
        let y = m;
        for (let d = found; d > 0; d--) {
            const snap = trace[d];
            const at = (k: number) => snap[k + d + 1];
            const k = x - y;
            const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
            const prevX = at(prevK);
            const prevY = prevX - prevK;
            while (x > prevX && y > prevY) {
                ops.push({ type: "equal", line: A[x - 1] });
                x--;
                y--;
            }
            if (x === prevX) {
                ops.push({ type: "add", line: B[y - 1] });
                y--;
            } else {
                ops.push({ type: "del", line: A[x - 1] });
                x--;
            }
        }
        while (x > 0 && y > 0) {
            ops.push({ type: "equal", line: A[x - 1] });
            x--;
            y--;
        }
        middle = ops.reverse();
    }

    return [...prefix, ...middle, ...suffix];
}

/**
 * Unified diff lines: "@@ -a,b +c,d @@" headers, then lines prefixed with " ", "-" or "+".
 * Returns null when the inputs are too large/different to diff cheaply.
 */
export function unifiedDiff(before: string, after: string, context = 3): string[] | null {
    const a = splitLines(before);
    const b = splitLines(after);
    if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) return null;

    const ops = diffLines(a, b);
    if (!ops) return null;

    // Indices of changed ops; group them into hunks with `context` lines around
    const changed: number[] = [];
    ops.forEach((op, i) => {
        if (op.type !== "equal") changed.push(i);
    });
    if (changed.length === 0) return [];

    const out: string[] = [];
    let i = 0;
    while (i < changed.length) {
        const hunkStart = Math.max(0, changed[i] - context);
        let hunkEnd = Math.min(ops.length - 1, changed[i] + context);
        let j = i + 1;
        while (j < changed.length && changed[j] - context <= hunkEnd + 1) {
            hunkEnd = Math.min(ops.length - 1, changed[j] + context);
            j++;
        }

        // Line numbers at hunk start
        let oldLine = 1;
        let newLine = 1;
        for (let p = 0; p < hunkStart; p++) {
            if (ops[p].type !== "add") oldLine++;
            if (ops[p].type !== "del") newLine++;
        }
        let oldCount = 0;
        let newCount = 0;
        const body: string[] = [];
        for (let p = hunkStart; p <= hunkEnd; p++) {
            const op = ops[p];
            if (op.type === "equal") {
                body.push(" " + op.line);
                oldCount++;
                newCount++;
            } else if (op.type === "del") {
                body.push("-" + op.line);
                oldCount++;
            } else {
                body.push("+" + op.line);
                newCount++;
            }
        }
        out.push(`@@ -${oldCount ? oldLine : oldLine - 1},${oldCount} +${newCount ? newLine : newLine - 1},${newCount} @@`);
        out.push(...body);

        if (out.length > MAX_OUTPUT_LINES) {
            out.length = MAX_OUTPUT_LINES;
            out.push("@@ diff truncated @@");
            break;
        }
        i = j;
    }
    return out;
}

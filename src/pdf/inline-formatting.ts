export interface FormattedSegment {
    text: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    note: boolean;
}

type MarkerKind = "***" | "**" | "*" | "_" | "[[" | "]]";

interface TextToken { type: "text"; value: string }
interface MarkerToken { type: "marker"; kind: MarkerKind; valid: boolean }
type Token = TextToken | MarkerToken;

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let buf = "";
    const flush = () => {
        if (buf.length > 0) {
            tokens.push({ type: "text", value: buf });
            buf = "";
        }
    };
    let i = 0;
    while (i < input.length) {
        const c = input[i];
        if (c === "\\" && (input[i + 1] === "*" || input[i + 1] === "_")) {
            buf += input[i + 1];
            i += 2;
            continue;
        }
        if (c === "[" && input[i + 1] === "[") {
            flush();
            tokens.push({ type: "marker", kind: "[[", valid: false });
            i += 2;
            continue;
        }
        if (c === "]" && input[i + 1] === "]") {
            flush();
            tokens.push({ type: "marker", kind: "]]", valid: false });
            i += 2;
            continue;
        }
        if (c === "*") {
            flush();
            if (input[i + 1] === "*" && input[i + 2] === "*") {
                tokens.push({ type: "marker", kind: "***", valid: false });
                i += 3;
            } else if (input[i + 1] === "*") {
                tokens.push({ type: "marker", kind: "**", valid: false });
                i += 2;
            } else {
                tokens.push({ type: "marker", kind: "*", valid: false });
                i += 1;
            }
            continue;
        }
        if (c === "_") {
            flush();
            tokens.push({ type: "marker", kind: "_", valid: false });
            i += 1;
            continue;
        }
        buf += c;
        i++;
    }
    flush();
    return tokens;
}

function pairMarkers(tokens: Token[]): void {
    const pending: { [k: string]: number | undefined } = {};
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type !== "marker") continue;

        if (tok.kind === "[[") {
            if (pending["[["] === undefined) pending["[["] = i;
            continue;
        }
        if (tok.kind === "]]") {
            const opener = pending["[["];
            if (opener !== undefined) {
                (tokens[opener] as MarkerToken).valid = true;
                tok.valid = true;
                pending["[["] = undefined;
            }
            continue;
        }

        const kind = tok.kind;
        if (pending[kind] === undefined) {
            pending[kind] = i;
        } else {
            (tokens[pending[kind]!] as MarkerToken).valid = true;
            tok.valid = true;
            pending[kind] = undefined;
        }
    }
}

export function parseInlineFormatting(input: string): FormattedSegment[] {
    if (input.length === 0) return [];

    const tokens = tokenize(input);
    pairMarkers(tokens);

    const segments: FormattedSegment[] = [];
    const state: Omit<FormattedSegment, "text"> = {
        bold: false, italic: false, underline: false, note: false,
    };

    const push = (text: string) => {
        if (text.length === 0) return;
        const last = segments[segments.length - 1];
        if (
            last &&
            last.bold === state.bold &&
            last.italic === state.italic &&
            last.underline === state.underline &&
            last.note === state.note
        ) {
            last.text += text;
        } else {
            segments.push({ ...state, text });
        }
    };

    for (const tok of tokens) {
        if (tok.type === "text") {
            push(tok.value);
            continue;
        }
        if (!tok.valid) {
            push(tok.kind);
            continue;
        }
        switch (tok.kind) {
            case "***": state.bold = !state.bold; state.italic = !state.italic; break;
            case "**":  state.bold = !state.bold; break;
            case "*":   state.italic = !state.italic; break;
            case "_":   state.underline = !state.underline; break;
            case "[[":  state.note = true; break;
            case "]]":  state.note = false; break;
        }
    }

    return segments;
}

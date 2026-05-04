import * as afterparser from "../afterwriting-parser";
import { FountainConfig } from "../configloader";

const cfg = (overrides: Partial<FountainConfig> = {}): FountainConfig =>
    ({ print_notes: false, ...overrides } as FountainConfig);

const dialogueTokens = (parsed: afterparser.parseoutput) =>
    parsed.tokens.filter((t) =>
        ["dialogue_begin", "dialogue_end", "character", "dialogue", "parenthetical"].includes(t.type)
    );

describe("Dialogue with two-space empty-line sentinel", () => {

    const script = [
        "DEALER",
        "First paragraph.",
        "  ",
        "Second paragraph.",
        "  ",
        "Third paragraph.",
    ].join("\n");

    it("preserves the empty line as a dialogue token (print_notes=false, default)", () => {
        const parsed = afterparser.parse(script, cfg({ print_notes: false }), false);
        const dialogues = parsed.tokens.filter((t) => t.type === "dialogue");
        expect(dialogues.map((t) => t.text)).toEqual([
            "First paragraph.",
            "  ",
            "Second paragraph.",
            "  ",
            "Third paragraph.",
        ]);
    }, 100);

    it("preserves the empty line as a dialogue token (print_notes=true)", () => {
        const parsed = afterparser.parse(script, cfg({ print_notes: true }), false);
        const dialogues = parsed.tokens.filter((t) => t.type === "dialogue");
        expect(dialogues.map((t) => t.text)).toEqual([
            "First paragraph.",
            "  ",
            "Second paragraph.",
            "  ",
            "Third paragraph.",
        ]);
    }, 100);

    it("keeps the speech as one dialogue block — does not split into multiple dialogue_begin/end pairs", () => {
        const parsed = afterparser.parse(script, cfg(), false);
        const begins = parsed.tokens.filter((t) => t.type === "dialogue_begin").length;
        const ends = parsed.tokens.filter((t) => t.type === "dialogue_end").length;
        const characters = parsed.tokens.filter((t) => t.type === "character").length;
        expect(begins).toBe(1);
        expect(ends).toBe(1);
        expect(characters).toBe(1);
    }, 100);

    it("emits the empty-line tokens in order between dialogue_begin and dialogue_end", () => {
        const parsed = afterparser.parse(script, cfg(), false);
        const types = dialogueTokens(parsed).map((t) => t.type);
        expect(types).toEqual([
            "dialogue_begin",
            "character",
            "dialogue",
            "dialogue",
            "dialogue",
            "dialogue",
            "dialogue",
            "dialogue_end",
        ]);
    }, 100);

    it("renders empty lines as <br> inside a single dialogue div in HTML output", () => {
        const parsed = afterparser.parse(script, cfg(), true);
        const openDivs = parsed.scriptHtml.match(/<div class="dialogue[" ]/g) || [];
        const brs = parsed.scriptHtml.match(/<br>/g) || [];
        expect(openDivs.length).toBe(1);
        expect(brs.length).toBe(2);
    }, 100);
});

describe("Action block regressions (should not be affected by the dialogue fix)", () => {

    it("ignores empty action lines (no spurious whitespace-only action token survives)", () => {
        const script = [
            "Some action.",
            "",
            "More action.",
        ].join("\n");
        const parsed = afterparser.parse(script, cfg(), false);
        const actions = parsed.tokens.filter((t) => t.type === "action");
        expect(actions.every((t) => t.text.trim().length > 0)).toBe(true);
    }, 100);
});

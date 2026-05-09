import { parseInlineFormatting, FormattedSegment } from "./inline-formatting";

const plain = (text: string): FormattedSegment => ({
    text, bold: false, italic: false, underline: false, note: false,
});

const bold = (text: string): FormattedSegment => ({
    text, bold: true, italic: false, underline: false, note: false,
});

const italic = (text: string): FormattedSegment => ({
    text, bold: false, italic: true, underline: false, note: false,
});

const underline = (text: string): FormattedSegment => ({
    text, bold: false, italic: false, underline: true, note: false,
});

const note = (text: string): FormattedSegment => ({
    text, bold: false, italic: false, underline: false, note: true,
});

describe("parseInlineFormatting — plain text and pass-through", () => {
    it("returns a single plain segment for text with no markers", () => {
        expect(parseInlineFormatting("hello world")).toEqual([plain("hello world")]);
    });

    it("returns an empty array for an empty string", () => {
        expect(parseInlineFormatting("")).toEqual([]);
    });
});

describe("parseInlineFormatting — paired markers (existing behavior must keep working)", () => {
    it("renders **bold** as bold", () => {
        expect(parseInlineFormatting("**bold**")).toEqual([bold("bold")]);
    });

    it("renders *italic* as italic", () => {
        expect(parseInlineFormatting("*italic*")).toEqual([italic("italic")]);
    });

    it("renders _underline_ as underline", () => {
        expect(parseInlineFormatting("_underline_")).toEqual([underline("underline")]);
    });

    it("renders ***bi*** as bold + italic", () => {
        expect(parseInlineFormatting("***bi***")).toEqual([
            { text: "bi", bold: true, italic: true, underline: false, note: false },
        ]);
    });

    it("renders mixed: pre **b** mid *i* post _u_ end", () => {
        expect(parseInlineFormatting("pre **b** mid *i* post _u_ end")).toEqual([
            plain("pre "),
            bold("b"),
            plain(" mid "),
            italic("i"),
            plain(" post "),
            underline("u"),
            plain(" end"),
        ]);
    });

    it("renders nested bold inside italic: *foo **bar** baz*", () => {
        expect(parseInlineFormatting("*foo **bar** baz*")).toEqual([
            italic("foo "),
            { text: "bar", bold: true, italic: true, underline: false, note: false },
            italic(" baz"),
        ]);
    });

    it("renders nested italic inside underline: _ita *lic* end_", () => {
        expect(parseInlineFormatting("_ita *lic* end_")).toEqual([
            underline("ita "),
            { text: "lic", bold: false, italic: true, underline: true, note: false },
            underline(" end"),
        ]);
    });
});

describe("parseInlineFormatting — escapes (existing behavior must keep working)", () => {
    it("renders \\* as a literal asterisk", () => {
        expect(parseInlineFormatting("a\\*b")).toEqual([plain("a*b")]);
    });

    it("renders \\_ as a literal underscore", () => {
        expect(parseInlineFormatting("a\\_b")).toEqual([plain("a_b")]);
    });

    it("renders escaped markers without affecting unrelated paired markers", () => {
        expect(parseInlineFormatting("see \\*not-italic\\* but *italic*")).toEqual([
            plain("see *not-italic* but "),
            italic("italic"),
        ]);
    });
});

describe("parseInlineFormatting — notes (existing behavior must keep working)", () => {
    it("marks [[note]] as note", () => {
        expect(parseInlineFormatting("pre [[a note]] post")).toEqual([
            plain("pre "),
            note("a note"),
            plain(" post"),
        ]);
    });

    it("note brackets are not output as text", () => {
        const segs = parseInlineFormatting("[[hi]]");
        const joined = segs.map(s => s.text).join("");
        expect(joined).toBe("hi");
    });
});

describe("parseInlineFormatting — UNPAIRED markers render as literal (the bug fix)", () => {
    it("a lone _ in <love_interest> renders as a literal underscore", () => {
        expect(parseInlineFormatting("<love_interest>")).toEqual([plain("<love_interest>")]);
    });

    it("a lone _ does NOT toggle underline on subsequent text", () => {
        const segs = parseInlineFormatting("foo_bar baz");
        // Everything must be plain — no underline state should leak.
        expect(segs.every(s => !s.underline)).toBe(true);
        expect(segs.map(s => s.text).join("")).toBe("foo_bar baz");
    });

    it("a lone * renders as a literal asterisk and does not flip italic", () => {
        const segs = parseInlineFormatting("hello *world is here");
        expect(segs.every(s => !s.italic && !s.bold)).toBe(true);
        expect(segs.map(s => s.text).join("")).toBe("hello *world is here");
    });

    it("a lone ** renders as literal asterisks", () => {
        const segs = parseInlineFormatting("a**b c");
        expect(segs.every(s => !s.bold && !s.italic)).toBe(true);
        expect(segs.map(s => s.text).join("")).toBe("a**b c");
    });

    it("a trailing lone _ after a complete _word_ pair stays literal", () => {
        // Parser uses greedy left-to-right pairing: first two _s pair up,
        // the third _ is lone and renders as a literal underscore.
        const segs = parseInlineFormatting("_a_ _b");
        expect(segs.map(s => s.text).join("")).toBe("a _b");
        const underlineSeg = segs.find(s => s.underline);
        expect(underlineSeg && underlineSeg.text).toBe("a");
    });

    it("THE BUG REPORT: <love_interest>. preceded by other text renders the underscore literally and does NOT underline anything after", () => {
        const input = "I have you to thank for convincing me to visit Florence instead Cancun, <love_interest>.";
        const segs = parseInlineFormatting(input);
        expect(segs.every(s => !s.underline)).toBe(true);
        expect(segs.map(s => s.text).join("")).toBe(input);
    });

    it("multiple lone underscores in a row each render literally", () => {
        const segs = parseInlineFormatting("a_b_c_d");
        // Three underscores. Greedy left-to-right pairing matches the first two as underline content "b",
        // leaves the third _ as literal. Total reproduces input minus markup brackets.
        expect(segs.every(s => !s.italic && !s.bold)).toBe(true);
        expect(segs.map(s => s.text).join("")).toBe("a" + "b" + "c_d");
    });
});

describe("parseInlineFormatting — combined / known-tricky cases", () => {
    it("does not treat ***foo** (3 then 2) as a valid pair", () => {
        // *** does not have a matching ***, ** does not have a matching **,
        // but *fo + o* could be seen as italic. Greedy left-to-right uses the
        // first marker shape, so ***foo** has no valid pairs.
        const segs = parseInlineFormatting("***foo**");
        const joined = segs.map(s => s.text).join("");
        expect(joined).toBe("***foo**");
        expect(segs.every(s => !s.bold && !s.italic && !s.underline)).toBe(true);
    });

    it("escaped marker inside paired markers stays literal", () => {
        expect(parseInlineFormatting("*it\\*alic*")).toEqual([italic("it*alic")]);
    });

    it("does not treat * inside a paired _..._ as italic if it has no matching *", () => {
        const segs = parseInlineFormatting("_a*b_");
        // Underline is paired; the lone * inside is literal.
        expect(segs.length).toBeGreaterThan(0);
        expect(segs.every(s => !s.italic)).toBe(true);
        const joined = segs.map(s => s.text).join("");
        expect(joined).toBe("a*b");
    });
});

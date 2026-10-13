const FONT = {
    B: ['### ', '#  #', '### ', '#  #', '### '],
    O: [' ## ', '#  #', '#  #', '#  #', ' ## '],
    U: ['#  #', '#  #', '#  #', '#  #', ' ## '],
    N: ['#  #', '## #', '# ##', '#  #', '#  #'],
    C: [' ###', '#   ', '#   ', '#   ', ' ###'],
    E: ['####', '#   ', '### ', '#   ', '####'],
    A: [' ## ', '#  #', '####', '#  #', '#  #'],
    T: ['####', ' ## ', ' ## ', ' ## ', ' ## '],
    S: [' ###', '#   ', ' ## ', '   #', '### '],
};
const GLYPH_W = 5; // 4 columns + 1 gap
const GLYPH_H = 6; // 5 rows + 1 gap

// Lays out text as a grid of ball positions, scaled to fit the screen width.
export function titleBalls(text, cx, cy, width) {
    const rows = text.split('\n');
    const cols = Math.max(...rows.map((r) => r.length)) * GLYPH_W;
    const cell = Math.min(20, (width * 0.9) / cols);
    const balls = [];

    rows.forEach((row, r) => {
        const y0 = cy + (r - rows.length / 2) * GLYPH_H * cell;
        let x0 = cx - (row.length * GLYPH_W * cell) / 2;
        for (const ch of row) {
            FONT[ch]?.forEach((line, j) => {
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '#') balls.push({ x: x0 + i * cell, y: y0 + j * cell });
                }
            });
            x0 += GLYPH_W * cell;
        }
    });
    return { balls, radius: cell / 2.5 };
}

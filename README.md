# Bounce Beats

Draw lines, drop balls, make lo-fi melodies. Zero dependencies, no build step: `public/` is the whole app.

## Run

```bash
bun start          # http://localhost:3000
bun run deploy     # Cloudflare Pages
```

## Controls

- **Drag** to draw a line (longer = lower note)
- **Click** to drop a ball, **hold** to place a spawner, **scroll** on a spawner to change its tempo
- **Drag** a line or spawner to move it, **click** it to select and delete it
- **Shift + drag** to select an area, then move, resize or delete
- **Sound** (the note button, or **E**): pick a theme (pentatonic, major, minor, lo-fi, Japanese) and an instrument (marimba, bell, keys, synth), and balance each note's volume by dragging its bar. **S** cycles the theme
- **Cmd+Z / Shift+Cmd+Z** (Ctrl on Windows/Linux) undo / redo, **Space** pause, **C** clear, **X** clear balls, **T** stats, **M** menu

Line lengths snap to exact notes, so everything is in tune. Your scene and sound are saved in the URL, so the link shares the whole song.

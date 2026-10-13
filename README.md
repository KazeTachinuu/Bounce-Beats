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
- **Scale** (the note button, or **S**): switch the mood between pentatonic, major, minor, blues and Japanese
- **Cmd+Z / Shift+Cmd+Z** (Ctrl on Windows/Linux) undo / redo, **Space** pause, **C** clear, **X** clear balls, **T** stats, **M** menu

Line lengths snap to exact notes, so everything is in tune. Your scene and scale are saved in the URL, so the link shares the whole song.

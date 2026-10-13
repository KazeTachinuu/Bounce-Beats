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
- **Cmd+Z / Shift+Cmd+Z** (Ctrl on Windows/Linux) undo / redo, **Space** pause, **C** clear, **X** clear balls, **T** stats, **M** menu

## Music

Open **Music** (the equalizer button, or **E**) to pick a scale and key, and set each note's level: drag across the bars to paint them, drag to the bottom to mute a note, double-click to reset. Bars light up as their notes play.

Your scene, scale, key and mix are saved in the URL, so the link shares the whole song.

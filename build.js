import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Create libs directory if it doesn't exist
const libsDir = join(process.cwd(), 'public', 'libs');
if (!existsSync(libsDir)) {
  mkdirSync(libsDir, { recursive: true });
}

// Copy Matter.js
const matterSource = join(process.cwd(), 'node_modules', 'matter-js', 'build', 'matter.min.js');
const matterDest = join(libsDir, 'matter.min.js');
copyFileSync(matterSource, matterDest);
console.log('✓ Copied matter.min.js');

// Copy Tone.js
const toneSource = join(process.cwd(), 'node_modules', 'tone', 'build', 'Tone.js');
const toneDest = join(libsDir, 'Tone.js');
copyFileSync(toneSource, toneDest);
console.log('✓ Copied Tone.js');

console.log('Build complete!');

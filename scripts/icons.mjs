import { copyFileSync, mkdirSync } from 'node:fs';
const icons = ['stack','user','sparkle','note','paperclip','archive','export','gear','magnifying-glass','sun','plus','caret-down','copy','pencil-simple','trash','dots-six-vertical','file-text','file-code','file-pdf','file','x','check','arrow-up','arrow-down','arrow-counter-clockwise','download-simple','upload-simple','info','leaf','lightbulb','warning','arrows-clockwise','shield','trend-up','flask','list','arrow-right','folder-open','image','clipboard-text'];
mkdirSync('src/assets/icons', { recursive: true });
for (const icon of icons) copyFileSync(`node_modules/@phosphor-icons/core/assets/regular/${icon}.svg`, `src/assets/icons/${icon}.svg`);

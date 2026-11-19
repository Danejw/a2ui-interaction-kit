import {copyFileSync, mkdirSync} from 'node:fs';
mkdirSync('dist/react', {recursive:true});
copyFileSync('src/react/styles.css', 'dist/react/styles.css');

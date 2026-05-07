import fs from 'fs';
import path from 'path';
import { generateLevel } from '../constants/levels';

async function run() {
    const startLevel = 1001;
    const maxLevels = 1500;
    const chunkSize = 50;

    const levelsDir = path.resolve(__dirname, '../assets/levels');
    if (!fs.existsSync(levelsDir)) fs.mkdirSync(levelsDir, { recursive: true });

    const startChunk = Math.floor((startLevel - 1) / chunkSize);
    const endChunk = Math.ceil(maxLevels / chunkSize) - 1;

    console.log(`Generating levels ${startLevel}-${maxLevels} (chunks ${startChunk}-${endChunk})...`);

    let newImports = '';
    let newRanges = '';

    for (let c = startChunk; c <= endChunk; c++) {
        const chunkLevels = [];
        const start = c * chunkSize + 1;
        const end = Math.min((c + 1) * chunkSize, maxLevels);

        for (let i = start; i <= end; i++) {
            const l = generateLevel(i);
            const { shape, ...rest } = l;
            chunkLevels.push(rest);
        }

        const chunkPath = path.join(levelsDir, `chunk-${c}.json`);
        fs.writeFileSync(chunkPath, JSON.stringify(chunkLevels, null, 2));
        console.log(`Wrote chunk-${c}.json (Levels ${start}-${end})`);

        newImports += `import chunk${c} from "./chunk-${c}.json";\n`;
        newRanges += `    if (id >= ${start} && id <= ${end}) return (chunk${c} as any[])[id - ${start}];\n`;
    }

    // Patch index.ts: append new imports at top and new ranges before `return null`
    const indexPath = path.join(levelsDir, 'index.ts');
    let indexContent = fs.readFileSync(indexPath, 'utf-8');
    indexContent = newImports + indexContent;
    indexContent = indexContent.replace('    return null;\n', newRanges + '    return null;\n');
    fs.writeFileSync(indexPath, indexContent);

    console.log(`\nSuccess! Added chunks ${startChunk}-${endChunk} and patched index.ts`);
}

run().catch(console.error);

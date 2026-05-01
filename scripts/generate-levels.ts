import fs from 'fs';
import path from 'path';
import { generateLevel } from '../constants/levels';

async function run() {
    console.log('Generating 1-1000 levels in chunks...');
    const maxLevels = 1000;
    const chunkSize = 50;
    const chunksCount = Math.ceil(maxLevels / chunkSize);

    const levelsDir = path.resolve(__dirname, '../assets/levels');
    if (!fs.existsSync(levelsDir)) fs.mkdirSync(levelsDir, { recursive: true });

    let indexTsContent = '';

    for (let c = 0; c < chunksCount; c++) {
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

        indexTsContent += `import chunk${c} from "./chunk-${c}.json";\n`;
    }

    indexTsContent += `\nexport function getStaticLevel(id: number): any | null {\n`;
    for (let c = 0; c < chunksCount; c++) {
        const start = c * chunkSize + 1;
        const end = Math.min((c + 1) * chunkSize, maxLevels);
        indexTsContent += `    if (id >= ${start} && id <= ${end}) return (chunk${c} as any[])[id - ${start}];\n`;
    }
    indexTsContent += `    return null;\n}\n`;

    fs.writeFileSync(path.join(levelsDir, 'index.ts'), indexTsContent);
    console.log(
        `\nSuccess! Wrote ${chunksCount} chunks and index.ts to assets/levels/`,
    );
}

run().catch(console.error);

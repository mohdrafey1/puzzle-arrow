import fs from "fs";
import { generateLevel } from "../constants/levels";

async function run() {
    console.log("Generating 100 levels to test size...");
    const levels = [];
    for (let i = 1; i <= 100; i++) {
        const l = generateLevel(i);
        // Strip out shape to save space, it can be recomputed easily
        const { shape, ...rest } = l;
        levels.push(rest);
        process.stdout.write(".");
        if (i % 50 === 0) console.log(` ${i}`);
    }

    fs.writeFileSync("/tmp/levels.json", JSON.stringify(levels));
    const stat = fs.statSync("/tmp/levels.json");
    console.log(`\nSize of 100 levels: ${(stat.size / 1024).toFixed(2)} KB`);
}

run().catch(console.error);

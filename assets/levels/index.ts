// Lazy chunk loading.
//
// Previously every chunk-*.json (~34 MB total) was imported statically at the
// top of this module, so the JS engine parsed and retained the ENTIRE 1,500
// level dataset in memory the moment this module was first referenced.
//
// Metro evaluates a module factory lazily on its first `require()`. By wrapping
// each chunk in a thunk with a *static* require string, only the chunks the
// player actually reaches are ever instantiated, and they are cached after the
// first access. Playing levels 1–50 now resides ~220 KB instead of ~34 MB.

const CHUNK_SIZE = 50;
const CHUNK_COUNT = 30; // chunks 0..29 → levels 1..1500

// Static require strings are required for Metro's dependency graph.
const CHUNK_LOADERS: (() => any[])[] = [
    () => require("./chunk-0.json"),
    () => require("./chunk-1.json"),
    () => require("./chunk-2.json"),
    () => require("./chunk-3.json"),
    () => require("./chunk-4.json"),
    () => require("./chunk-5.json"),
    () => require("./chunk-6.json"),
    () => require("./chunk-7.json"),
    () => require("./chunk-8.json"),
    () => require("./chunk-9.json"),
    () => require("./chunk-10.json"),
    () => require("./chunk-11.json"),
    () => require("./chunk-12.json"),
    () => require("./chunk-13.json"),
    () => require("./chunk-14.json"),
    () => require("./chunk-15.json"),
    () => require("./chunk-16.json"),
    () => require("./chunk-17.json"),
    () => require("./chunk-18.json"),
    () => require("./chunk-19.json"),
    () => require("./chunk-20.json"),
    () => require("./chunk-21.json"),
    () => require("./chunk-22.json"),
    () => require("./chunk-23.json"),
    () => require("./chunk-24.json"),
    () => require("./chunk-25.json"),
    () => require("./chunk-26.json"),
    () => require("./chunk-27.json"),
    () => require("./chunk-28.json"),
    () => require("./chunk-29.json"),
];

// Cache resolved chunks so each is parsed at most once.
const chunkCache: (any[] | undefined)[] = new Array(CHUNK_COUNT);

function getChunk(chunkIndex: number): any[] | null {
    if (chunkIndex < 0 || chunkIndex >= CHUNK_COUNT) return null;
    if (!chunkCache[chunkIndex]) {
        try {
            chunkCache[chunkIndex] = CHUNK_LOADERS[chunkIndex]();
        } catch {
            return null;
        }
    }
    return chunkCache[chunkIndex] ?? null;
}

export function getStaticLevel(id: number): any | null {
    if (id < 1 || id > CHUNK_SIZE * CHUNK_COUNT) return null;
    const chunkIndex = Math.floor((id - 1) / CHUNK_SIZE);
    const chunk = getChunk(chunkIndex);
    if (!chunk) return null;
    return chunk[(id - 1) % CHUNK_SIZE] ?? null;
}

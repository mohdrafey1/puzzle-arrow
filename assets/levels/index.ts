import chunk0 from "./chunk-0.json";
import chunk1 from "./chunk-1.json";
import chunk2 from "./chunk-2.json";
import chunk3 from "./chunk-3.json";
import chunk4 from "./chunk-4.json";
import chunk5 from "./chunk-5.json";
import chunk6 from "./chunk-6.json";
import chunk7 from "./chunk-7.json";
import chunk8 from "./chunk-8.json";
import chunk9 from "./chunk-9.json";

export function getStaticLevel(id: number): any | null {
    if (id >= 1 && id <= 50) return (chunk0 as any[])[id - 1];
    if (id >= 51 && id <= 100) return (chunk1 as any[])[id - 51];
    if (id >= 101 && id <= 150) return (chunk2 as any[])[id - 101];
    if (id >= 151 && id <= 200) return (chunk3 as any[])[id - 151];
    if (id >= 201 && id <= 250) return (chunk4 as any[])[id - 201];
    if (id >= 251 && id <= 300) return (chunk5 as any[])[id - 251];
    if (id >= 301 && id <= 350) return (chunk6 as any[])[id - 301];
    if (id >= 351 && id <= 400) return (chunk7 as any[])[id - 351];
    if (id >= 401 && id <= 450) return (chunk8 as any[])[id - 401];
    if (id >= 451 && id <= 500) return (chunk9 as any[])[id - 451];
    return null;
}

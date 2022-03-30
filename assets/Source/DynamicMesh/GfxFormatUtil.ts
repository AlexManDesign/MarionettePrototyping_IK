import { gfx } from "cc";

export function getComponentByteLength (format: gfx.Format) {
    const info = gfx.FormatInfos[format];
    return info.size / info.count;
}

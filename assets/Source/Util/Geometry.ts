import { gfx, primitives } from "cc";

export function forceIndexed(geometry: primitives.IGeometry) {
    if (geometry.indices) {
        return geometry;
    }

    if (geometry.primitiveMode !== gfx.PrimitiveMode.TRIANGLE_LIST) {
        throw new Error(`Can not handle non-triangles.`);
    }

    geometry.indices = Array.from({ length: geometry.positions.length / 3 }, (_, i) => i);

    return geometry;
}
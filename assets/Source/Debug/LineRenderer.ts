import { builtinResMgr, Color, gfx, Material, Mesh, MeshRenderer, Node, utils, Vec2, Vec3, Vec4 } from "cc";

export class LineRenderer {
    constructor(renderRoot: Node, material: Material, color?: Color) {
        const defaultColor = color ?? Color.WHITE;
        const meshRenderer = renderRoot.addComponent(MeshRenderer);
        this._vertices = new Float32Array(LineRenderer._vertexStrideInFloat * 2);
        this.setColor(defaultColor);
        const mesh = meshRenderer.mesh = utils.createMesh({
            positions: new Array(3 * 2).fill(0.0),
            colors: [defaultColor, defaultColor].flatMap((c) => [c.x, c.y, c.z, c.w]),
            primitiveMode: gfx.PrimitiveMode.LINE_LIST,
        });
        meshRenderer.material = material;
        this._mesh = mesh;
        this._meshRenderer = meshRenderer;
    }

    public destroy() {
        this._meshRenderer.destroy();
    }

    public setEndings(from: Vec3, to: Vec3): void {
        Vec3.toArray(this._vertices, from, 0);
        Vec3.toArray(this._vertices, to, LineRenderer._vertexStrideInFloat);
    }

    public setColor(color: Color) {
        Vec4.toArray(this._vertices, color, LineRenderer._vertexColorStartInFloat);
        Vec4.toArray(this._vertices, color, LineRenderer._vertexColorStartInFloat + LineRenderer._vertexStrideInFloat);
    }

    public commit() {
        this._mesh.renderingSubMeshes[0].vertexBuffers[0].update(this._vertices);
    }

    private static _vertexStrideInFloat = 7;
    private static _vertexColorStartInFloat = 3;

    private _vertices: Float32Array;
    private _mesh: Mesh;
    private _meshRenderer: MeshRenderer;
}

export class DottedLineRenderer {
    constructor(renderRoot: Node, material: Material) {
        const meshRenderer = renderRoot.addComponent(MeshRenderer);
        this._vertices = new Float32Array(0);
        meshRenderer.material = material;
        this._meshRenderer = meshRenderer;
    }

    public destroy() {
        this._meshRenderer.destroy();
    }

    public addLine(from: Vec3, to: Vec3, color: Color) {
        this._lines.push({
            from: Vec3.clone(from),
            to: Vec3.clone(to),
            color: Color.clone(color),
        });
    }

    public clear() {
        this._lines.length = 0;
    }

    public commit() {
        this._update();
        const mesh = utils.MeshUtils.createMesh({
            positions: Array.from(this._vertices),
            colors: Array.from(this._colors),
            primitiveMode: gfx.PrimitiveMode.LINE_LIST,
        });
        this._meshRenderer.mesh = mesh;
    }

    private _vertices = new Float32Array();
    private _colors = new Float32Array();
    private _meshRenderer: MeshRenderer;
    private _dotSpace: number = 0.01;
    private _dotLength: number = 0.01;
    private _lines: Array<{
        from: Vec3;
        to: Vec3;
        color: Color;
    }> = [];

    private _update() {
        const {
            _lines: lines,
            _dotLength: dotLength,
            _dotSpace: dotSpace,
        } = this;
        const nLines = lines.length;
        const cell = dotLength + dotSpace;
        const lineVertices = Array.from({ length: nLines }, (_, iLine) => {
            const start = lines[iLine].from;
            const end = lines[iLine].to;
            const color = lines[iLine].color;
            const d = Vec3.distance(start, end);
            const division = d / cell;
            const nCompleteDots = Math.trunc(division);
            const dRemain = d - nCompleteDots * cell;
            const hasTail = dRemain <= dotLength;
            const nDots = hasTail ? nCompleteDots : nCompleteDots + 1;
            const pointStride = 3;
            const colorStride = 4;
            const vertices = new Float32Array(pointStride * 2 * nDots);
            const colors = new Float32Array(colorStride * 2 * nDots);
            const cellRatio = cell / d;
            const dotRatio = dotLength / d;
            const pCache = new Vec3();
            for (let iDot = 0; iDot < nCompleteDots; ++iDot) {
                const p1 = Vec3.lerp(pCache, start, end, cellRatio * iDot);
                Vec3.toArray(vertices, p1, pointStride * 2 * iDot);
                Color.toArray(colors, color, colorStride * 2 * iDot);

                const p2 = Vec3.lerp(pCache, start, end, cellRatio * iDot + dotRatio);
                Vec3.toArray(vertices, p2, pointStride * 2 * iDot + pointStride);
                Color.toArray(colors, color, colorStride * 2 * iDot + colorStride);
            }
            if (hasTail) {
                const p1 = Vec3.lerp(pCache, start, end, nCompleteDots * cell);
                Vec3.toArray(vertices, p1, pointStride * 2 * nCompleteDots);
                Color.toArray(colors, color, colorStride * 2 * nCompleteDots);

                Vec3.toArray(vertices, end, pointStride * 2 * nCompleteDots + pointStride);
                Color.toArray(colors, color, colorStride * 2 * nCompleteDots + colorStride);
            }
            return {
                vertices,
                colors,
            };
        });

        const nMeshVertices = lineVertices.reduce((v, { vertices }) => v += vertices.length, 0);
        const meshVertices = new Float32Array(nMeshVertices);
        let meshVerticesOffset = 0;
        for (const { vertices } of lineVertices) {
            meshVertices.set(vertices, meshVerticesOffset);
            meshVerticesOffset += vertices.length;
        }

        const nMeshColors = lineVertices.reduce((v, { colors }) => v += colors.length, 0);
        const meshColors = new Float32Array(nMeshColors);
        let meshColorsOffset = 0;
        for (const { colors } of lineVertices) {
            meshColors.set(colors, meshColorsOffset);
            meshColorsOffset += colors.length;
        }

        this._vertices = meshVertices;
        this._colors = meshColors;
    }
}

export class TriangleRenderer {
    constructor(renderRoot: Node) {
        const meshRenderer = renderRoot.addComponent(MeshRenderer);
        this._vertices = new Float32Array(0);
        const material = new Material();
        material.reset({
            effectName: 'builtin-standard',
            states: {
                rasterizerState: {
                    cullMode: gfx.CullMode.NONE,
                },
            },
        });
        meshRenderer.material = material;
        this._meshRenderer = meshRenderer;
    }

    public destroy() {
        this._meshRenderer.destroy();
    }

    public add(a: Vec3, b: Vec3, c: Vec3, color: Color) {
        this._triangles.push({
            a: Vec3.clone(a),
            b: Vec3.clone(b),
            c: Vec3.clone(c),
            color: Color.clone(color),
        });
    }

    public clear() {
        this._triangles.length = 0;
    }

    public commit() {
        this._update();
        const mesh = utils.MeshUtils.createMesh({
            positions: Array.from(this._vertices),
            colors: Array.from(this._colors),
            normals: Array.from(this._normals),
            primitiveMode: gfx.PrimitiveMode.TRIANGLE_LIST,
        });
        this._meshRenderer.mesh = mesh;
    }

    private _vertices = new Float32Array();
    private _normals = new Float32Array();
    private _colors = new Float32Array();
    private _meshRenderer: MeshRenderer;
    private _dotSpace: number = 0.01;
    private _dotLength: number = 0.01;
    private _triangles: Array<{
        a: Vec3;
        b: Vec3;
        c: Vec3;
        color: Color;
    }> = [];

    private _update() {
        const {
            _triangles: triangles,
        } = this;
        const nTriangles = triangles.length;
        const nVertices = 3 * nTriangles;
        const vertices = new Float32Array(3 * nVertices);
        const colors = new Float32Array(4 * nVertices);
        const normals = new Float32Array(3 * nVertices);
        for (let iTriangle = 0; iTriangle < nTriangles; ++iTriangle) {
            const {
                a,
                b,
                c,
                color,
            } = triangles[iTriangle];
            Vec3.toArray(vertices, a, 3 * 3 * iTriangle + 0);
            Vec3.toArray(vertices, b, 3 * 3 * iTriangle + 3);
            Vec3.toArray(vertices, c, 3 * 3 * iTriangle + 6);
            Color.toArray(colors, color, 4 * 3 * iTriangle + 0);
            Color.toArray(colors, color, 4 * 3 * iTriangle + 4);
            Color.toArray(colors, color, 4 * 3 * iTriangle + 8);
            const normal = Vec3.cross(
                new Vec3(),
                Vec3.subtract(new Vec3(), b, a).normalize(),
                Vec3.subtract(new Vec3(), c, a).normalize(),
            ).normalize();
            Vec3.toArray(normals, normal, 3 * 3 * iTriangle + 0);
            Vec3.toArray(normals, normal, 3 * 3 * iTriangle + 3);
            Vec3.toArray(normals, normal, 3 * 3 * iTriangle + 6);
        }
        this._vertices = vertices;
        this._colors = colors;
        this._normals = normals;
    }
}
import { Color, gfx, Material, Mesh, MeshRenderer, Node, utils, Vec3, Vec4 } from "cc";

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
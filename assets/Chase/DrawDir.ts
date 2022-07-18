import { _decorator, Component, Node, gfx, Material, Vec3, Color } from 'cc';
import { DottedLineRenderer, LineRenderer } from '../Source/Debug/LineRenderer';
const { ccclass, property } = _decorator;

@ccclass('DrawDir')
export class DrawDir extends Component {
    @property(Material)
    m!: Material;

    start() {
        const material = new Material();
        material.reset({
            effectName: 'builtin-unlit',
            states: {
                primitive: gfx.PrimitiveMode.LINE_LIST,
                rasterizerState: {
                    cullMode: gfx.CullMode.NONE,
                },
            },
            defines: {
                USE_VERTEX_COLOR: true,
            },
        });
        const node = new Node();
        this.node.scene.addChild(node);
        this._lineRenderer = new LineRenderer(node, material, Color.RED);

        const material2 = new Material();
        material2.reset({
            effectName: 'builtin-unlit',
            states: {
                primitive: gfx.PrimitiveMode.LINE_LIST,
                rasterizerState: {
                    cullMode: gfx.CullMode.NONE,
                },
            },
            defines: {
                USE_VERTEX_COLOR: true,
            },
        });
        const node2 = new Node();
        this.node.scene.addChild(node2);
        this._traceRenderer = new DottedLineRenderer(node2, material2);

        Vec3.copy(this._lastPos, this.node.worldPosition);
    }

    update(deltaTime: number) {
        this._lineRenderer.setEndings(
            this.node.worldPosition,
            Vec3.scaleAndAdd(new Vec3(), this.node.worldPosition, Vec3.transformQuat(new Vec3(), Vec3.UNIT_Z, this.node.worldRotation), 2.0),
        );
        this._lineRenderer.commit();

        const pos = this.node.worldPosition;
        if (!Vec3.strictEquals(pos, this._lastPos)) {
            this._traceRenderer.addLine(this._lastPos, pos, Color.BLACK);
            this._traceRenderer.commit();
            Vec3.copy(this._lastPos, pos);
        }
    }

    private declare _lineRenderer: LineRenderer;

    private declare _traceRenderer: DottedLineRenderer;

    private _lastPos = new Vec3();
}



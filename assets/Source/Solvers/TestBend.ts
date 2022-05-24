import { approx, Color, Component, Mat4, Material, Node, Quat, toRadian, Vec3, _decorator } from "cc";
import { LineRenderer } from "../Debug/LineRenderer";
import { quatMultiply } from "../Util/Math";

@_decorator.ccclass
class TestBend extends Component {
    @_decorator.property(Node)
    root!: Node;

    @_decorator.property(Material)
    material!: Material;

    private declare _g: Generator<void>;

    public start() {
        const g = this.test();
        // for (const _ of g) {

        // }

        this._g = g;
    }

    public step () {
        this._g.next();
    }

    *test() {
        const { root } = this;
        const chain = [
            root,
            root.children[0],
            root.children[0].children[0]
        ].reverse();

        const createChainRenderer = (color = Color.GREEN, translation = Vec3.ZERO) => {
            const renderRoot = new Node();
            renderRoot.parent = new Node();
            renderRoot.parent.parent = this.node;
            const linkRenderers: LineRenderer[] =[];
            const setEndings = (iLink: number, start: Vec3, end: Vec3) => {
                linkRenderers[iLink].setEndings(Vec3.add(new Vec3(), start, translation),  Vec3.add(new Vec3(), end, translation));
                linkRenderers[iLink].commit();
            };
            const setColor = (iLink: number, color: Color) => {
                linkRenderers[iLink].setColor(color);
                linkRenderers[iLink].commit();
            };
            chain.forEach((link, iLink) => {
                const linkRenderer = new LineRenderer(renderRoot, this.material, color);
                linkRenderers.push(linkRenderer);
                setEndings(iLink, link.getWorldPosition(), link.parent?.getWorldPosition() ?? new Vec3());
            });
            return {
                destroy() {
                    linkRenderers.forEach((linkRenderer) => linkRenderer.destroy());
                },
                setColor,
                setEndings,
            };
        };

        const createPositionTableRenderer = (color = Color.GREEN, translation = Vec3.ZERO) => {
            const renderRoot = new Node();
            renderRoot.parent = new Node();
            renderRoot.parent.parent = this.node;
            const linkRenderers: LineRenderer[] =[];
            const setEndings = (iLink: number, start: Vec3, end: Vec3) => {
                linkRenderers[iLink].setEndings(Vec3.add(new Vec3(), start, translation),  Vec3.add(new Vec3(), end, translation));
                linkRenderers[iLink].commit();
            };
            const setColor = (iLink: number, color: Color) => {
                linkRenderers[iLink].setColor(color);
                linkRenderers[iLink].commit();
            };
            chain.forEach((link, iLink) => {
                const linkRenderer = new LineRenderer(renderRoot, this.material, color);
                linkRenderers.push(linkRenderer);
                if (iLink !== chain.length - 1) {
                    setEndings(iLink, linkPositionTable[iLink + 1], linkPositionTable[iLink]);
                }
            });
            return {
                destroy() {
                    linkRenderers.forEach((linkRenderer) => linkRenderer.destroy());
                },
                setColor,
                setEndings,
            };
        };

        const backup = chain.map((link) => {
            return {
                position: link.getWorldPosition().clone(),
                rotation: link.getWorldRotation().clone(),
            };
        });

        chain[chain.length - 1].rotate(Quat.rotateZ(new Quat(), Quat.IDENTITY, toRadian(40.0)));
        chain[chain.length - 2].rotate(Quat.rotateX(new Quat(), Quat.IDENTITY, toRadian(30.0)));

        const linkPositionTable = chain.map((node) => {
            return node.getWorldPosition().clone();
        });

        for (let iLink = chain.length - 1; iLink >= 0; --iLink) {
            const { position, rotation } = backup[iLink];
            chain[iLink].setWorldPosition(position);
            chain[iLink].setWorldRotation(rotation);
        }

        const chainRenderer = createChainRenderer(Color.GREEN);

        const positionTableRenderer = createPositionTableRenderer(Color.BLACK);

        yield;

        const TRY: boolean = true;

        for (let iLink = chain.length - 1; iLink >= 0; --iLink) {
            if (iLink === chain.length - 1) {
                // chain[iLink].position = linkPositionTable[iLink];
            } else {
                chainRenderer?.setColor(iLink, Color.BLUE);
                yield;

                if (!TRY) {
                    const iParentLink = iLink + 1;
                    const originalLocalPoint = chain[iParentLink].inverseTransformPoint(new Vec3(), chain[iLink].worldPosition);
                    const expectedLocalPoint = chain[iParentLink].inverseTransformPoint(new Vec3(), linkPositionTable[iLink]);
                    const originalDir = originalLocalPoint;
                    Vec3.normalize(originalDir, originalDir);
                    const expectedDir = expectedLocalPoint;
                    Vec3.normalize(expectedDir, expectedDir);
                    const rotation = Quat.rotationTo(new Quat(), originalDir, expectedDir);
                    const finalRotation = Quat.multiply(new Quat(), chain[iParentLink].rotation, rotation);
                    chain[iParentLink].rotation = finalRotation;
                    chainRenderer?.setEndings(iLink, chain[iParentLink].getWorldPosition(), chain[iLink].getWorldPosition());
                } else {
                    // const oldWorld = chain[iLink].getWorldPosition().clone();
                    // const oldWorld2 = chain[iLink].inverseTransformPoint(new Vec3(), Vec3.ZERO);

                    // const iParentLink = iLink + 1;
                    // const node = chain[iLink];
                    // const worldRS = node.parent?.getWorldMatrix() ?? new Mat4();
                    // Mat4.multiply(worldRS, worldRS, Mat4.fromRTS(new Mat4(), node.rotation, Vec3.ZERO, node.scale));
                    // Mat4.invert(worldRS, worldRS);
                    // const originalLocalPoint = Vec3.transformMat4(
                    //     new Vec3(),
                    //     chain[iLink].worldPosition,
                    //     worldRS,
                    // );
                    // const expectedLocalPoint = Vec3.transformMat4(
                    //     new Vec3(),
                    //     linkPositionTable[iLink],
                    //     worldRS,
                    // );
                    // if (!approx(Vec3.lengthSqr(originalLocalPoint), Vec3.lengthSqr(expectedLocalPoint), 1e-5)) {
                    //     // debugger;
                    // }
                    // const originalDir = originalLocalPoint;
                    // Vec3.normalize(originalDir, originalDir);
                    // const expectedDir = expectedLocalPoint;
                    // Vec3.normalize(expectedDir, expectedDir);
                    // const rotation = Quat.rotationTo(new Quat(), originalDir, expectedDir);
                    // const finalRotation = quatMultiply(new Quat(), chain[iLink].rotation, rotation);
                    // chain[iLink].rotation = finalRotation;

                    // // const p = chain[iLink].position;
                    // // const eq = Vec3.equals(p, linkPositionTable[iLink], 1e-4);
                    // // if (!eq) {
                    // //     debugger;
                    // // }

                    // const pNewWorld = chain[iLink].getWorldPosition();
                    // // const pNewWorld2 = Vec3.transformMat4(new Vec3(), Vec3.ZERO, chain[iLink].getWorldMatrix());
                    // chainRenderer?.setEndings(iLink, chain[iParentLink].getWorldPosition(), pNewWorld);
                }
                yield;
                chainRenderer?.setColor(iLink, Color.GREEN);
            }
        }

        // chainRenderer.destroy();
    }
}
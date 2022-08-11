import { approx, clamp, Color, gfx, Material, math, MeshRenderer, Node, NodeSpace, primitives, Quat, toDegree, toRadian, utils, Vec3 } from "cc";
import { DottedLineRenderer, LineRenderer, TriangleRenderer } from "../Debug/LineRenderer";
import { IKResolveMethod, ResolveContext, ErrorCode } from "./ResolverBase";
import { Joint } from "./Skeleton";

const DEBUG: boolean = true;

const DEBUG_SMOOTH_ROTATION: boolean = true;

const USE_NEW = true;

export class TwoBoneIK extends IKResolveMethod {
    protected *solveChain(endFactor: Joint, chain: Joint[], target: math.Vec3, maxError: number, context: ResolveContext): Generator<void, number, unknown> {
        // https://theorangeduck.com/page/simple-two-joint
        
        if (chain.length < 2) {
            return ErrorCode.BAD_ARGUMENT;
        }

        const a = chain[1];
        const b = chain[0];
        const c = endFactor;
        
        return yield* this._solveTwoBone(a, b, c, target, context);
    }

    private *_solveTwoBone(a: Joint, b: Joint, c: Joint, target: math.Vec3, context: ResolveContext): Generator<void, number, unknown> {
        if (USE_NEW) {
            solveTwoBoneIK(
                a.node,
                b.node,
                c.node,
                target,
                context,
            );
            return ErrorCode.NO_ERROR;
        }

        // https://theorangeduck.com/page/simple-two-joint

        // console.debug(`Solving ${a.name}/${b.name}/${c.name}`);

        const pA = a.position;
        const pB = b.position;
        const pC = c.position;
        const t = target;
        const dAB = Vec3.distance(pA, pB);
        const dBC = Vec3.distance(pB, pC);
        const dAT = Vec3.distance(pA, t);
        if (dAT > dAB + dBC) {
            const vAT = Vec3.subtract(new Vec3(), t, pA).normalize();
            Vec3.multiplyScalar(t, vAT, dAB + dBC - 0.001);
            console.debug(`Too far`);
            // return ErrorCode.TWO_BONE_FAR_FROM_ROOT;
        }

        const angleBAC_2 = Math.acos(clamp(
            (dAB * dAB + dAT * dAT - dBC * dBC) / (2 * dAB * dAT),
            -1.0,
            1.0,
        ));
        const angleABC_2 = Math.acos(clamp(
            (dAB * dAB + dBC * dBC - dAT * dAT) / (2 * dAB * dBC),
            -1.0,
            1.0,
        ));

        const angleCAB = Vec3.angle(
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
            Vec3.subtract(new Vec3(), pB, pA).normalize(),
        );

        const axisCAB = Vec3.cross(
            new Vec3(),
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
            Vec3.subtract(new Vec3(), pB, pA).normalize(),
        );
        const lenAxisCAB = axisCAB.length();
        if (approx(lenAxisCAB, 0.0, 1e-3)) {
            console.log('a, b, c are lie in same line.');
            debugger;
        } else {
            axisCAB.normalize();
        }

        let debugLineRenderer: DottedLineRenderer | null = null;
        let debugTriangleRenderer: TriangleRenderer | null = null;
        let debugTriangleRenderer2: DottedLineRenderer | null = null;
        let normalRenderer: LineRenderer | null = null;
        let trianglePlaneNode: Node | null = null;

        if (DEBUG) {
            setupDebugTools();
            printAngles();
            yield;
        }

        // Now that we got desired B` for B
        // Just rotate joint A and B
        
        const rotate = (from: Vec3, to: Vec3, joint: Joint) => {
            if (DEBUG && DEBUG_SMOOTH_ROTATION) {
                rotateToSmooth(from, to, joint, () => {
                    drawTriangleABC();
                    drawTriangleABCNormal();
                });
            } else {
                const q = Quat.rotationTo(new Quat(), from, to);
                joint.node.rotate(q, NodeSpace.WORLD);
                if (DEBUG) {
                    drawTriangleABC();
                    drawTriangleABCNormal();
                }
            }
        };

        // Vector AB`
        const vAB2 = Vec3.subtract(new Vec3(), pC, pA).normalize();
        Vec3.transformQuat(vAB2, vAB2, Quat.fromAxisAngle(new Quat(), axisCAB, angleBAC_2));
        // Rotate ABC so AB overlap with AB`
        const vAB = Vec3.subtract(new Vec3(), pB, pA).normalize();
        rotate(
            vAB,
            vAB2,
            a,
        );
        if (DEBUG) {
            printAngles();
            yield;
        }

        // Vector B`C`
        const vB2C2 = Vec3.negate(new Vec3(), vAB2).normalize();
        Vec3.transformQuat(vB2C2, vB2C2, Quat.fromAxisAngle(new Quat(), axisCAB, angleABC_2));
        // Rotate ABC so C overlap with C`
        const vBC = Vec3.subtract(new Vec3(), c.position, b.position).normalize();
        rotate(
            vBC,
            vB2C2,
            b,
        );
        if (DEBUG) {
            printAngles();
            yield;
        }

        // Rotation CA -> TA
        const vAC2 = Vec3.subtract(new Vec3(), c.position, pA).normalize();
        const vAT = Vec3.subtract(new Vec3(), t, pA).normalize();
        // const axis = Vec3.cross(new Vec3(), vAC2, vAT).normalize();
        // const an = Vec3.angle(vAC2, vAT);
        // debugLineRenderer?.addLine(pA, Vec3.add(new Vec3(), pA, axis), Color.BLACK);
        // debugLineRenderer?.commit();
        // console.log(`${toDegree(an)}`);
        // yield;
        // const q = Quat.fromAxisAngle(new Quat(), axis, an);
        // const q = Quat.rotationTo(new Quat(), vAC2, vAT);
        // // a.rotation = Quat.multiply(new Quat(), a.rotation, q);
        // a.node.rotate(q, Node.NodeSpace.WORLD);
        // if (DEBUG) {
        //     drawTriangleABC();
        //     drawTriangleABCNormal();
        // }
        rotate(
            vAC2,
            vAT,
            a,
        );

        if (DEBUG) {
            printAngles();
            console.log(`${c.position} -> ${t}`);
            yield;
        }
        
        cleanupDebugTools();

        return ErrorCode.NO_ERROR;

        function setupDebugTools() {
            if (!context.debugLineMaterial) {
                return;
            }
            
            const lineRendererACNode = new Node('AC');
            context.node.addChild(lineRendererACNode);
            debugLineRenderer = new DottedLineRenderer(lineRendererACNode, context.debugLineMaterial);
            debugTriangleRenderer = new TriangleRenderer(lineRendererACNode);
            normalRenderer = new LineRenderer(lineRendererACNode, context.debugLineMaterial);
            debugTriangleRenderer2 = new DottedLineRenderer(lineRendererACNode, context.debugLineMaterial);

            drawDestinationTriangle();
            // drawTrianglePlane();

            debugLineRenderer.addLine(
                pA,
                t,
                Color.MAGENTA,
            );
            debugLineRenderer.commit();
            drawTriangleABC();
            drawTriangleABCNormal();
        }

        function cleanupDebugTools() {
            debugLineRenderer?.destroy();
            debugTriangleRenderer?.destroy();
            debugTriangleRenderer2?.destroy();
            normalRenderer?.destroy();
            trianglePlaneNode?.destroy();
        }

        function drawTrianglePlane() {
            trianglePlaneNode = new Node();
            context.node.addChild(trianglePlaneNode);
            const meshRenderer = trianglePlaneNode.addComponent(MeshRenderer);
            meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.plane());
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
            const normal = Vec3.cross(
                new Vec3(),
                Vec3.subtract(new Vec3(), pB, pA).normalize(),
                Vec3.subtract(new Vec3(), pC, pA).normalize(),
            ).normalize();
            trianglePlaneNode.rotate(Quat.rotationTo(
                new Quat(),
                Vec3.UP,
                normal,
            ));
            trianglePlaneNode.worldPosition = getTriangleCenter();
        }

        function drawDestinationTriangle() {
            if (!debugTriangleRenderer2) {
                return;
            }

            const b = Vec3.subtract(new Vec3(), pC, pA).normalize();
            Vec3.transformQuat(b, b, Quat.fromAxisAngle(new Quat(), axisCAB, angleBAC_2));
            Vec3.scaleAndAdd(b, pA, b, dAB);

            const c = Vec3.subtract(new Vec3(), pC, pA).normalize();
            Vec3.scaleAndAdd(c, pA, c, dAT);

            // const rotation_CA_TA = Quat.rotationTo(
            //     new Quat(),
            //     Vec3.subtract(new Vec3(), pC, pA).normalize(),
            //     Vec3.subtract(new Vec3(), t, pA).normalize(),
            // );
            // Vec3.transformQuat(b, b, rotation_CA_TA);
            // Vec3.transformQuat(c, c, rotation_CA_TA);

            console.log(`Destination triangle: A(${pA}) B(${b}) C(${c})`);
            console.log(`BC: ${Vec3.subtract(new Vec3(), c, b)}`);
            console.log(dAB, Vec3.distance(pA, b));
            console.log(dBC, Vec3.distance(b, c));
            console.log(dAT, Vec3.distance(pA, t));

            debugTriangleRenderer2.addLine(pA, b, Color.RED);
            debugTriangleRenderer2.addLine(b, c, Color.GREEN);
            debugTriangleRenderer2.addLine(c, pA, Color.BLUE);
            debugTriangleRenderer2.commit();
        }

        function getTriangleCenter() {
            const pA = a.position;
            const pB = b.position;
            const pC = c.position;
            const center = new Vec3(
                (pA.x + pB.x + pC.x) / 3.0,
                (pA.y + pB.y + pC.y) / 3.0,
                (pA.z + pB.z + pC.z) / 3.0,
            );
            return center;
        }

        function drawTriangleABCNormal() {
            const pA = a.position;
            const pB = b.position;
            const pC = c.position;
            const axisABC = Vec3.cross(
                new Vec3(),
                Vec3.subtract(new Vec3(), pB, pA).normalize(),
                Vec3.subtract(new Vec3(), pC, pA).normalize(),
            ).normalize();
            const center = new Vec3(
                (pA.x + pB.x + pC.x) / 3.0,
                (pA.y + pB.y + pC.y) / 3.0,
                (pA.z + pB.z + pC.z) / 3.0,
            );
            normalRenderer?.setColor(
                Color.BLUE,
            );
            normalRenderer?.setEndings(
                center,
                Vec3.scaleAndAdd(new Vec3(), center, axisABC, 1.0),
            );
            normalRenderer?.commit();
        }

        function drawTriangleABC() {
            const pA = a.position;
            const pB = b.position;
            const pC = c.position;
            debugTriangleRenderer?.clear();
            debugTriangleRenderer?.add(
                pA,
                pB,
                pC,
                Color.WHITE,
            );
            debugTriangleRenderer?.commit();
        }

        function printAngles() {
            console.log(
                `∠BAC：${toDegree(Vec3.angle(Vec3.subtract(new Vec3(), b.position, a.position), Vec3.subtract(new Vec3(), c.position, a.position)))} -> ${toDegree(angleBAC_2)}\n` +
                `∠ABC：${toDegree(Vec3.angle(Vec3.subtract(new Vec3(), c.position, b.position), Vec3.subtract(new Vec3(), a.position, b.position)))} -> ${toDegree(angleABC_2)}\n` +
                `dAB: ${Vec3.distance(a.position, b.position)} -> ${dAB}\n` +
                `dBC: ${Vec3.distance(b.position, c.position)} -> ${dBC}`
            );
        }
    }
}

export function solveTwoBoneIK(
    a: Node,
    b: Node,
    c: Node,
    target: Vec3,
) {
    const sanityChecker = new TwoBoneIKNodeSanityChecker(a, b, c);

    const pA = Vec3.clone(a.worldPosition);
    const pB = Vec3.clone(b.worldPosition);
    const pC = Vec3.clone(c.worldPosition);
    const qC = Quat.clone(c.worldRotation);

    const bSolved = new Vec3();
    const cSolved = new Vec3();
    solveTwoBoneIKPositions(
        pA,
        pB,
        pC,
        target,
        bSolved,
        cSolved,
    );

    const qA = Quat.rotationTo(
        new Quat(),
        Vec3.subtract(new Vec3(), pB, pA).normalize(),
        Vec3.subtract(new Vec3(), bSolved, pA).normalize(),
    );
    a.rotate(
        qA,
        NodeSpace.WORLD,
    );
    a.worldPosition = pA;

    const qB = Quat.rotationTo(
        new Quat(),
        Vec3.subtract(new Vec3(), c.worldPosition, b.worldPosition).normalize(),
        Vec3.subtract(new Vec3(), cSolved, b.worldPosition).normalize(),
    );
    b.rotate(
        qB,
        NodeSpace.WORLD,
    );
    b.worldPosition = bSolved;

    c.worldPosition = cSolved;

    // End factor's rotation frame might be rotated in IK progress, revert it after all thing done.
    // The reverting does not affect the IK result indeed.
    c.worldRotation = qC;

    sanityChecker.check();
}

function solveTwoBoneIKPositions(
    a: Readonly<Vec3>,
    b: Readonly<Vec3>,
    c: Readonly<Vec3>,
    target: Readonly<Vec3>,
    bSolved: Vec3,
    cSolved: Vec3,
) {
    const sanityChecker = new TwoBoneIKPositionSanityChecker(a, b, c);
    const sanityCheck = () => sanityChecker.check(a, bSolved, cSolved);

    const dAB = Vec3.distance(a, b);
    const dBC = Vec3.distance(b, c);
    const dAT = Vec3.distance(a, target);

    const dirAT = Vec3.subtract(new Vec3(), target, a);
    dirAT.normalize();

    const chainLength = dAB + dBC;
    if (dAT >= chainLength) {
        // Target is too far
        Vec3.scaleAndAdd(bSolved, a, dirAT, dAB);
        Vec3.scaleAndAdd(cSolved, a, dirAT, chainLength);
        sanityCheck();
        return;
    }

    // Now we should have a solution with target reached.
    // And then solve the middle joint B as Ḃ.
    Vec3.copy(cSolved, target);
    // Calculate ∠BAC's cosine.
    const cosḂAT = clamp(
        (dAB * dAB + dAT * dAT - dBC * dBC) / (2 * dAB * dAT),
        -1.0,
        1.0,
    );
    // Then use basic trigonometry(instead of rotation) to solve Ḃ.
    // Let D the intersect point of the height line passing Ḃ.
    const dirHeightLine = Vec3.multiplyScalar(
        new Vec3(),
        dirAT,
        Vec3.dot(dirAT, Vec3.subtract(new Vec3(), b, a)),
    );
    Vec3.subtract(
        dirHeightLine,
        Vec3.subtract(new Vec3(), b, a),
        dirHeightLine,
    );
    dirHeightLine.normalize();
    const dAD = dAB * cosḂAT;
    const hSqr = dAB * dAB - dAD * dAD;
    if (hSqr < 0) {
        'Shall handle this case';
        debugger;
    }
    const h = Math.sqrt(hSqr);
    Vec3.scaleAndAdd(
        bSolved,
        a,
        dirAT,
        dAD,
    );
    Vec3.scaleAndAdd(
        bSolved,
        bSolved,
        dirHeightLine,
        h,
    );
    if (DEBUG) {
        sanityCheck();
    }
}

class TwoBoneIKNodeSanityChecker {
    constructor(private _a: Node, private _b: Node, private _c: Node) {
        const pA = _a.worldPosition;
        const pB = _b.worldPosition;
        const pC = _c.worldPosition;
        this._pA = Vec3.clone(pA);
        this._dAB = Vec3.distance(pA, pB);
        this._dBC = Vec3.distance(pB, pC);
        this._rC = Quat.clone(_c.worldRotation);
    }

    public check() {
        const { _a, _b, _c } = this;
        const pA = _a.worldPosition;
        const pB = _b.worldPosition;
        const pC = _c.worldPosition;
        const CHECK_EPSILON = 1e-3;
        const dAB = Vec3.distance(pA, pB);
        const dBC = Vec3.distance(pB, pC);
        // Root's world position shall not change
        if (!Vec3.equals(pA, this._pA, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        // Joint length shall not change
        if (!approx(dAB, this._dAB, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        if (!approx(dBC, this._dBC, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        // End factor's world rotation shall not change
        if (!Quat.equals(_c.worldRotation, this._rC, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        return true;
    }

    private _pA: Vec3;
    private _dAB: number;
    private _dBC: number;
    private _rC: Quat;
}

class TwoBoneIKPositionSanityChecker {
    constructor(private _a: Readonly<Vec3>, _b: Readonly<Vec3>, _c: Readonly<Vec3>) {
        this._dAB = Vec3.distance(_a, _b);
        this._dBC = Vec3.distance(_b, _c);
    }

    public check(_a: Readonly<Vec3>, _b: Readonly<Vec3>, _c: Readonly<Vec3>) {
        const CHECK_EPSILON = 1e-3;
        const dAB = Vec3.distance(_a, _b);
        const dBC = Vec3.distance(_b, _c);
        if (!approx(Vec3.distance(_a, this._a), 0.0, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        if (!approx(dAB, this._dAB, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        if (!approx(dBC, this._dBC, CHECK_EPSILON)) {
            debugger;
            return false;
        }
        return true;
    }

    private declare _dAB: number;
    private declare _dBC: number;
}

function rotateToSmooth(from: Vec3, to: Vec3, joint: Joint, callback: () => void) {
    const axis = Vec3.cross(new Vec3(), from, to).normalize();
    const angle = Vec3.angle(from, to);
    const ANGLE_SPEED = toRadian(30);
    const FPS = 30.0;

    const deltaTime = 1.0 / FPS;
    const anglePerFrame = angle / ANGLE_SPEED / FPS;
    const frames = angle / anglePerFrame;
    const integralFrames = Math.floor(frames);
    const remainder = angle - anglePerFrame * integralFrames;
    const q = Quat.fromAxisAngle(
        new Quat(),
        axis,
        anglePerFrame,
    );
    let i = 0;
    let h = setInterval(() => {
        joint.node.rotate(q, Node.NodeSpace.WORLD);
        callback();
        ++i;
        if (i >= integralFrames) {
            clearInterval(h);
        }
    }, deltaTime * 1000.0);
    setTimeout(() => {
        const q = Quat.fromAxisAngle(
            new Quat(),
            axis,
            remainder,
        );
        joint.node.rotate(q, Node.NodeSpace.WORLD);
        callback();
    }, remainder / anglePerFrame * deltaTime * 1000.0);
}
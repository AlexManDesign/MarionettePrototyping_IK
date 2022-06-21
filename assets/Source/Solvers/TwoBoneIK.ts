import { clamp, Color, gfx, Material, math, MeshRenderer, Node, NodeSpace, primitives, Quat, toRadian, utils, Vec3 } from "cc";
import { DottedLineRenderer, LineRenderer, TriangleRenderer } from "../Debug/LineRenderer";
import { IKResolveMethod, ResolveContext, ErrorCode } from "./ResolverBase";
import { Joint } from "./Skeleton";

const DEBUG: boolean = true;

const DEBUG_SMOOTH_ROTATION: boolean = false;

export class TwoBoneIK extends IKResolveMethod {
    protected *solveChain(endFactor: Joint, chain: Joint[], target: math.Vec3, maxError: number, context: ResolveContext): Generator<void, number, unknown> {
        // https://theorangeduck.com/page/simple-two-joint
        
        if (chain.length < 2) {
            return ErrorCode.BAD_ARGUMENT;
        }

        const a = chain[chain.length - 1];
        const b = chain[chain.length - 2];
        const c = endFactor;
        const pA = a.position;
        const pB = b.position;
        const pC = c.position;
        const t = target;
        const dAB = Vec3.distance(pA, pB);
        const dBC = Vec3.distance(pB, pC);
        const dAT = Vec3.distance(pA, t);
        if (dAT > dAB + dBC) {
            return ErrorCode.TWO_BONE_FAR_FROM_ROOT;
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

        const axisCAB = Vec3.cross(
            new Vec3(),
            Vec3.subtract(new Vec3(), pC, pA).normalize(),
            Vec3.subtract(new Vec3(), pB, pA).normalize(),
        ).normalize();

        let debugLineRenderer: DottedLineRenderer | null = null;
        let debugTriangleRenderer: TriangleRenderer | null = null;
        let debugTriangleRenderer2: DottedLineRenderer | null = null;
        let normalRenderer: LineRenderer | null = null;
        let trianglePlaneNode: Node | null = null;

        if (DEBUG) {
            setupDebugTools();
            yield;
        }

        // Now that we got desired B` for B
        // Just rotate joint A and B
        
        const rotate = (from: Vec3, to: Vec3, joint: Joint) => {
            if (DEBUG && DEBUG_SMOOTH_ROTATION) {
                rotateToSmooth(from, to, joint, () => {
                    debugLineRenderer?.clear();
                    drawTriangleABC();
                    drawTriangleABCNormal();
                });
            } else {
                const q = Quat.rotationTo(new Quat(), from, to);
                // joint.node.rotate(q, NodeSpace.WORLD);
                joint.rotation = Quat.multiply(new Quat(), joint.rotation, q);
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
            yield;
        }

        // Vector B`C`
        const vB2C2 = Vec3.negate(new Vec3(), vAB2).normalize();
        Vec3.transformQuat(vB2C2, vB2C2, Quat.fromAxisAngle(new Quat(), axisCAB, angleABC_2));
        // Rotate ABC so C overlap with C`
        const vBC = Vec3.subtract(new Vec3(), c.position, b.position);
        rotate(
            vBC,
            vB2C2,
            b,
        );
        if (DEBUG) {
            yield;
        }

        // Rotation CA -> TA
        rotate(
            Vec3.subtract(new Vec3(), c.position, pA).normalize(),
            Vec3.subtract(new Vec3(), t, pA).normalize(),
            a,
        );

        if (DEBUG) {
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
            drawTrianglePlane();
    
            debugLineRenderer.addLine(
                pA,
                pC,
                Color.WHITE,
            );
            debugLineRenderer.addLine(
                pA,
                t,
                Color.WHITE,
            );
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
                effectName: 'standard',
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
    }
}

function rotateToSmooth(from: Vec3, to: Vec3, joint: Joint, callback: () => void) {
    const axis = Vec3.cross(new Vec3(), from, to).normalize();
    const angle = Vec3.angle(from, to);
    const ANGLE_SPEED = toRadian(30);
    const FPS = 30.0;
    const deltaTime = 1.0 / FPS;
    const anglePerFrame = angle / ANGLE_SPEED / FPS;
    const nFrames = angle / anglePerFrame;
    const nSteps = Math.floor(nFrames);
    const remainder = angle - anglePerFrame * nSteps;
    const q = Quat.fromAxisAngle(
        new Quat(),
        axis,
        angle / nSteps,
    );
    let i = 0;
    let h = setInterval(() => {
        joint.node.rotate(q, Node.NodeSpace.WORLD);
        callback();
        ++i;
        if (i >= nSteps) {
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
    }, remainder / anglePerFrame * deltaTime);
}
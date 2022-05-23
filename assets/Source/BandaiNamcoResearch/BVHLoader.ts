import { Animation, animation, AnimationClip, Asset, Component, Material, Node, Quat, toRadian, _decorator } from "cc";
import { parseBVH } from './ParsePVH';
import { BoneRenderMode, SkeletonRenderer } from "../Debug/SkeletonRenderer";
import { quatMultiply } from "../Util/Math";

@_decorator.ccclass
export class BVHAnimation extends Component {
    @_decorator.property(Asset)
    public bvhAsset: Asset | null = null;

    @_decorator.property(Material)
    public skeletonRendererMaterial: Material | null = null;

    @_decorator.property(Material)
    public skeletonRendererLineMaterial: Material | null = null;

    @_decorator.property
    get run() {
        return true;
    }

    set run(value) {
        this.start();
    }

    start() {
        if (!this.bvhAsset) {
            return;
        }
        const bvhArrayBuffer = this.bvhAsset._nativeAsset;
        const bvhString = bvhArrayBuffer.toString();
        const bvh = parseBVH(bvhString);
        const scale = 0.01;
        // https://research.cs.wisc.edu/graphics/Courses/cs-838-1999/Jeff/BVH.html
        const nodes = bvh.joints.map((bvhJoint) => {
            const node = new Node(bvhJoint.name);
            return node;
        });
        nodes.forEach((node, iNode) => {
            const bvhJoint = bvh.joints[iNode];
            const parent = bvhJoint.parent ? nodes[bvhJoint.parent.index] : this.node;
            parent.addChild(node);
        });
        nodes.forEach((node, iNode) => {
            const bvhJoint = bvh.joints[iNode];
            // Local position
            node.setPosition(
                bvhJoint.offset[0] * scale, 
                bvhJoint.offset[1] * scale, 
                bvhJoint.offset[2] * scale,
            );
        });
        const times = Array.from(bvh.frames, (_, frameIndex) => {
            return  bvh.frameTime * frameIndex;
        });
        const getNodePath = (node: Node): string => {
            const segments: string[] = [];
            for (let current: Node | null = node; current && current !== this.node; current = current.parent) {
                segments.unshift(current.name);
            }
            return segments.join('/');
        };

        const animationClip = new AnimationClip();
        animationClip.duration = times.length === 0 ? 0.0 : times[times.length - 1];
        bvh.joints.forEach((bvhJoint, nodeIndex) => {
            const positionChannels: Array<number[] | null> = new Array(3).fill(null);
            const rotationChannels: Array<number[] | null> = new Array(3).fill(null);
            bvhJoint.channels.forEach((channelName, channelIndex) => {
                const throwBadChannelName = (): never => {
                    throw new Error(`Unrecognized BVH channel: ${channelName}`);
                };
                const match = channelName.match(/^([XYZ])(position|rotation)$/);
                if (!match) {
                    return throwBadChannelName();
                }
                let componentIndex = 0;
                switch (match[1]) {
                    case 'X': componentIndex = 0; break;
                    case 'Y': componentIndex = 1; break;
                    case 'Z': componentIndex = 2; break;
                    default: return throwBadChannelName();
                }
                let channelType: typeof positionChannels | typeof rotationChannels;
                switch (match[2]) {
                    case 'position': channelType = positionChannels; break;
                    case 'rotation': channelType = rotationChannels; break;
                    default: return throwBadChannelName();
                }
                const values = Array.from(bvh.frames, (frame, frameIndex) => {
                    return frame[bvhJoint.channelOffset + channelIndex];
                });
                channelType[componentIndex] = values;
            });
            const node = nodes[nodeIndex];
            if (positionChannels.some((channel) => !!channel)) {
                const track = new animation.VectorTrack();
                track.path.toHierarchy(getNodePath(node)).toProperty('position');
                track.componentsCount = 3;
                for (let i = 0; i < 3; ++i) {
                    const values = positionChannels[i];
                    if (!values) {
                        continue;
                    }
                    const { curve } = track.channels()[i];
                    curve.assignSorted(
                        times,
                        values.map((value) => value * scale),
                    );
                }
                // animationClip.addTrack(track);
            }
            if (rotationChannels.some((channel) => !!channel)) {
                const track = new animation.QuatTrack();
                track.path.toHierarchy(getNodePath(node)).toProperty('rotation');
                const rotations = Array.from(bvh.frames, (_, frameIndex) => {
                    const x = toRadian(rotationChannels[0]?.[frameIndex] ?? 0.0);
                    const y = toRadian(rotationChannels[1]?.[frameIndex] ?? 0.0);
                    const z = toRadian(rotationChannels[2]?.[frameIndex] ?? 0.0);
                    // ZXY
                    return quatMultiply(
                        new Quat(),
                        Quat.rotateZ(new Quat(), Quat.IDENTITY, z),
                        Quat.rotateX(new Quat(), Quat.IDENTITY, x),
                        Quat.rotateY(new Quat(), Quat.IDENTITY, y),
                    );
                });
                track.channel.curve.assignSorted(
                    times,
                    rotations.map((rotation) => {
                        return {
                            value: rotation,
                        };
                    }),
                );
                animationClip.addTrack(track);
            }
        });
        animationClip.wrapMode = AnimationClip.WrapMode.Loop;
        animationClip.name = this.bvhAsset.name;

        const skeletonRenderer = this.node.addComponent(SkeletonRenderer);
        skeletonRenderer.mode = BoneRenderMode.line;
        skeletonRenderer.root = nodes.find((node) => {
            return !node.parent;
        }) ?? this.node;
        if (this.skeletonRendererMaterial) {
            skeletonRenderer.material = this.skeletonRendererMaterial;
        }
        if (this.skeletonRendererLineMaterial) {
            skeletonRenderer.lineMaterial = this.skeletonRendererLineMaterial;
        }

        const animationComponent = this.node.addComponent(Animation);
        animationComponent.playOnLoad = true;
        animationComponent.defaultClip = animationClip;
        const state = animationComponent.getState(animationClip.name);
        if (state) {
            state.speed = 1;
        }
    }
}
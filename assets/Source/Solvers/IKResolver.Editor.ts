import { Component, find, js, MeshRenderer, Node, primitives, Quat, utils, Vec3, _decorator } from "cc";
import { EDITOR } from "cc/env";
import { EndFactorSpecifier } from "./EndFactorSpecifier";
import { IKResolver } from "./IKResolver";

declare namespace cce {
    namespace gizmos {
        const GizmoDefines: {
            components: Record<string, Gizmo>;
        };

        export class Gizmo {

        }
    }

    namespace Operation {
        function addListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
        function removeListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
    }

    namespace Scene {
        function on(type: 'mode-change', listener: (mode: string) => void): void;
    }

    namespace Node {
        function change(uuid: string, node: Node): void;
        function query(uuid: string): Node | null;
    }

    namespace Animation {
        const curEditRootNodeUuid: string;
    }
}

@_decorator.ccclass
@_decorator.executeInEditMode
class ResolveModifier extends Component {
    public declare ikResolver: IKResolver;

    public declare target: Node;

    public declare endFactor: Node;
    
    lateUpdate() {
        const { endFactor, target } = this;
        const steps = this.ikResolver.resolve(endFactor, target.getWorldPosition(), false);
        for (const step of steps) {

        }
    }
}

if (EDITOR) {
    (async () => {
        await waitUtilGizmoValid();

        // console.log(cce.gizmos);

        class IKResolverGizmo extends cce.gizmos.Gizmo {

        }

        cce.gizmos.GizmoDefines.components[js.getClassName(IKResolver)] = IKResolverGizmo;

        cce.Scene.on('mode-change', (newMode: string) => {
            if (newMode === 'animation') {
                onAnimationEditingModeEntered();
            } else {
                onAnimationEditingModeExited();
            }
        });
    })();
}

async function waitUtilGizmoValid() {
    await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
            if (cce.gizmos) {
                clearInterval(timer);
                resolve();
            }
        }, 100);
    });
}

function onAnimationEditingModeEntered() {
    cce.Operation.addListener('keydown', onKeydown);
}

function onAnimationEditingModeExited() {
    cce.Operation.removeListener('keydown', onKeydown);
    ikPreviewerManager.destroy();
}

function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
        case 'i':
        case 'I':
            ikPreviewerManager.setup();
            break;
        case 'u': case 'U':
            ikPreviewerManager.selectNextTarget();
            break;
    }
}

function isInAnimationEditingMode() {
    return Editor.EditMode.getMode() === 'animation';
}

class IKPreviewer {
    constructor(rootNode: Node, ikResolver: IKResolver, endFactorSpecifiers: EndFactorSpecifier[]) {
        ikResolver.bind();
        this._targetNodes = endFactorSpecifiers.map((endFactorSpecifier) => {
            if (!endFactorSpecifier.joint) {
                return;
            }

            const target = new Node(`Target for ${endFactorSpecifier.joint.name}`);
            const scale = 0.1;
            target.scale = new Vec3(scale, scale, scale);
            rootNode.addChild(target);
            const meshRenderer = target.addComponent(MeshRenderer);
            meshRenderer.mesh = utils.MeshUtils.createMesh(primitives.box());
    
            const resolveModifier = rootNode.addComponent(ResolveModifier);
            resolveModifier.target = target;
            resolveModifier.endFactor = endFactorSpecifier.joint;
            resolveModifier.ikResolver = ikResolver;
            resolveModifier.target = target;
            target.setWorldPosition(endFactorSpecifier.joint.getWorldPosition());

            return target;
        }).filter((targetNode) => !!targetNode) as Node[];
    }

    public selectTarget() {
        const { _targetNodes: targetNodes } = this;
        const nTargetNodes = targetNodes.length;
        if (nTargetNodes === 0) {
            return;
        }
        const selected = Editor.Selection.getSelected('node');
        const currentSelectedIndex = selected.length === 1
            ? targetNodes.findIndex((node) => node.uuid === selected[0])
            : -1;
        const nextSelectedIndex = (currentSelectedIndex + 1) % nTargetNodes;
        const targetNode = targetNodes[nextSelectedIndex];
        console.debug(`Selecting ${targetNode.name}.`);
        Editor.Selection.clear('node');
        Editor.Selection.select('node', targetNode.uuid);
    }

    private _targetNodes: Node[] = [];
}

class IKPreviewerManager {
    public setup() {
        if (this._previewer) {
            return;
        }

        const currentEditingNodeUUID = cce.Animation.curEditRootNodeUuid;
        if (!currentEditingNodeUUID) {
            console.error(`I'don't know why I can't obtain current editing node.`);
            return;
        }
    
        const rootNode = cce.Node.query(currentEditingNodeUUID);
        if (!rootNode) {
            console.error(`I'don't know why I can't obtain current editing node.`);
            return;
        }
    
        const ikResolver = rootNode.getComponent(IKResolver);
        if (!ikResolver) {
            return;
        }
    
        const endFactorSpecifiers = rootNode.getComponents(EndFactorSpecifier)
            .filter((specifier) => specifier.enabled);
    
        this._previewer = new IKPreviewer(rootNode, ikResolver, endFactorSpecifiers);
    }

    public destroy() {
        this._previewer = null;
    }

    public selectNextTarget() {
        this._previewer?.selectTarget();
    }

    private _previewer: IKPreviewer | null = null;
}

const ikPreviewerManager = new IKPreviewerManager();
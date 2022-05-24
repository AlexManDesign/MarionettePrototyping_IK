import { _decorator, Component, Node, Vec3 } from 'cc';
import { IKResolver } from '../Solvers/IKResolver';
const { ccclass, property } = _decorator;

@ccclass('IKRunner')
export class IKRunner extends Component {
    @property(IKResolver)
    resolver!: IKResolver;

    @property(Node)
    endFactor!: Node;

    @property(Node)
    target!: Node;

    start() {
        const { resolver, endFactor, target } = this;
        this._task = (function*() {
            yield* resolver.resolve(
                endFactor,
                target.worldPosition,
            );
        })();
    }

    public step () {
        this._task.next();
    }

    private declare _task: Generator;
}



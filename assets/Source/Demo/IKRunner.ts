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
    }

    public step () {
        if (!this._task) {
            const { resolver, endFactor, target } = this;
            this._task = (function*(this: IKRunner) {
                yield* resolver.resolve(
                    endFactor,
                    target.worldPosition,
                );
            }).call(this);
        }
        this._task.next();
    }

    public reset () {
        if (this._task) {
            for (const _ of this._task) {
                ;
            }
            this._task = null;
        }
        this.resolver.revert();
    }

    private _task: Generator | null = null;
}



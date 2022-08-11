import { _decorator, Component, Node, Vec3 } from 'cc';
import { IKSolverBase } from '../IKSolverBase';
const { ccclass, property } = _decorator;

@ccclass('FixedIKSolverInvoker')
export class FixedIKSolverInvoker extends Component {
    @property(IKSolverBase)
    get solver() {
        return this._solver;
    }

    set solver(value) {
        this._solver = value;
        if (!value) {
            return;
        }
        const nEndFactors = value.getEndFactorCount();
        const oldTargets = this.targets;
        const targets = Array.from({ length: nEndFactors }, (_, iEndFactor) => {
            if (iEndFactor < oldTargets.length) {
                return oldTargets[iEndFactor];
            } else {
                return Vec3.clone(value.getEndFactorPosition(iEndFactor));
            }
        });
        this.targets = targets;
    }

    @property({
        type: [Vec3],
        visible: function (this: FixedIKSolverInvoker) {
            return !!this._solver;
        },
        // readonly: {
        //     deep: false,
        // },
    })
    public targets: Vec3[] = [];

    public lateUpdate() {
        const { _solver: solver, targets } = this;
        solver?.solve(targets);
    }

    @property(IKSolverBase)
    private _solver: IKSolverBase | null = null;
}


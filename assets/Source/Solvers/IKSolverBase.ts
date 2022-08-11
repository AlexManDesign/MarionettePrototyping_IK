import { _decorator, Component, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('IKSolverBase')
export abstract class IKSolverBase extends Component {
    public abstract getEndFactorCount(): number;

    public abstract getEndFactorPosition(index: number): Readonly<Vec3>

    public abstract solve(targets: ReadonlyArray<Readonly<Vec3>>): void;
}

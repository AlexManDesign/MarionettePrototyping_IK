import { _decorator, Component, Node, math, Vec3 } from 'cc';
import { IKSolverBase } from '../IKSolverBase';
import { solveTwoBoneIK } from '../TwoBoneIK';
const { ccclass, property, menu } = _decorator;

@ccclass('TwoBoneIKSolver')
@menu('IK Solver/Two Bone IK')
export class TwoBoneIKSolver extends IKSolverBase {
    @property(Node)
    public endFactor: Node | null = null;

    @property
    public hint = new Vec3();

    public getEndFactorCount(): number {
        return 1;
    }

    public getEndFactorPosition(_index: number): Readonly<Vec3> {
        return this.endFactor?.worldPosition ?? Vec3.ZERO;
    }

    public solve([target]: ReadonlyArray<Readonly<Vec3>>): void {
        const { endFactor } = this;
        const middle = endFactor?.parent;
        const root = middle?.parent;
        if (!endFactor || !middle || !root) {
            return;
        }
        solveTwoBoneIK(
            root,
            middle,
            endFactor,
            target,
        );
    }
}



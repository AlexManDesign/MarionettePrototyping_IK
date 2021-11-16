import * as cc from 'cc';
import { CCDIK } from '../Solvers/CCD';
import { injectComponent } from '../Util/Component';

@cc._decorator.ccclass('CCDIKDemo')
export class CCDIKDemo extends cc.Component {
    @cc._decorator.property(cc.Node)
    public leftHand: cc.Node | null = null;

    @cc._decorator.property(cc.Node)
    public rightHand: cc.Node | null = null;

    @cc._decorator.property(cc.Node)
    public leftFoot: cc.Node | null = null;

    @cc._decorator.property(cc.Node)
    public rightFoot: cc.Node | null = null;

    @cc._decorator.property(CCDIK)
    public ccdIk!: CCDIK;

    public start() {

    }

    public update () {

    }

    public onResolve(endFactor: cc.Node, target: cc.Node) {
        this.ccdIk.resolve(
            endFactor,
            target.getWorldPosition(),
        );
    }

    @injectComponent(CCDIK)
    private _ccd!: CCDIK;
}

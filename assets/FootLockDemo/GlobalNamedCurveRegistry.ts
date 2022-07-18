import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GlobalNamedCurveRegistry')
export class GlobalNamedCurveRegistry extends Component {
    @property
    LeftFootLock = 0.0;

    @property
    RightFootLock = 0.0;

    @property
    FeetPosition = 0.0;
}



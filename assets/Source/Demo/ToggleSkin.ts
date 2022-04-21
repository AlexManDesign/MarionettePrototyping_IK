import { _decorator, Component, Node, SkinnedMeshRenderer } from 'cc';
const { ccclass } = _decorator;

@ccclass('ToggleSkin')
export class ToggleSkin extends Component {
    toggle() {
        [
            ...this.getComponents(SkinnedMeshRenderer),
            ...this.getComponentsInChildren(SkinnedMeshRenderer),
        ].forEach((c) => c.enabled = !c.enabled);
    }
}



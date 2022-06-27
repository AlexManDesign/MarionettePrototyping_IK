import { _decorator, Component, Node, Animation } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AnimationSpeedController')
export class AnimationSpeedController extends Component {
    @property
    public speed = 1.0;

    start() {
        const animation = this.node.getComponent(Animation);
        animation?.on(Animation.EventType.PLAY, (type, state) => {
            state.speed = this.speed;
        });
    }

    update(deltaTime: number) {
    }
}



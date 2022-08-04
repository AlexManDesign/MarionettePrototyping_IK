import { _decorator, Component, Node, Button } from 'cc';
const { ccclass, property } = _decorator;

let pauseEnabled = false;

@ccclass('GlobalPauseSwitch')
export class GlobalPauseSwitch extends Component {
    static get pauseEnabled() {
        return pauseEnabled;
    }
    
    public togglePauseEnabled (_button: Button) {
        pauseEnabled = !pauseEnabled;
    }
}


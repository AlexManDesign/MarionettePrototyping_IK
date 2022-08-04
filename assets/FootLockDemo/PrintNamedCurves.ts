import { _decorator, Component, Node, animation, find, RichText } from 'cc';
import Table from '../Source/Utils/Table/Table';
const { ccclass, property } = _decorator;

@ccclass('PrintNamedCurves')
export class PrintNamedCurves extends Component {
    start() {

    }

    update(deltaTime: number) {
        const animationController = this.node.getComponent(animation.AnimationController);
        const richText = find('Canvas/NamedCurves')?.getComponent(RichText);
        if (animationController && richText) {
            const table = new Table({
                head: ['Name', 'Value'],
            });
            table.push(...[...animationController.getNamedCurvesNames()].map((curveName) => {
                return [curveName, `${animationController.getNamedCurveValue(curveName).toFixed(4)}`];
            }));
            richText.string = table.toString();
        }
    }
}



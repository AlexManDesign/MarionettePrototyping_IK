import { _decorator, Component, Node, animation, find, RichText } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PrintNamedCurves')
export class PrintNamedCurves extends Component {
    start() {

    }

    update(deltaTime: number) {
        const animationController = this.node.getComponent(animation.AnimationController);
        const richText = find('Canvas/RichText')?.getComponent(RichText);
        if (animationController && richText) {
            richText.string = `${[...animationController.getNamedCurvesNames()].map((curveName) => {
                return `${curveName} | ${animationController.getNamedCurveValue(curveName).toFixed(4)}`;
            }).join('\n')}`;
        }
    }
}



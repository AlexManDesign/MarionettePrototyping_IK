import { _decorator, Component, Node, animation, RichText } from 'cc';
const { ccclass, property } = _decorator;
import Table from '../../../Source/Utils/Table/Table';

@ccclass('ShowAnimationControllerVariables')
export class ShowAnimationControllerVariables extends Component {
    update(_deltaTime: number) {
        const richText = this.node.getComponent(RichText);
        if (!richText) {
            return;
        }

        const { animationController } = this;
        if (!animationController) {
            richText.string = `No animation controller attached.`;
            return;
        }

        const rows = [...animationController.getVariables()].map(([name, { type }]) => {
            let value = animationController.getValue(name);
            let typeStr = '';
            switch (type) {
                default:
                case animation.VariableType.FLOAT:
                    typeStr = 'F';
                    break;
                case animation.VariableType.INTEGER:
                    typeStr = 'I';
                    break;
                case animation.VariableType.BOOLEAN:
                    typeStr = 'B';
                    break;
                case animation.VariableType.TRIGGER:
                    typeStr = 'T';
                    break;
            }
            let valueStr = '';
            switch (type) {
                case animation.VariableType.FLOAT:
                    valueStr = `${+(value as number).toFixed(2)}`;
                    break;
                default:
                case animation.VariableType.INTEGER:
                case animation.VariableType.BOOLEAN:
                case animation.VariableType.TRIGGER:
                    valueStr = `${value}`;
                    break;
            }
            return [`${typeStr}`, name, valueStr];
        });
        const table = new Table({
            head: ['Type', 'Name', 'Value'],
        });
        table.push(...rows);
        richText.string = table.toString();
    }

    @property(animation.AnimationController)
    public animationController: animation.AnimationController | null = null;
}
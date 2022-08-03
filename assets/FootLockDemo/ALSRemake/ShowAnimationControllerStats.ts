import { _decorator, Component, Node, animation, RichText } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ShowAnimationControllerStats')
export class ShowAnimationControllerStats extends Component {
    start() {

    }

    update(deltaTime: number) {
        const richText = this.node.getComponent(RichText);
        if (richText) {
            const stats = this.animationController.__printStats();
            richText.string = formatStats(stats, 0);
        }
    }

    @property(animation.AnimationController)
    public animationController!: animation.AnimationController;
}

type StatsText = ReturnType<animation.AnimationController['__printStats']>;

function formatStats(statsText: StatsText, depth: number): string {
    return Object.keys(statsText).map((align) => {
        const lineText = statsText[align];
        const d = depth + parseInt(align);
        if (typeof lineText === 'string') {
            return `${new Array(d).fill('  ').join('')}${lineText}`;
        } else if (Array.isArray(lineText)) {
            return lineText.map((sub) => {
                return formatStats(sub, d);
            }).join('\n');
        } else {
            return formatStats(lineText, d);
        }
    }).join('\n');
}
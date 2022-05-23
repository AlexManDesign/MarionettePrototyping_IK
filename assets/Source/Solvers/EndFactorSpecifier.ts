import { Component, Node, _decorator } from "cc";

@_decorator.ccclass
export class EndFactorSpecifier extends Component {
    @_decorator.property(Node)
    public joint: Node | null = null;
}
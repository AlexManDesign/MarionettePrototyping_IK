import { director, MeshRenderer, renderer, RenderingSubMesh } from "cc";
import { DynamicMesh } from "./DynamicMesh";

export class DynamicMeshRenderer extends MeshRenderer {
    constructor(private _dynamicMesh: DynamicMesh) {
        super();
    }

    start() {
        const model = director.root!.createModel(renderer.scene.Model);
        model.node = model.transform = this.node;
        // model.createBoundingShape();
        model.setSubModelMesh(0, this._dynamicMesh.renderingSubMesh);
        this.node.scene.renderScene!.addModel(model);
    }
}
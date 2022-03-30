import { director, gfx, RenderingSubMesh } from "cc";
import { getComponentByteLength } from "./GfxFormatUtil";
import { VertexAttributeView, CompactVertexAttributeView, InterleavedVertexAttributeView } from "./VertexAttributeView";

export enum Semantic {
    position,
    color,
    normal,
}

const semanticTraitMap: Record<Semantic, {
    gfxName: gfx.AttributeName;
    defaultFormat: gfx.Format;
}> = {
    [Semantic.position]: {
        gfxName: gfx.AttributeName.ATTR_POSITION,
        defaultFormat: gfx.Format.RGB32F,
    },
    [Semantic.color]: {
        gfxName: gfx.AttributeName.ATTR_COLOR,
        defaultFormat: gfx.Format.RGBA32F,
    },
    [Semantic.normal]: {
        gfxName: gfx.AttributeName.ATTR_NORMAL,
        defaultFormat: gfx.Format.RGB32F,
    },
};

export class DynamicMesh {
    constructor() {
        this._device = director.root!.device;
    }

    get vertexCount() {
        return this._vertexCount;
    }

    get primitiveMode() {
        return this._primitiveMode;
    }

    set primitiveMode(value) {
        this._primitiveMode = value;
    }

    public rearrange(attributes: Semantic[], vertexCount: number): void;

    public rearrange(attributes: Semantic[], vertexCount: number) {
        const { _device: device } = this;

        this._clear();

        const stride = attributes.reduce((result, semantic) => {
            return result += gfx.FormatInfos[semanticTraitMap[semantic].defaultFormat].size
        }, 0);
        const buffer = new ArrayBuffer(stride * vertexCount);
        const gfxBufferInfo = new gfx.BufferInfo(
            gfx.BufferUsageBit.VERTEX,
            gfx.MemoryUsageBit.DEVICE,
            buffer.byteLength,
            stride,
            gfx.BufferFlagBit.NONE,
        );
        const gfxBuffer = device.createBuffer(gfxBufferInfo);
        this._vertexCount = vertexCount;
        let offset = 0;
        const gfxAttributes = attributes.map((semantic) => {
            const {
                defaultFormat,
                gfxName,
            } = semanticTraitMap[semantic];
            const format = defaultFormat;
            const formatInfo = gfx.FormatInfos[format];
            this._attributes[semantic] = {
                format,
                stream: 0,
                streamOffset: offset,
            };
            const gfxAttribute = new gfx.Attribute(
                gfxName,
                format,
                false,
                0,
                false,
                undefined, // location
            );
            offset += formatInfo.size;
            return gfxAttribute;
        });
        this._streams = [{
            buffer: new Uint8Array(buffer),
            stride,
            gfxBuffer: gfxBuffer,
        }];
        const renderingSubMesh = new RenderingSubMesh(
            this._streams.map((stream) => stream.gfxBuffer),
            gfxAttributes,
            this._primitiveMode,
            null,
            null,
        );
        this._renderingSubMesh = renderingSubMesh;
    }

    /**
     * Creates an attribute view which views the specified attribute.
     * @param from Index to the start vertex.
     * @param count Count of vertices to view.
     * @returns The attribute view.
     */
    public viewVertexAttribute(attributeName: string, from?: number, count?: number): VertexAttributeView {
        const { _attributes: attributes, _vertexCount: myVertexCount } = this;

        from ??= 0;
        count ??= myVertexCount - from;

        if (!(attributeName in attributes)) {
            throw new Error(`Nonexisting attribute ${attributeName}`);
        }

        const attribute = attributes[attributeName];
        const { buffer: streamData, stride } = this._streams[attribute.stream];
        const attributeFormat = attribute.format;
        const attributeStride = getComponentByteLength(attributeFormat) * gfx.FormatInfos[attributeFormat].count;
        if (attribute.streamOffset === 0 && stride === attributeStride) {
            return new CompactVertexAttributeView(
                streamData.buffer,
                streamData.byteOffset + stride * from,
                attributeFormat,
                count,
            );
        } else {
            return new InterleavedVertexAttributeView(
                streamData.buffer,
                streamData.byteOffset + stride * from,
                attribute.streamOffset,
                stride,
                attributeFormat,
                count,
            );
        }
    }

    get renderingSubMesh() {
        return this._renderingSubMesh;
    }

    public commit() {
        for (const stream of this._streams) {
            stream.gfxBuffer.update(stream.buffer);
        }
    }

    private declare _vertexCount: number;
    private _primitiveMode: gfx.PrimitiveMode = gfx.PrimitiveMode.TRIANGLE_LIST;
    private _renderingSubMesh: RenderingSubMesh = new RenderingSubMesh([], [], this._primitiveMode);
    private _attributes: Record<string, {
        format: gfx.Format;
        stream: number;
        streamOffset: number;
    }> = {};
    private _streams: Array<{
        buffer: Uint8Array;
        stride: number;
        gfxBuffer: gfx.Buffer;
    }> = [];

    private _device: gfx.Device;

    private _clear() {
        this._renderingSubMesh.destroy();
        this._attributes = {};
        for (const stream of this._streams) {
            stream.gfxBuffer.destroy();
        }
        this._streams.length = 0;
    }
}

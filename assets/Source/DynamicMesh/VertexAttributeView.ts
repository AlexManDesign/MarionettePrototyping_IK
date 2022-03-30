import { gfx, IVec3Like, IVec4Like, sys, Vec3, Vec4 } from "cc";
import { assertIsTrue } from "./Util";

const { FormatInfos } = gfx;

declare type TypedArray = Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array |
    Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;

declare type TypedArrayConstructor = Uint8ArrayConstructor | Uint8ClampedArrayConstructor |
    Int8ArrayConstructor | Uint16ArrayConstructor | Int16ArrayConstructor | Uint32ArrayConstructor |
    Int32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;

export interface VertexAttributeView {
    /**
     * Number of vertices this view views.
     */
    readonly vertexCount: number;

    /**
     * Number of component of per attribute.
     */
    readonly componentCount: number;

    /**
     * Creates a sub range which views the same attribute channel.
     * @param from Index to the start vertex.
     * @param end Index to the end vertex.
     * @returns The new view.
     */
    subarray(from?: number, end?: number): VertexAttributeView;

    set (view: VertexAttributeView, offset?: number): void;

    /**
     * Gets specified component of the specified vertex.
     * @param vertexIndex Index to the vertex.
     * @param componentIndex Index to the component.
     * @returns The component's value.
     */
    getComponent(vertexIndex: number, componentIndex: number): number;

    /**
     * Sets specified component of the specified vertex.
     * @param vertexIndex Index to the vertex.
     * @param componentIndex Index to the component.
     * @param value The value being set to the component.
     */
    setComponent (vertexIndex: number, componentIndex: number, value: number): void;

    /**
     * Reads vertices and returns the result into an array.
     * @param vertexCount Vertex count. If not specified, all vertices would be read.
     * @param storageConstructor Result array's constructor.
     */
    read<
        TStorageConstructor extends TypedArrayConstructor | ArrayConstructor
    >(vertexCount?: number, storageConstructor?: TStorageConstructor): InstanceType<TStorageConstructor>;

    /**
     * Reads vertices into specified array.
     * @param storage The array.
     * @param vertexCount Number of vertices to read. If not specified, all vertices would be read.
     */
    read<TStorage extends TypedArray | number[]>(storage: TStorage, vertexCount?: number): TStorage;

    /**
     * Writes vertices.
     * @param source Attribute data.
     * @param from Index to the start vertex to write. Defaults to 0.
     * @param to Index to the end vertex to write. Defaults to the view's count.
     */
    write (source: ArrayLike<number>, from?: number, to?: number): void;
}

class VertexAttributeViewBase {
    constructor (vertexCount: number, componentCount: number, typedArrayConstructor: TypedArrayConstructor) {
        this._vertexCount = vertexCount;
        this._componentCount = componentCount;
        this._typedArrayConstructor = typedArrayConstructor;
    }

    get vertexCount () {
        return this._vertexCount;
    }

    get componentCount () {
        return this._componentCount;
    }

    public getComponent (vertexIndex: number, componentIndex: number): number {
        throw new Error(`Not implemented`);
    }

    public setComponent (vertexIndex: number, componentIndex: number, value: number) {
        throw new Error(`Not implemented`);
    }

    public set (view: VertexAttributeView, offset?: number) {
        offset ??= 0;

        const { _vertexCount: myVertexCount, _componentCount: nComponents } = this;

        assertIsTrue(this.componentCount === view.componentCount);

        const nVerticesToCopy = Math.min(view.vertexCount, myVertexCount - offset);
        for (let iVertex = 0; iVertex < nVerticesToCopy; ++iVertex) {
            for (let iComponent = 0; iComponent < nComponents; ++iComponent) {
                const value = view.getComponent(iVertex, iComponent);
                this.setComponent(offset + iVertex, iComponent, value);
            }
        }
    }

    public read<
        TStorageConstructor extends TypedArrayConstructor | ArrayConstructor
    >(vertexCount?: number, storageConstructor?: TStorageConstructor): InstanceType<TStorageConstructor>;

    public read<TStorage extends TypedArray | number[]>(storage: TStorage, vertexCount?: number): TStorage;

    public read (param0: unknown, param1: unknown): unknown {
        const {
            _vertexCount: myVertexCount,
            _typedArrayConstructor: DefaultTypedArrayConstructor,
            _componentCount: nComponents,
        } = this;

        let storage: TypedArray | number[];
        let vertexCount: number;
        if (typeof param0 === 'object') {
            // Storage + Vertex count
            vertexCount = (param1 as number | undefined) ?? myVertexCount;
            storage = param0 as typeof storage;
        } else {
            // Vertex count, Storage constructor
            vertexCount = (param0 as number | undefined) ?? myVertexCount;
            if (param1 === Array) {
                storage = new Array(vertexCount).fill(0);
            } else {
                const StorageConstructor = (param1 as TypedArrayConstructor | undefined)
                    ?? DefaultTypedArrayConstructor;
                storage = new StorageConstructor(nComponents * vertexCount);
            }
        }

        for (let iVertex = 0; iVertex < vertexCount; ++iVertex) {
            for (let iComponent = 0; iComponent < nComponents; ++iComponent) {
                storage[nComponents * iVertex + iComponent] = this.getComponent(iVertex, iComponent);
            }
        }

        return storage;
    }

    public write (source: ArrayLike<number>, from?: number, to?: number) {
        const {
            _vertexCount: myVertexCount,
            _typedArrayConstructor: DefaultTypedArrayConstructor,
            _componentCount: nComponents,
        } = this;

        from ??= 0;
        to ??= myVertexCount;

        for (let iVertex = from; iVertex < to; ++iVertex) {
            for (let iComponent = 0; iComponent < nComponents; ++iComponent) {
                this.setComponent(iVertex, iComponent, source[nComponents * iVertex + iComponent]);
            }
        }
    }

    protected _vertexCount: number;

    protected _componentCount: number;

    private _typedArrayConstructor: TypedArrayConstructor;
}

export class InterleavedVertexAttributeView extends VertexAttributeViewBase implements VertexAttributeView {
    constructor (buffer: ArrayBuffer, byteOffset: number, attributeOffset: number, stride: number, format: gfx.Format, count: number) {
        super(count, FormatInfos[format].count, getTypedArrayConstructor(FormatInfos[format]));
        this._dataView = new DataView(buffer, byteOffset + attributeOffset, stride * count - attributeOffset);
        this._vertexCount = count;
        this._attributeOffset = attributeOffset;
        this._stride = stride;
        this._format = format;
        this._reader = getDataViewReader(FormatInfos[format]);
        this._writer = getDataViewWriter(FormatInfos[format]);
        this._componentBytes = getComponentByteLength(format);
    }

    public getComponent (vertexIndex: number, componentIndex: number) {
        const {
            _dataView: dataView,
            _stride: stride,
            _componentBytes: componentBytes,
            _reader: reader,
        } = this;
        return reader(
            dataView,
            stride * vertexIndex + componentBytes * componentIndex,
        );
    }

    public setComponent (vertexIndex: number, componentIndex: number, value: number) {
        const {
            _dataView: dataView,
            _stride: stride,
            _componentBytes: componentBytes,
            _writer: writer,
        } = this;
        writer(
            dataView,
            stride * vertexIndex + componentBytes * componentIndex,
            value,
        );
    }

    public subarray (from?: number, end?: number) {
        from ??= 0;
        end ??= this._vertexCount;

        return new InterleavedVertexAttributeView(
            this._dataView.buffer,
            (this._dataView.byteOffset - this._attributeOffset) + this._stride * from,
            this._attributeOffset,
            this._stride,
            this._format,
            end - from,
        );
    }

    private _dataView: DataView;
    private _stride: number;
    private _attributeOffset: number;
    private _format: gfx.Format;
    private _reader: ReturnType<typeof getDataViewReader>;
    private _writer: ReturnType<typeof getDataViewWriter>;
    private _componentBytes: number;
}

export class CompactVertexAttributeView extends VertexAttributeViewBase implements VertexAttributeView {
    constructor (buffer: ArrayBuffer, byteOffset: number, format: gfx.Format, count: number) {
        super(count, FormatInfos[format].count, getTypedArrayConstructor(FormatInfos[format]));
        const Constructor = getTypedArrayConstructor(FormatInfos[format]);
        const components = FormatInfos[format].count;
        this._array = new Constructor(buffer, byteOffset, components * count);
        this._vertexCount = count;
        this._format = format;
    }

    public getComponent (vertexIndex: number, componentIndex: number) {
        return this._array[this._componentCount * vertexIndex + componentIndex];
    }

    public setComponent (vertexIndex: number, componentIndex: number, value: number) {
        this._array[this._componentCount * vertexIndex + componentIndex] = value;
    }

    public subarray (from?: number, end?: number) {
        from ??= 0;
        end ??= this._vertexCount;

        return new CompactVertexAttributeView(
            this._array.buffer,
            this._array.byteOffset + this._array.BYTES_PER_ELEMENT * this._componentCount * from,
            this._format,
            end - from,
        );
    }

    public set (view: VertexAttributeView, offset?: number) {
        offset ??= 0;
        assertIsTrue(this.componentCount === view.componentCount);
        if (view instanceof CompactVertexAttributeView) {
            this._array.set(view._array, this._componentCount * offset);
        } else {
            super.set(view, offset);
        }
    }

    private _array: TypedArray;
    private _format: gfx.Format;
}

export class VertexAttributeVec3View {
    constructor (baseView: VertexAttributeView) {
        assertIsTrue(baseView.componentCount === 3);
        this._baseView = baseView;
    }

    get view () {
        return this._baseView;
    }

    public get (vertexIndex: number, out?: Vec3) {
        out ??= new Vec3();
        out.x = this._baseView.getComponent(vertexIndex, 0);
        out.y = this._baseView.getComponent(vertexIndex, 1);
        out.z = this._baseView.getComponent(vertexIndex, 2);
        return out;
    }

    public set (vertexIndex: number, value: Readonly<IVec3Like>) {
        this._baseView.setComponent(vertexIndex, 0, value.x);
        this._baseView.setComponent(vertexIndex, 1, value.y);
        this._baseView.setComponent(vertexIndex, 2, value.z);
    }

    private _baseView: VertexAttributeView;
}

export class VertexAttributeVec4View {
    constructor (baseView: VertexAttributeView) {
        assertIsTrue(baseView.componentCount === 4);
        this._baseView = baseView;
    }

    get view () {
        return this._baseView;
    }

    public get (vertexIndex: number, out?: Vec4) {
        out ??= new Vec4();
        out.x = this._baseView.getComponent(vertexIndex, 0);
        out.y = this._baseView.getComponent(vertexIndex, 1);
        out.z = this._baseView.getComponent(vertexIndex, 2);
        out.w = this._baseView.getComponent(vertexIndex, 3);
        return out;
    }

    public set (vertexIndex: number, value: Readonly<IVec4Like>) {
        this._baseView.setComponent(vertexIndex, 0, value.x);
        this._baseView.setComponent(vertexIndex, 1, value.y);
        this._baseView.setComponent(vertexIndex, 2, value.z);
        this._baseView.setComponent(vertexIndex, 3, value.w);
    }

    private _baseView: VertexAttributeView;
}

const isLittleEndian = sys.isLittleEndian;

function getTypedArrayConstructor (info: gfx.FormatInfo): TypedArrayConstructor {
    const stride = info.size / info.count;
    switch (info.type) {
    case gfx.FormatType.UNORM:
    case gfx.FormatType.UINT: {
        switch (stride) {
        case 1: return Uint8Array;
        case 2: return Uint16Array;
        case 4: return Uint32Array;
        default:
        }
        break;
    }
    case gfx.FormatType.SNORM:
    case gfx.FormatType.INT: {
        switch (stride) {
        case 1: return Int8Array;
        case 2: return Int16Array;
        case 4: return Int32Array;
        default:
        }
        break;
    }
    case gfx.FormatType.FLOAT: {
        return Float32Array;
    }
    default:
    }
    return Float32Array;
}

function getComponentByteLength (format: gfx.Format) {
    const info = FormatInfos[format];
    return info.size / info.count;
}

function getDataViewReader (formatInfo: gfx.FormatInfo): (dataView: DataView, offset: number) => number {
    const stride = formatInfo.size / formatInfo.count;
    switch (formatInfo.type) {
    case gfx.FormatType.UNORM:
    case gfx.FormatType.UINT: switch (stride) {
    case 1: return (dataView, offset) => dataView.getUint8(offset);
    case 2: return (dataView, offset) => dataView.getUint16(offset, isLittleEndian);
    case 4: return (dataView, offset) => dataView.getUint32(offset, isLittleEndian);
    default: break;
    }
        break;

    case gfx.FormatType.SNORM:
    case gfx.FormatType.INT: switch (stride) {
    case 1: return (dataView, offset) => dataView.getInt8(offset);
    case 2: return (dataView, offset) => dataView.getInt16(offset, isLittleEndian);
    case 4: return (dataView, offset) => dataView.getInt32(offset, isLittleEndian);
    default: break;
    }
        break;

    case gfx.FormatType.FLOAT: {
        return (dataView, offset) => dataView.getFloat32(offset, isLittleEndian);
    }

    default:
    }
    throw new Error(`Bad format.`);
}

function getDataViewWriter (formatInfo: gfx.FormatInfo): (dataView: DataView, offset: number, value: number) => void {
    const stride = formatInfo.size / formatInfo.count;
    switch (formatInfo.type) {
    case gfx.FormatType.UNORM:
    case gfx.FormatType.UINT: switch (stride) {
    case 1: return (dataView, offset, value) => dataView.setUint8(offset, value);
    case 2: return (dataView, offset, value) => dataView.setUint16(offset, value, isLittleEndian);
    case 4: return (dataView, offset, value) => dataView.setUint32(offset, value, isLittleEndian);
    default: break;
    }
        break;

    case gfx.FormatType.SNORM:
    case gfx.FormatType.INT: switch (stride) {
    case 1: return (dataView, offset, value) => dataView.setInt8(offset, value);
    case 2: return (dataView, offset, value) => dataView.setInt16(offset, value, isLittleEndian);
    case 4: return (dataView, offset, value) => dataView.setInt32(offset, value, isLittleEndian);
    default: break;
    }
        break;

    case gfx.FormatType.FLOAT: {
        return (dataView, offset, value) => dataView.setFloat32(offset, value, isLittleEndian);
    }

    default:
    }
    throw new Error(`Bad format.`);
}
import { pathToFileURL } from "url";
import ps from 'path';

export const pluginRoot = pathToFileURL(ps.join(__dirname, '..', '..')).href + '/';

export type EnumMark<T> = {
    __brand: '__EnumMark';
};

export type DumpData<TValue> =
    TValue extends number | boolean | string ?
    {
        value: TValue;
    }
    :
    TValue extends Array<infer U> ?
    {
        isArray: true;
        value: Array<DumpData<U>>;
    }
    :
    TValue extends EnumMark<infer U> ?
    {
        enumList: U;
        value: number;
    }
    :
    {
        value: {
            [x in keyof TValue]: DumpData<TValue[x]>;
        };
    }
    ;

export function toRadians(degrees: number) {
    return degrees / 180.0 * Math.PI;
}

export function toDegrees(radians: number) {
    return radians / Math.PI * 180.0;
}

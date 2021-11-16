
export function getBit(bits: number, bitIndex: number) {
    return !!(bits & (1 << bitIndex));
}

export function setBit(bits: number, bitIndex: number) {
    return bits | (1 << bitIndex);
}

export function clearBit(bits: number, bitIndex: number) {
    return bits & ~(1 << bitIndex);
}

export function setOrClearBit(bits: number, bitIndex: number, value: boolean) {
    if (value) {
        return setBit(bits, bitIndex);
    } else {
        return clearBit(bits, bitIndex);
    }
}

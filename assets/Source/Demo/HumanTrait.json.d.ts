
declare let HumanTrait: {
    bones: Array<{
        name: string;
        muscles: [number, number, number];
    }>;
    muscles: Array<{
        name: string;
        defaultMin: number;
        defaultMax: number;
    }>;
};

export default HumanTrait;

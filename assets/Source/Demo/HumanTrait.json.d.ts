
declare let HumanTrait: {
    bones: Array<{
        name: string;
        muscles: Array<{
            name: string;
            defaultMin: number;
            defaultMax: number;
        }>;
        muscleEnabled: boolean[];
    }>;
};

export default HumanTrait;

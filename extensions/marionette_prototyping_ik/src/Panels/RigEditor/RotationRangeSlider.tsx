import React from 'react';
import { Slider } from '@mui/material';

export class RotationRangeSlider extends React.Component<{
    min: number,
    max: number,
    disabled?: boolean;
    onChange?: (event: Event, min: number, max: number) => void;
}, {
    min: number;
    max: number;
    disabled: boolean;
}> {
    constructor(props: RotationRangeSlider['props']) {
        super(props);
        this.state = { min: props.min, max: props.max, disabled: props.disabled ?? false };
    }

    componentWillReceiveProps(nextProps: RotationRangeSlider['props']) {
        this.setState({ min: nextProps.min, max: nextProps.max, disabled: nextProps.disabled ?? false });
    }

    render(): React.ReactNode {
        const handleChange = (event: Event, newValue: number | number[]) => {
            if (Array.isArray(newValue)) {
                this.setState({ min: newValue[0], max: newValue[1] });
                this.props.onChange?.(event, newValue[0], newValue[1]);
            }
        };

        return <Slider
            getAriaLabel={() => 'Rotation range'}
            value={[this.state.min, this.state.max]}
            onChange={handleChange}
            valueLabelDisplay="on"
            getAriaValueText={(value) => `${value}`}
            disableSwap
            min={-180}
            max={180}
            disabled={this.state.disabled}
        />;
    }
}

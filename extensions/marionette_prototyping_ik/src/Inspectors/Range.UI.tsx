import React from 'react';
import MultiRangeSlider from '../external/MultiRangeSlider/MultiRangeSlider';
import { pluginRoot } from './Utils';

interface Props {
    minInput: number;
    maxInput: number;
    min: number;
    max: number;
    onChange?: (min: number, max: number) => void;
}

interface State {

}

export class RangeUI extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {  };
    }

    render(): React.ReactNode {
        return <div>
            <link
                rel="stylesheet"
                href={new URL('src/external/MultiRangeSlider/multiRangeSlider.css', pluginRoot).href}
            ></link>
            <MultiRangeSlider
                minInput={this.props.minInput}
                maxInput={this.props.maxInput}
                min={this.props.min}
                max={this.props.max}
                onChange={({ min, max }) => {
                    this.props.onChange?.(min, max);
                }}
            />
        </div>;
    }
}

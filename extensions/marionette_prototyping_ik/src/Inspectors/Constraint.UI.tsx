import React from 'react';
import { ConstraintDumpData } from './Constraint';
import { RangeUI } from './Range.UI';
import { toDegrees } from './Utils';

interface Props {
    dumpData: ConstraintDumpData;
}

interface State {

}

export class ConstraintUI extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {  };
    }

    render(): React.ReactNode {
        return <div>
            <select>{this.props.dumpData.value.constraintType.enumList.map(({ name, value }) => {
                return <option value={value}>{name}</option>;
            })}</select>
            <div>{Array.from({ length: 3 }, (_, iConstraint) => {
                const constraint = this.props.dumpData.value.constraints.value[iConstraint];
                const minInput = toDegrees(-Math.PI);
                const maxInput = toDegrees(Math.PI);
                const min = toDegrees(constraint.value.range.value.min.value);
                const max = toDegrees(constraint.value.range.value.max.value);
                return (<RangeUI
                    minInput={minInput}
                    maxInput={maxInput}
                    min={min}
                    max={max}
                    onChange={(min, max) => {
                        
                    }}
                />);
            })}</div>
        </div>;
    }
}

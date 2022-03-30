import fs from 'fs';
import ps from 'path';
import { pathToFileURL } from 'url';
import ReactDOM from 'react-dom';
import React, { ReactElement } from 'react';
import { DumpData, EnumMark, pluginRoot } from './Utils';
import { ConstraintUI } from './Constraint.UI';

class ConstraintPanel implements Editor.Panel.Options<
    unknown,
    unknown,
    (dump: ConstraintDumpData) => unknown
> {
    public declare $this: HTMLElement;

    public $ = {
        range: '#content',
    };

    public listeners?: { show?: (() => any) | undefined; hide?: (() => any) | undefined; } | undefined;

    public template: string = `
    <div id="content">
    </div>
    `;

    public update(dump: ConstraintDumpData) {
        if (!this._renderer) {
            const element = React.createElement(ConstraintUI, {
                dumpData: dump,
            }) as any;
            const renderer = ReactDOM.render(
                element,
                this.$.range as unknown as HTMLElement,
            );
            this._renderer = renderer;
        }
    }

    public ready() {
        
    }

    private _renderer: Element | null = null;
}

module.exports = Editor.Panel.define(new ConstraintPanel());

export type ConstraintDumpData = DumpData<{
    constraintType: EnumMark<[
        {name: 'NONE', value: 0},
        {name: 'DOF_1', value: 1},
        {name: 'DOF_2', value: 2},
        {name: 'X_Y_Z', value: 3},
        {name: 'X_Z_Y', value: 4},
    ]>;
    constraints: Array<{
        tag: string;
        range: { min: number, max: number };
    }>;
}>;

enum DOF {
    NONE,
    DOF_1,
}

type A = {
    [x in keyof typeof DOF]: { name: x; value: typeof DOF[x] };
};

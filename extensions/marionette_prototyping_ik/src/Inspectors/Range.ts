import fs from 'fs';
import ps from 'path';
import { pathToFileURL } from 'url';
import { RangeUI } from './Range.UI';
import ReactDOM from 'react-dom';
import React, { ReactElement } from 'react';
import { DumpData, toDegrees, toRadians } from './Utils';

const pluginRoot = pathToFileURL(ps.join(__dirname, '..', '..')).href + '/';

class Panel implements Editor.Panel.Options<
    unknown,
    unknown,
    (dump: RangeDump) => unknown
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

    public update(dump: RangeDump) {
        if (!this._renderer) {
            const inputMin = toDegrees(-Math.PI);
            const inputMax = toDegrees(Math.PI);
            const min = toDegrees(dump.value.min.value);
            const max = toDegrees(dump.value.max.value);
            const element = React.createElement(RangeUI, {
                minInput: inputMin,
                maxInput: inputMax,
                min: min,
                max: max,
                onChange: (min, max) => {
                    const minRadians = toRadians(min);
                    const maxRadians = toRadians(max);
                    // console.log(`min = ${min}, max = ${max}`);
                },
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

export = Editor.Panel.define(new Panel());

type RangeDump = DumpData<{
    min: number;
    max: number;
}>;

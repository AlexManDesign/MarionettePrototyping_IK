/// <reference path="../../../../@types/RigEditorMessages.d.ts"/>

import { pathToFileURL } from "url";
import ps from 'path';
import ReactDOM from 'react-dom';
import React, { ReactElement } from 'react';
import { RigEditorRoot } from "./RigEditor/RigEditorRoot.js";

const fields = new WeakMap<any, PanelData>();

interface PanelData {
    renderer: RigEditorRoot;
}

export = Editor.Panel.define({
    template: `
    <!-- Fonts to support Material Design -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
    />
    
    <!-- Icons to support Material Design -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
    />

    <div id="cache-container">
    </div>
    
    <div id="content">
    </div>
    `,

    $: {
        content: '#content',
        cacheContainer: '#cache-container',
    },

    ready() {
        
    },

    methods: {
        ['edit'](param: RigEditorEditParam) {
            console.debug(`RigEditor:Edit ${param.rig.joints.map((joint) => joint.name)}`);

            const rigEditorRoot = React.createElement(RigEditorRoot, {
                rig: param.rig,
                container: this.$.cacheContainer!,
            });
    
            const renderer = ReactDOM.render(
                rigEditorRoot,
                this.$.content!,
            );
    
            const panelData: PanelData = {
                renderer,
            };
        },
    },
});

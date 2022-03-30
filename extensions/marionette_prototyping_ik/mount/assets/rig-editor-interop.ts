import { EDITOR } from 'cc/env';

export const rigEditorInterop = (() => {
    if (!EDITOR) {
        return undefined;
    }

    type OnJointPropertiesChanged = (this: CCDIK, ...args: Parameters<RigEditorOnJointPropertiesChanged>) => void;

    let currentEditing: {
        object: CCDIK;
        onJointPropertiesChanged: OnJointPropertiesChanged;
    } | null = null;

    const edit = (
        ccd: CCDIK,
        param: RigEditorEditParam,
        onJointPropertiesChanged: OnJointPropertiesChanged,
    ) => {
        currentEditing = {
            object: ccd,
            onJointPropertiesChanged,
        };
        Editor.Message.send('marionette_prototyping_ik', 'edit-rig', param);
    };

    const eventEmitter = new (require('events').EventEmitter)();

    eventEmitter.on(
        'rig-editor-joint-properties-changed',
        (...args: Parameters<RigEditorOnJointPropertiesChanged>) => {
            const [jointId, joint] = args;
            console.log(`${jointId} properties changed: ${JSON.stringify(joint, undefined, 2)}`);
            if (!currentEditing) {
                console.log(`The current editing CCD IK has been absent!`);
                return;
            }
            currentEditing.onJointPropertiesChanged.call(currentEditing.object, ...args);
        });

    return {
        edit,
        eventEmitter,
    };
})();
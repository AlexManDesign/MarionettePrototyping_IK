import EventEmitter from "events";

export async function load() {
    console.log(`RigEditor: I'm landed in scene.`);
}

const methodNamesToForward = ['rig-editor-joint-properties-changed'];

export const methods = {
    ...Object.fromEntries(methodNamesToForward.map((methodName) => [methodName, async(...args: unknown[]) => {
        const { rigEditorInterop: { eventEmitter } } = await Editor.Module.importProjectModule('db://marionette_prototyping_ik/rig-editor-interop.ts') as {
            rigEditorInterop: {
                eventEmitter: EventEmitter,
            };
        };
        eventEmitter.emit(methodName, ...args);
    }])),
};


import React from 'react';
import Button from '@mui/material/Button';
import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { StyledEngineProvider } from '@mui/material/styles';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { Box, Checkbox, Grid, List, Paper, Slider, styled, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { RotationRangeSlider } from './RotationRangeSlider.js';
import { SkeletonHierarchy } from './SkeletonHierarchy.js';

interface Props {
    rig: RigEditorRig;
    container: HTMLElement;
}

interface State {

}

const Item = styled(Paper)(({ theme }) => ({
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: 'center',
    color: theme.palette.text.secondary,
}));

export interface SkeletonHierarchyData {
    joints: RigEditorJoint[];
    rootJointIndices: number[];
    childrenTable: number[][];
}

function extractSkeletonHierarchyData(rig: RigEditorRig) {
    const joints = rig.joints;

    const childrenTable = joints.map((): number[] => []);

    const rootJointIndices: number[] = [];

    joints.forEach((joint, jointIndex) => {
        if (joint.parent < 0) {
            rootJointIndices.push(jointIndex);
        } else {
            childrenTable[joint.parent].push(jointIndex);;
        }
    });

    return {
        joints,
        rootJointIndices,
        childrenTable,
    };
}

export class RigEditorRoot extends React.Component<Props, {
    currentJointIndex: number;
}> {
    private _jointInspectorRef: React.RefObject<OptionalJointInspector>;

    constructor(props: Props) {
        super(props);
        this.state = {
            currentJointIndex: -1,
        };
        this._jointInspectorRef = React.createRef();
    }

    render(): React.ReactNode {
        const cache = createCache({
            key: 'css',
            prepend: true,
            container: this.props.container,
        });

        const skeletonHierarchyData = extractSkeletonHierarchyData(this.props.rig);

        return <StyledEngineProvider>
            <CacheProvider value={cache}>
                <Box sx={{ backgroundColor: 'primary.dark', height: "100%" }}>
                    <Grid container spacing={2} style={{ height: "100%" }}>
                        <Grid item xs={4}>
                            <Item>
                                骨架
                                <SkeletonHierarchy
                                    data={skeletonHierarchyData}
                                    onSelect={(jointIndex) => {
                                        const joint = skeletonHierarchyData.joints[jointIndex];
                                        this.setState({ currentJointIndex: jointIndex });
                                        this._jointInspectorRef.current?.setState({ props: joint });
                                    }}
                                >
                                </SkeletonHierarchy>
                            </Item>
                        </Grid>
                        <Grid item xs={8}>
                            <Item>
                                <OptionalJointInspector ref={this._jointInspectorRef} onChange={(joint) => {
                                    Editor.Message.send('scene', 'execute-scene-script', {
                                        name: 'marionette_prototyping_ik',
                                        method: 'rig-editor-joint-properties-changed',
                                        args: [this.state.currentJointIndex, joint],
                                    });
                                }} />
                            </Item>
                        </Grid>
                    </Grid>
                </Box>
            </CacheProvider>
        </StyledEngineProvider>;
    }
}

class OptionalJointInspector extends React.Component<{ onChange?: (joint: RigEditorJointPropertiesChangedParam) => void }, { props: JointInspectorProps | null }> {
    constructor(props: OptionalJointInspector['props']) {
        super(props);
        this.state = { props: null };
    }

    render(): React.ReactNode {
        if (!this.state.props) {
            return null;
        }

        console.log(`Open Joint Inspector with: ${JSON.stringify(this.state.props, undefined, 2)}`);

        return <JointInspector
            name={this.state.props.name}
            rotationLimitX={this.state.props.rotationLimitX}
            rotationLimitY={this.state.props.rotationLimitY}
            rotationLimitZ={this.state.props.rotationLimitZ}
            onChange={this.props.onChange}
        />;
    }
}

interface JointInspectorProps {
    name: string;
    rotationLimitX: {
        min: number,
        max: number,
    };
    rotationLimitY: {
        min: number,
        max: number,
    };
    rotationLimitZ: {
        min: number,
        max: number,
    };
    onChange?: ((joint: Pick<RigEditorJoint, 'rotationLimitX' | 'rotationLimitY' | 'rotationLimitZ'>) => void);
}

class JointInspector extends React.Component<
    JointInspectorProps,
    Pick<JointInspectorProps, 'rotationLimitX' | 'rotationLimitY' | 'rotationLimitZ'>
> {
    private _rotationLimitSliderX: React.RefObject<RotationRangeSlider>;
    private _rotationLimitSliderY: React.RefObject<RotationRangeSlider>;
    private _rotationLimitSliderZ: React.RefObject<RotationRangeSlider>;

    constructor(props: JointInspector['props']) {
        super(props);
        this._rotationLimitSliderX = React.createRef();
        this._rotationLimitSliderY = React.createRef();
        this._rotationLimitSliderZ = React.createRef();
        this.state = {
            rotationLimitX: props.rotationLimitX,
            rotationLimitY: props.rotationLimitY,
            rotationLimitZ: props.rotationLimitZ,
        };
    }

    public static getDerivedStateFromProps(props: JointInspectorProps, state: JointInspector['state']) {
        return {
            rotationLimitX: props.rotationLimitX,
            rotationLimitY: props.rotationLimitY,
            rotationLimitZ: props.rotationLimitZ,
        };
    }

    render(): React.ReactNode {
        const renderRotationLimitField = (
            label: string,
            ref: React.RefObject<RotationRangeSlider>,
            value: { min: number, max: number },
            stateName: keyof JointInspector['state'],
        ) => {
            return <TableRow>
                <TableCell>
                    <Checkbox size="small"
                        defaultChecked={true}
                        onChange={(event) => {
                            ref.current!.setState({ disabled: !event.target.checked });
                        }}
                    />
                    {label}
                </TableCell>
                <TableCell>
                    <RotationRangeSlider
                        ref={ref}
                        min={value.min}
                        max={value.max}
                        disabled={false}
                        onChange={(event, min, max) => {
                            this.state[stateName].min = min;
                            this.state[stateName].max = max;
                            // @ts-ignore
                            this.setState({ [stateName]: { min, max } }, () => {
                                this.props.onChange?.({
                                    rotationLimitX: {
                                        min: this.state.rotationLimitX.min,
                                        max: this.state.rotationLimitX.max,
                                    },
                                    rotationLimitY: {
                                        min: this.state.rotationLimitY.min,
                                        max: this.state.rotationLimitY.max,
                                    },
                                    rotationLimitZ: {
                                        min: this.state.rotationLimitZ.min,
                                        max: this.state.rotationLimitZ.max,
                                    },
                                });
                            });
                        }}
                    />
                </TableCell>
            </TableRow>;
        };

        return <div>
            骨骼检查器：{this.props.name}
            <Table>
                <TableBody>
                    {renderRotationLimitField('X 旋转范围', this._rotationLimitSliderX, this.state.rotationLimitX, 'rotationLimitX')}
                    {renderRotationLimitField('Y 旋转范围', this._rotationLimitSliderY, this.state.rotationLimitY, 'rotationLimitY')}
                    {renderRotationLimitField('Z 旋转范围', this._rotationLimitSliderZ, this.state.rotationLimitZ, 'rotationLimitZ')}
                </TableBody>
            </Table>
        </div>;
    }
}


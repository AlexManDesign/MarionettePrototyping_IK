import React from 'react';
import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { SkeletonHierarchyData } from './RigEditorRoot.js';
import { Box, Button } from '@mui/material';

export class SkeletonHierarchy extends React.Component<{
    data: SkeletonHierarchyData;
    onSelect?: (jointIndex: number) => void;
}, {
    data: SkeletonHierarchyData;
    expanded: string[];
}> {
    private _onSelect: undefined | ((jointIndex: number) => void);

    constructor(props: SkeletonHierarchy['props']) {
        super(props);
        this._onSelect = props.onSelect;
        this.state = {
            data: this.props.data,
            expanded: [],
        };
    }

    render(): React.ReactNode {
        const { joints, childrenTable, rootJointIndices } = this.state.data;

        const showJoint = (joint: RigEditorJoint, jointIndex: number) => {
            return <TreeItem
                nodeId={`${jointIndex}`}
                label={joint.name}
                key={joint.name}
                onClick={() => {
                    this._onSelect?.(jointIndex);
                }}
            >
                {
                    childrenTable[jointIndex].map((childJointIndex) => {
                        return showJoint(joints[childJointIndex], childJointIndex);
                    })
                }
            </TreeItem>;
        };

        const handleToggle = (event: React.SyntheticEvent, nodeIds: string[]) => {
            this.setState({ expanded: nodeIds });
        };

        const handleExpandClick = () => {
            const oldExpanded = this.state.expanded;
            this.setState({ expanded: oldExpanded.length === 0 ? this.state.data.joints.map((_, index) => `${index}`) : [] });
        };
        return (
            <div>
                <Box sx={{ mb: 1 }}>
                    <Button onClick={handleExpandClick}>
                        { this.state.expanded.length === 0 ? '展开所有' : '折叠所有' }
                    </Button>
                </Box>
                <TreeView
                    expanded={this.state.expanded}
                    onNodeToggle={handleToggle}
                    defaultCollapseIcon={<ExpandMoreIcon />}
                    defaultExpandIcon={<ChevronRightIcon />}
                    sx={{
                        height: 240,
                        flexGrow: 1,
                        // maxWidth: 400,
                        overflowY: 'auto',
                    }}
                >
                    {rootJointIndices.map((rootJointIndex) => {
                        return showJoint(joints[rootJointIndex], rootJointIndex);
                    })}
                </TreeView>
            </div>
        );
    }
}

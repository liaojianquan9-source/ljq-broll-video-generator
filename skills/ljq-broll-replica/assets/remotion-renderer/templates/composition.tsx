import React from 'react';
import {Composition, registerRoot} from 'remotion';
import caseState from '../case.json';
import layout from '../specs/layout.json';
import motion from '../specs/motion.json';
import {CaseFromSpec} from './runtime';
import {casePropsSchema, defaultCaseProps, type CaseProps} from './schema';

const EditableCase: React.FC<CaseProps> = (props) => (
  <CaseFromSpec caseState={caseState} layout={layout} motion={motion} overrides={props} />
);

const Root: React.FC = () => (
  <Composition
    id="LjqBrollCase"
    component={EditableCase}
    width={layout.canvas.width}
    height={layout.canvas.height}
    fps={layout.canvas.fps}
    durationInFrames={layout.canvas.durationInFrames}
    schema={casePropsSchema}
    defaultProps={defaultCaseProps}
  />
);

registerRoot(Root);

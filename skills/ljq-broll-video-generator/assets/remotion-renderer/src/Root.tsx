import React from 'react';
import {loadFont} from '@remotion/fonts';
import {Composition, staticFile} from 'remotion';
import {BrollScene} from './Scene';
import {defaultScene} from './default-scene';
import type {SceneSpec} from './types';

void loadFont({
  family: 'Ljq Source Han Serif CN',
  url: staticFile('fonts/SourceHanSerifCN-Heavy.otf'),
  weight: '600',
  display: 'block',
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="LjqBrollVideo"
    component={BrollScene}
    width={defaultScene.canvas.width}
    height={defaultScene.canvas.height}
    fps={defaultScene.canvas.fps}
    durationInFrames={defaultScene.canvas.durationInFrames}
    defaultProps={defaultScene}
    calculateMetadata={({props}: {props: SceneSpec}) => ({
      width: props.canvas.width,
      height: props.canvas.height,
      fps: props.canvas.fps,
      durationInFrames: props.canvas.durationInFrames,
    })}
  />
);

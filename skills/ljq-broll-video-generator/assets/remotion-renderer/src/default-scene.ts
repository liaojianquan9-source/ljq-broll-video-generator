import type {SceneSpec} from './types';

export const defaultScene: SceneSpec = {
  schemaVersion: '1.0',
  id: 'default-scene',
  renderMode: 'reference',
  canvas: {
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 90,
  },
  elements: [
    {
      id: 'default-card',
      type: 'shape',
      label: 'B-roll 元素',
      box: [30, 30, 40, 40],
      tone: 'foreground',
    },
  ],
};

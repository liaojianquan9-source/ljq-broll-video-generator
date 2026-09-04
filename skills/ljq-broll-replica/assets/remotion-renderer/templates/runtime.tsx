import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import type {CaseProps} from './schema';

type Keyframe = {frame: number; value: number};
type CurveTrack = {
  keyframes: Keyframe[];
  interpolation: 'linear' | 'bezier';
  bezier?: [number, number, number, number];
  allowReversal?: boolean;
  allowHoldFrames?: boolean;
};
type Track = Keyframe[] | CurveTrack;
type Appearance = {
  backgroundColor?: string;
  backgroundImage?: string;
  color?: string;
  fill?: string;
  opacity?: number;
  mixBlendMode?: string;
  filter?: string;
  blurPx?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hueRotateDeg?: number;
  boxShadow?: string;
  textShadow?: string;
  textGradient?: string;
  textStrokePx?: number;
  textStrokeColor?: string;
  borderRadiusPx?: number;
  borderWidthPx?: number;
  borderColor?: string;
  borderStyle?: string;
  fontFamily?: string;
  fontSizePx?: number;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacingPx?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'center' | 'bottom';
  whiteSpace?: string;
  overflow?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  clipPath?: string;
  maskImage?: string;
  transformOrigin?: string;
  paddingPx?: number;
  isolation?: string;
};
type LayoutElement = {
  id: string;
  type: 'background' | 'group' | 'text' | 'image' | 'video' | 'shape' | 'line' | 'effect';
  name: string;
  sceneId?: string | null;
  content: string | null;
  asset: string | null;
  bounds: [number, number, number, number];
  anchor: [number, number];
  cropMode: 'viewport-clip' | 'container-mask' | 'asset-crop' | 'none';
  zIndex: number;
  parentId: string | null;
  shape?: 'rectangle' | 'circle' | 'ellipse' | 'line' | 'custom' | null;
  appearance: Appearance;
};
type LayoutSpec = {
  canvas: {width: number; height: number; fps: number; durationInFrames: number; backgroundColor: string};
  scenes?: Array<{id: string; startFrame: number; endFrame: number}>;
  elements: LayoutElement[];
};
type Motion = {
  targetId: string;
  easingCandidate?: string;
  transform?: Partial<Record<'x' | 'y' | 'scaleX' | 'scaleY' | 'rotationDeg' | 'opacity' | 'blurPx', Track>>;
  effects?: Partial<Record<'brightness' | 'contrast' | 'saturation' | 'hueRotateDeg', Track>>;
  reveal?: {mode: string; progress: Track; direction?: string};
  textAnimation?: {
    preset: string;
    startFrame: number;
    endFrame: number;
    seed: number;
    distancePx?: number;
    blurPx?: number;
    staggerFrames: number;
    direction?: 'top-to-bottom' | 'bottom-to-top' | 'left-to-right' | 'right-to-left';
    ghostLayers?: number;
    ghostOffsetPx?: number;
    ghostOpacity?: number;
    stretchY?: number;
  };
};
type MotionSpec = {motions: Motion[]};
type CaseState = {files: {source: string}; source: {hasAudio: boolean}};
type MotionState = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  opacity: number;
  blurPx: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotateDeg: number;
  reveal: number;
  revealMode?: string;
  revealDirection?: string;
  textAnimation?: Motion['textAnimation'];
};

const keyframesFor = (track: Track): Keyframe[] => Array.isArray(track) ? track : track.keyframes;

const easingFor = (name?: string, track?: Track) => {
  if (track && !Array.isArray(track)) {
    if (track.interpolation === 'linear') return Easing.linear;
    if (track.interpolation === 'bezier' && track.bezier) return Easing.bezier(...track.bezier);
  }
  if (name?.includes('back')) return Easing.out(Easing.back(1.35));
  const base = name?.includes('quint') ? Easing.poly(5) : Easing.cubic;
  if (name?.startsWith('in-out')) return Easing.inOut(base);
  if (name?.startsWith('out')) return Easing.out(base);
  if (name?.startsWith('in')) return Easing.in(base);
  return Easing.linear;
};

const valueAt = (track: Track | undefined, frame: number, fallback: number, easingName?: string) => {
  if (!track) return fallback;
  const keyframes = keyframesFor(track);
  if (keyframes.length === 0) return fallback;
  if (keyframes.length === 1 || frame <= keyframes[0].frame) return keyframes[0].value;
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) return last.value;
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const left = keyframes[index];
    const right = keyframes[index + 1];
    if (frame <= right.frame) {
      return interpolate(frame, [left.frame, right.frame], [left.value, right.value], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easingFor(easingName, track),
      });
    }
  }
  return last.value;
};

const motionAt = (targetId: string, motions: Motion[], frame: number): MotionState => {
  const state: MotionState = {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, opacity: 1, blurPx: 0,
    brightness: 1, contrast: 1, saturation: 1, hueRotateDeg: 0, reveal: 1,
  };
  for (const motion of motions.filter((item) => item.targetId === targetId)) {
    const transform = motion.transform ?? {};
    state.x += valueAt(transform.x, frame, 0, motion.easingCandidate);
    state.y += valueAt(transform.y, frame, 0, motion.easingCandidate);
    state.scaleX *= valueAt(transform.scaleX, frame, 1, motion.easingCandidate);
    state.scaleY *= valueAt(transform.scaleY, frame, 1, motion.easingCandidate);
    state.rotationDeg += valueAt(transform.rotationDeg, frame, 0, motion.easingCandidate);
    state.opacity *= valueAt(transform.opacity, frame, 1, motion.easingCandidate);
    state.blurPx += valueAt(transform.blurPx, frame, 0, motion.easingCandidate);
    const effects = motion.effects ?? {};
    state.brightness *= valueAt(effects.brightness, frame, 1, motion.easingCandidate);
    state.contrast *= valueAt(effects.contrast, frame, 1, motion.easingCandidate);
    state.saturation *= valueAt(effects.saturation, frame, 1, motion.easingCandidate);
    state.hueRotateDeg += valueAt(effects.hueRotateDeg, frame, 0, motion.easingCandidate);
    if (motion.reveal) {
      state.reveal *= valueAt(motion.reveal.progress, frame, 1, motion.easingCandidate);
      state.revealMode = motion.reveal.mode;
      state.revealDirection = motion.reveal.direction;
    }
    if (motion.textAnimation) state.textAnimation = motion.textAnimation;
  }
  return state;
};

const diagonalClip = (progress: number, direction: 'diagonal-down-right' | 'diagonal-up-right') => {
  const extent = Math.max(0, Math.min(200, progress * 200));
  if (direction === 'diagonal-down-right') {
    if (extent <= 100) return `polygon(0 0, ${extent}% 0, 0 ${extent}%)`;
    const edge = extent - 100;
    return `polygon(0 0, 100% 0, 100% ${edge}%, ${edge}% 100%, 0 100%)`;
  }
  if (extent <= 100) return `polygon(0 100%, ${extent}% 100%, 0 ${100 - extent}%)`;
  const edge = extent - 100;
  return `polygon(0 0, ${edge}% 0, 100% ${100 - edge}%, 100% 100%, 0 100%)`;
};

const clipForProgress = (progress: number, direction?: string): string | undefined => {
  const normalized = Math.max(0, Math.min(1, progress));
  const hidden = 100 - normalized * 100;
  if (direction === 'right-to-left') return `inset(0 0 0 ${hidden}%)`;
  if (direction === 'top-to-bottom') return `inset(0 0 ${hidden}% 0)`;
  if (direction === 'bottom-to-top') return `inset(${hidden}% 0 0 0)`;
  if (direction === 'diagonal-down-right' || direction === 'diagonal-up-right') return diagonalClip(normalized, direction);
  if (direction === 'radial') return `circle(${normalized * 72}% at 50% 50%)`;
  return `inset(0 ${hidden}% 0 0)`;
};

const revealClip = (state: MotionState): string | undefined => {
  if (!state.revealMode || state.revealMode === 'fade' || state.revealMode === 'characters') return undefined;
  return clipForProgress(state.reveal, state.revealDirection);
};

const relativeBounds = (element: LayoutElement, parent?: LayoutElement): [number, number, number, number] => {
  if (!parent) return element.bounds;
  const [left, top, width, height] = element.bounds;
  const [parentLeft, parentTop, parentWidth, parentHeight] = parent.bounds;
  return [
    ((left - parentLeft) / parentWidth) * 100,
    ((top - parentTop) / parentHeight) * 100,
    (width / parentWidth) * 100,
    (height / parentHeight) * 100,
  ];
};

const filterFor = (appearance: Appearance, state: MotionState): string | undefined => {
  const parts = [appearance.filter];
  const blur = (appearance.blurPx ?? 0) + state.blurPx;
  if (blur > 0) parts.push(`blur(${blur}px)`);
  parts.push(`brightness(${(appearance.brightness ?? 1) * state.brightness})`);
  parts.push(`contrast(${(appearance.contrast ?? 1) * state.contrast})`);
  parts.push(`saturate(${(appearance.saturation ?? 1) * state.saturation})`);
  const hue = (appearance.hueRotateDeg ?? 0) + state.hueRotateDeg;
  if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
  return parts.filter(Boolean).join(' ') || undefined;
};

const mediaSource = (source: string) => /^(https?:|data:|blob:)/.test(source) ? source : staticFile(source);

const textAnimationClip = (animation: MotionState['textAnimation'], frame: number): string | undefined => {
  if (!animation || animation.preset !== 'wipe') return undefined;
  const progress = Math.max(0, Math.min(1, (frame - animation.startFrame) / Math.max(1, animation.endFrame - animation.startFrame)));
  return clipForProgress(progress, animation.direction);
};

const textContent = (content: string, animation: NonNullable<MotionState['textAnimation']>, frame: number, id: string) => {
  const duration = Math.max(1, animation.endFrame - animation.startFrame);
  const progress = Math.max(0, Math.min(1, (frame - animation.startFrame) / duration));
  if (animation.preset === 'typewriter') return content.slice(0, Math.floor(content.length * progress));
  if (animation.preset === 'ghost-drop-in') {
    return [...content].map((character, index) => {
      const localStart = animation.startFrame + index * animation.staggerFrames;
      const raw = Math.max(0, Math.min(1, (frame - localStart) / Math.max(1, duration * 0.65)));
      const local = 1 - (1 - raw) ** 3;
      const direction = animation.direction ?? 'top-to-bottom';
      const vector = direction === 'bottom-to-top' ? [0, 1] : direction === 'left-to-right' ? [-1, 0] : direction === 'right-to-left' ? [1, 0] : [0, -1];
      const distance = animation.distancePx ?? 30;
      const layers = animation.ghostLayers ?? 3;
      const ghostOffset = animation.ghostOffsetPx ?? 4;
      const ghostOpacity = animation.ghostOpacity ?? 0.28;
      const stretch = 1 + ((animation.stretchY ?? 1.18) - 1) * (1 - local);
      return <span key={`${id}-${index}`} style={{display: 'inline-block', position: 'relative', whiteSpace: 'pre'}}>
        {Array.from({length: layers}, (_, layerIndex) => {
          const lag = (layerIndex + 1) / (layers + 2);
          const ghostLocal = Math.max(0, Math.min(1, raw - lag * 0.22));
          const ghostEase = 1 - (1 - ghostLocal) ** 3;
          const offset = distance * (1 - ghostEase) + ghostOffset * (layerIndex + 1);
          return <span key={`ghost-${layerIndex}`} aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            opacity: ghostOpacity * (1 - ghostEase) * (1 - layerIndex / (layers + 1)),
            transform: `translate(${vector[0] * offset}px, ${vector[1] * offset}px) scaleY(${stretch})`,
            filter: animation.blurPx ? `blur(${animation.blurPx * (1 - ghostEase)}px)` : undefined,
          }}>{character === ' ' ? '\u00a0' : character}</span>;
        })}
        <span style={{
          display: 'inline-block', opacity: local,
          transform: `translate(${vector[0] * distance * (1 - local)}px, ${vector[1] * distance * (1 - local)}px) scaleY(${stretch})`,
          filter: animation.blurPx ? `blur(${animation.blurPx * (1 - local)}px)` : undefined,
        }}>{character === ' ' ? '\u00a0' : character}</span>
      </span>;
    });
  }
  if (animation.preset !== 'scatter-in') return content;
  return [...content].map((character, index) => {
    const localStart = animation.startFrame + index * animation.staggerFrames;
    const local = Math.max(0, Math.min(1, (frame - localStart) / Math.max(1, duration * 0.65)));
    const angle = random(`${animation.seed}-${id}-${index}`) * Math.PI * 2;
    const distance = (animation.distancePx ?? 24) * (1 - local);
    return (
      <span key={`${id}-${index}`} style={{
        display: 'inline-block',
        opacity: local,
        translate: `${Math.cos(angle) * distance}px ${Math.sin(angle) * distance}px`,
        filter: animation.blurPx ? `blur(${animation.blurPx * (1 - local)}px)` : undefined,
      }}>{character === ' ' ? '\u00a0' : character}</span>
    );
  });
};

const ElementNode: React.FC<{
  element: LayoutElement;
  parent?: LayoutElement;
  elements: LayoutElement[];
  motions: Motion[];
  overrides: CaseProps;
}> = ({element, parent, elements, motions, overrides}) => {
  const frame = useCurrentFrame();
  const state = motionAt(element.id, motions, frame);
  const [left, top, width, height] = relativeBounds(element, parent);
  const appearance = element.appearance;
  const opacity = (appearance.opacity ?? 1) * state.opacity * (state.revealMode === 'fade' ? state.reveal : 1);
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
    zIndex: element.zIndex,
    transformOrigin: appearance.transformOrigin ?? `${element.anchor[0] * 100}% ${element.anchor[1] * 100}%`,
    translate: `${state.x}px ${state.y}px`,
    rotate: `${state.rotationDeg}deg`,
    scale: `${Math.max(0, state.scaleX)} ${Math.max(0, state.scaleY)}`,
    opacity,
    filter: filterFor(appearance, state),
    clipPath: textAnimationClip(state.textAnimation, frame) ?? revealClip(state) ?? appearance.clipPath,
    maskImage: appearance.maskImage,
    mixBlendMode: appearance.mixBlendMode as React.CSSProperties['mixBlendMode'],
    isolation: appearance.isolation as React.CSSProperties['isolation'],
    overflow: (appearance.overflow ?? (element.cropMode === 'container-mask' ? 'hidden' : undefined)) as React.CSSProperties['overflow'],
    backgroundColor: appearance.backgroundColor ?? appearance.fill,
    backgroundImage: overrides.theme[element.id] ?? appearance.backgroundImage,
    color: appearance.color,
    borderRadius: element.shape === 'circle' || element.shape === 'ellipse' ? '50%' : appearance.borderRadiusPx,
    borderWidth: appearance.borderWidthPx,
    borderColor: appearance.borderColor,
    borderStyle: appearance.borderStyle as React.CSSProperties['borderStyle'],
    boxShadow: appearance.boxShadow,
    padding: appearance.paddingPx,
  };
  const children = elements.filter((item) => item.parentId === element.id).sort((a, b) => a.zIndex - b.zIndex);
  if (element.type === 'group') {
    return <div data-element-id={element.id} aria-label={element.name} style={style}>{children.map((child) => (
      <ElementNode key={child.id} element={child} parent={element} elements={elements} motions={motions} overrides={overrides} />
    ))}</div>;
  }
  if (element.type === 'text') {
    const content = overrides.content[element.id] ?? element.content ?? '';
    return <div data-element-id={element.id} aria-label={element.name} style={{
      ...style,
      display: 'flex',
      alignItems: appearance.verticalAlign === 'bottom' ? 'flex-end' : appearance.verticalAlign === 'top' ? 'flex-start' : 'center',
      justifyContent: appearance.textAlign === 'right' ? 'flex-end' : appearance.textAlign === 'center' ? 'center' : 'flex-start',
      fontFamily: appearance.fontFamily,
      fontSize: appearance.fontSizePx,
      fontWeight: appearance.fontWeight,
      lineHeight: appearance.lineHeight,
      letterSpacing: appearance.letterSpacingPx,
      textAlign: appearance.textAlign,
      whiteSpace: appearance.whiteSpace as React.CSSProperties['whiteSpace'],
      textShadow: appearance.textShadow,
      backgroundImage: appearance.textGradient,
      backgroundClip: appearance.textGradient ? 'text' : undefined,
      WebkitBackgroundClip: appearance.textGradient ? 'text' : undefined,
      WebkitTextFillColor: appearance.textGradient ? 'transparent' : undefined,
      WebkitTextStroke: appearance.textStrokePx ? `${appearance.textStrokePx}px ${appearance.textStrokeColor ?? 'currentColor'}` : undefined,
    }}>{state.textAnimation ? textContent(content, state.textAnimation, frame, element.id) : content}</div>;
  }
  if (element.type === 'image' || element.type === 'video') {
    const source = overrides.assets[element.id] ?? element.asset;
    if (!source) return null;
    const mediaStyle: React.CSSProperties = {
      width: '100%', height: '100%', objectFit: appearance.objectFit ?? 'cover', objectPosition: appearance.objectPosition,
      borderRadius: appearance.borderRadiusPx,
    };
    return <div data-element-id={element.id} aria-label={element.name} style={style}>
      {element.type === 'image' ? <Img src={mediaSource(source)} style={mediaStyle} /> : <OffthreadVideo src={mediaSource(source)} muted style={mediaStyle} />}
    </div>;
  }
  if (element.type === 'line') {
    return <div data-element-id={element.id} aria-label={element.name} style={{...style, height: 0, borderTop: `${appearance.borderWidthPx ?? 2}px ${appearance.borderStyle ?? 'solid'} ${appearance.borderColor ?? appearance.fill ?? '#fff'}`}} />;
  }
  return <div data-element-id={element.id} aria-label={element.name} style={style} />;
};

const sceneStyle = (state: MotionState): React.CSSProperties => ({
  translate: `${state.x}px ${state.y}px`,
  rotate: `${state.rotationDeg}deg`,
  scale: `${Math.max(0, state.scaleX)} ${Math.max(0, state.scaleY)}`,
  opacity: state.opacity * (state.revealMode === 'fade' ? state.reveal : 1),
  filter: `blur(${state.blurPx}px) brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation}) hue-rotate(${state.hueRotateDeg}deg)`,
  clipPath: revealClip(state),
});

export const CaseFromSpec: React.FC<{
  caseState: CaseState;
  layout: LayoutSpec;
  motion: MotionSpec;
  overrides: CaseProps;
}> = ({caseState, layout, motion, overrides}) => {
  const frame = useCurrentFrame();
  const camera = motionAt('@camera', motion.motions, frame);
  const scene = motionAt('@scene', motion.motions, frame);
  const transition = motionAt('@transition', motion.motions, frame);
  const activeSceneIds = new Set((layout.scenes ?? []).filter((item) => frame >= item.startFrame && frame <= item.endFrame).map((item) => item.id));
  const visibleElements = layout.scenes ? layout.elements.filter((item) => item.sceneId && activeSceneIds.has(item.sceneId)) : layout.elements;
  const rootElements = visibleElements.filter((item) => item.parentId === null).sort((a, b) => a.zIndex - b.zIndex);
  return <AbsoluteFill style={{backgroundColor: overrides.theme.background ?? layout.canvas.backgroundColor, overflow: 'hidden'}}>
    <AbsoluteFill style={sceneStyle(transition)}>
      <AbsoluteFill style={sceneStyle(scene)}>
        <AbsoluteFill style={sceneStyle(camera)}>
          {rootElements.map((element) => <ElementNode key={element.id} element={element} elements={visibleElements} motions={motion.motions} overrides={overrides} />)}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
    {caseState.source.hasAudio ? <Audio src={staticFile(caseState.files.source)} /> : null}
  </AbsoluteFill>;
};

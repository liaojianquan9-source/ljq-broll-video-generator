import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {motionAt} from './motion';
import {jumpInCharacterAt} from './text-entrance';
import type {
  Box,
  LineElement,
  MediaElement,
  MotionState,
  SceneGroup,
  SceneElement,
  SceneSpec,
  SceneTheme,
  ShapeElement,
  TextElement,
  ToneName,
} from './types';

const baseTheme = {
  background: '#191919',
  backgroundImage: undefined as string | undefined,
  backgroundSize: undefined as string | undefined,
  backgroundPosition: undefined as string | undefined,
  surface: '#5f5f5f',
  foreground: '#f0f0f0',
  muted: '#9a9a9a',
  accent: '#ef4444',
};

type ResolvedTheme = typeof baseTheme;

const resolveTheme = (theme: SceneTheme | undefined): ResolvedTheme => ({
  ...baseTheme,
  ...theme,
});

const toneColor = (tone: ToneName | undefined, theme: ResolvedTheme): string =>
  theme[tone ?? 'surface'];

const boxStyle = ([x, y, width, height]: Box): React.CSSProperties => ({
  position: 'absolute',
  left: `${x}%`,
  top: `${y}%`,
  width: `${width}%`,
  height: `${height}%`,
});

const elementMotionStyle = (
  motion: MotionState,
  canvasWidth: number,
  canvasHeight: number,
  transformOrigin?: string,
  clipReveal = true,
): React.CSSProperties => ({
  opacity: motion.opacity,
  transform: `translate(${(motion.x / 100) * canvasWidth}px, ${(motion.y / 100) * canvasHeight}px) rotate(${motion.rotation}deg) scale(${motion.scale * motion.scaleX}, ${motion.scale * motion.scaleY})`,
  transformOrigin: transformOrigin ?? 'center center',
  filter: motion.blur > 0.05 ? `blur(${motion.blur}px)` : undefined,
  clipPath:
    clipReveal && motion.reveal < 0.999
      ? `inset(0 ${(1 - motion.reveal) * 100}% 0 0)`
      : undefined,
});

const Placeholder: React.FC<{
  readonly element: Exclude<SceneElement, LineElement>;
  readonly theme: ResolvedTheme;
}> = ({element, theme}) => {
  const isCircle = element.type === 'shape' && element.shape === 'circle';
  const radius = isCircle
    ? '50%'
    : element.type === 'shape' && element.shape === 'rectangle'
      ? 0
      : element.type === 'image' || element.type === 'video'
        ? element.borderRadius ?? 18
        : 18;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: radius,
        backgroundColor: toneColor(element.tone, theme),
        border: `2px solid ${theme.foreground}44`,
        color: element.tone === 'foreground' ? theme.background : theme.foreground,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fontWeight: 500,
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {element.label ?? element.role ?? element.type}
    </div>
  );
};

const Shape: React.FC<{readonly element: ShapeElement; readonly theme: ResolvedTheme}> = ({
  element,
  theme,
}) => {
  const radius = element.shape === 'circle' ? '50%' : element.shape === 'rectangle' ? 0 : 18;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: radius,
        backgroundColor: element.fill ?? toneColor(element.tone, theme),
        backgroundImage: element.texture,
        backgroundSize: element.textureSize,
        backgroundPosition: element.texturePosition,
        boxShadow: element.boxShadow,
        border:
          element.borderWidth && element.borderWidth > 0
            ? `${element.borderWidth}px solid ${element.borderColor ?? theme.foreground}`
            : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
};

const Text: React.FC<{
  readonly element: TextElement;
  readonly theme: ResolvedTheme;
  readonly reveal: number;
  readonly frame: number;
  readonly fps: number;
}> = ({
  element,
  theme,
  reveal,
  frame,
  fps,
}) => {
  const baseSegments =
    element.segments && element.segments.length > 0
      ? element.segments
      : [{content: element.content ?? element.label ?? ''}];
  const totalCharacters = baseSegments.reduce(
    (sum, segment) => sum + Array.from(segment.content).length,
    0,
  );
  let remainingCharacters =
    element.revealMode === 'characters'
      ? Math.floor(totalCharacters * Math.min(1, Math.max(0, reveal)))
      : totalCharacters;
  const visibleSegments = baseSegments.map((segment) => {
    const characters = Array.from(segment.content);
    const visibleContent = characters.slice(0, Math.max(0, remainingCharacters)).join('');
    remainingCharacters -= characters.length;
    return {...segment, content: visibleContent};
  });
  const entrance = element.textEntrance;
  const entranceCharacters = visibleSegments.reduce(
    (sum, segment) =>
      sum + Array.from(segment.content).filter((character) => character !== '\n').length,
    0,
  );
  let entranceCharacterIndex = 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems:
          element.verticalAlign === 'top'
            ? 'flex-start'
            : element.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'center',
        color: element.color ?? toneColor(element.tone ?? 'foreground', theme),
        fontFamily: element.fontFamily ?? 'Arial, sans-serif',
        fontSize: element.fontSize ?? 48,
        fontWeight: element.fontWeight ?? 500,
        letterSpacing: element.letterSpacing,
        backgroundImage: element.gradient,
        backgroundClip: element.gradient ? 'text' : undefined,
        WebkitBackgroundClip: element.gradient ? 'text' : undefined,
        WebkitTextFillColor: element.gradient ? 'transparent' : undefined,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          textAlign: element.align ?? 'left',
          textIndent: element.textIndent ? `${element.textIndent}em` : undefined,
          whiteSpace: element.noWrap ? 'nowrap' : 'pre-wrap',
          lineHeight: element.lineHeight ?? 1.12,
        }}
      >
        <span style={{position: 'relative', zIndex: 1}}>
          {visibleSegments.map((segment, segmentIndex) => {
            const segmentStyle: React.CSSProperties = {
              color: segment.color,
              fontWeight: segment.fontWeight,
              fontFamily: segment.fontFamily,
              fontSize: segment.fontSize,
              letterSpacing: segment.letterSpacing,
              textShadow: segment.textShadow ?? element.textShadow,
            };

            if (!entrance || entrance.preset !== 'jump-in') {
              return (
                <span key={`${element.id}-segment-${segmentIndex}`} style={segmentStyle}>
                  {segment.content}
                </span>
              );
            }

            return Array.from(segment.content).map((character, localIndex) => {
              if (character === '\n') {
                return <br key={`${element.id}-${segmentIndex}-${localIndex}-line-break`} />;
              }
              const characterIndex = entranceCharacterIndex;
              entranceCharacterIndex += 1;
              const state = jumpInCharacterAt({
                frame,
                startFrame: entrance.startFrame ?? 0,
                durationInFrames: entrance.durationInFrames ?? Math.round(1.2 * fps),
                characterIndex,
                characterCount: entranceCharacters,
                intensity: entrance.intensity,
              });
              return (
                <span
                  key={`${element.id}-${segmentIndex}-${localIndex}`}
                  style={{
                    ...segmentStyle,
                    display: 'inline-block',
                    opacity: state.opacity,
                    translate: `${state.xEm}em ${state.yEm}em`,
                  }}
                >
                  {character === ' ' ? '\u00a0' : character}
                </span>
              );
            });
          })}
        </span>
      </div>
    </div>
  );
};

const TextAnchoredShape: React.FC<{
  readonly element: ShapeElement;
  readonly target: TextElement;
  readonly theme: ResolvedTheme;
}> = ({element, target, theme}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const motion = motionAt(frame, element.tracks, element.oscillations);
  const segments =
    target.segments && target.segments.length > 0
      ? target.segments
      : [{content: target.content ?? target.label ?? ''}];
  const anchoredSegment = element.textAnchor?.segmentIndex ?? -1;

  return (
    <div style={{...boxStyle(target.box), zIndex: element.zIndex ?? 0}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems:
            target.verticalAlign === 'top'
              ? 'flex-start'
              : target.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'center',
          fontFamily: target.fontFamily ?? 'Arial, sans-serif',
          fontSize: target.fontSize ?? 48,
          fontWeight: target.fontWeight ?? 500,
          letterSpacing: target.letterSpacing,
          overflow: 'hidden',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      >
        <div
          style={{
            width: '100%',
            textAlign: target.align ?? 'left',
            textIndent: target.textIndent ? `${target.textIndent}em` : undefined,
            whiteSpace: target.noWrap ? 'nowrap' : 'pre-wrap',
            lineHeight: target.lineHeight ?? 1.12,
          }}
        >
          {segments.map((segment, segmentIndex) =>
            segmentIndex === anchoredSegment ? (
              <span
                key={`${element.id}-anchor-${segmentIndex}`}
                style={{position: 'relative', display: 'inline-block'}}
              >
                {segment.content}
                <span
                  style={{
                    position: 'absolute',
                    left: -(element.textAnchor?.paddingLeft ?? 0),
                    right: -(element.textAnchor?.paddingRight ?? 0),
                    top: element.textAnchor?.top ?? 0,
                    bottom: element.textAnchor?.bottom ?? 0,
                    backgroundColor: element.fill ?? toneColor(element.tone, theme),
                    backgroundImage: element.texture,
                    backgroundSize: element.textureSize,
                    backgroundPosition: element.texturePosition,
                    boxShadow: element.boxShadow,
                    ...elementMotionStyle(
                      motion,
                      width,
                      height,
                      element.transformOrigin ?? 'left bottom',
                    ),
                  }}
                />
              </span>
            ) : (
              <span key={`${element.id}-anchor-${segmentIndex}`}>{segment.content}</span>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

const mediaSource = (src: string): string =>
  /^(https?:|data:|blob:)/.test(src) ? src : staticFile(src);

const Media: React.FC<{readonly element: MediaElement}> = ({element}) => {
  if (!element.src) return null;
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: element.fit ?? 'cover',
    borderRadius: element.borderRadius ?? 0,
  };
  if (element.type === 'video') {
    return (
      <OffthreadVideo
        src={mediaSource(element.src)}
        muted
        playbackRate={element.playbackRate ?? 1}
        style={style}
      />
    );
  }
  return <Img src={mediaSource(element.src)} style={style} />;
};

const BoxElement: React.FC<{
  readonly element: Exclude<SceneElement, LineElement>;
  readonly reference: boolean;
  readonly theme: ResolvedTheme;
}> = ({element, reference, theme}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const motion = motionAt(frame, element.tracks, element.oscillations);
  const clipReveal = element.type !== 'text' || element.revealMode !== 'characters';

  return (
    <div
      style={{
        ...boxStyle(element.box),
        ...elementMotionStyle(motion, width, height, element.transformOrigin, clipReveal),
        mixBlendMode: element.type === 'text' ? element.mixBlendMode : undefined,
        zIndex: element.zIndex ?? 0,
      }}
    >
      {reference ? (
        <Placeholder element={element} theme={theme} />
      ) : element.type === 'shape' ? (
        <Shape element={element} theme={theme} />
      ) : element.type === 'text' ? (
        <Text element={element} theme={theme} reveal={motion.reveal} frame={frame} fps={fps} />
      ) : (
        <Media element={element} />
      )}
    </div>
  );
};

const renderElement = (
  element: SceneElement,
  reference: boolean,
  theme: ResolvedTheme,
  elementById: ReadonlyMap<string, SceneElement>,
): React.ReactNode =>
  !reference && element.type === 'shape' && element.textAnchor ? (
    (() => {
      const target = elementById.get(element.textAnchor.elementId);
      return target?.type === 'text' ? (
        <TextAnchoredShape key={element.id} element={element} target={target} theme={theme} />
      ) : null;
    })()
  ) : element.type === 'line' ? (
    <Line key={element.id} element={element} theme={theme} />
  ) : (
    <BoxElement key={element.id} element={element} reference={reference} theme={theme} />
  );

const GroupLayer: React.FC<{
  readonly group: SceneGroup;
  readonly elements: readonly SceneElement[];
  readonly reference: boolean;
  readonly theme: ResolvedTheme;
  readonly elementById: ReadonlyMap<string, SceneElement>;
}> = ({group, elements, reference, theme, elementById}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const motion = motionAt(frame, group.tracks, group.oscillations);

  return (
    <div
      data-group-id={group.id}
      aria-label={group.label ?? group.id}
      style={{
        position: 'absolute',
        inset: 0,
        ...elementMotionStyle(motion, width, height, group.transformOrigin),
        zIndex: group.zIndex ?? 0,
      }}
    >
      {elements.map((element) => renderElement(element, reference, theme, elementById))}
    </div>
  );
};

const Line: React.FC<{
  readonly element: LineElement;
  readonly theme: ResolvedTheme;
}> = ({element, theme}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const motion = motionAt(frame, element.tracks, element.oscillations);
  const x1 = (element.from[0] / 100) * width;
  const y1 = (element.from[1] / 100) * height;
  const x2 = (element.to[0] / 100) * width;
  const y2 = (element.to[1] / 100) * height;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const dx = (motion.x / 100) * width;
  const dy = (motion.y / 100) * height;

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: element.zIndex ?? 0,
        opacity: motion.opacity,
        filter: motion.blur > 0.05 ? `blur(${motion.blur}px)` : undefined,
        overflow: 'visible',
      }}
    >
      <g
        transform={`translate(${dx} ${dy}) rotate(${motion.rotation} ${centerX} ${centerY}) translate(${centerX} ${centerY}) scale(${motion.scale * motion.scaleX} ${motion.scale * motion.scaleY}) translate(${-centerX} ${-centerY})`}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={element.color ?? toneColor(element.tone ?? 'accent', theme)}
          strokeWidth={element.lineWidth ?? 3}
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - motion.reveal)}
        />
      </g>
    </svg>
  );
};

export const BrollScene: React.FC<SceneSpec> = (scene) => {
  const theme = resolveTheme(scene.theme);
  const reference = (scene.renderMode ?? 'reference') === 'reference';
  const elements = [...scene.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const groupedIds = new Set((scene.groups ?? []).flatMap((group) => [...group.elementIds]));
  const ungroupedElements = elements.filter((element) => !groupedIds.has(element.id));

  return (
    <AbsoluteFill
style={{
backgroundColor: theme.background,
backgroundImage: theme.backgroundImage,
backgroundSize: theme.backgroundSize,
backgroundPosition: theme.backgroundPosition,
overflow: 'hidden',
color: "#000000"
}}
 >
      {ungroupedElements.map((element) => renderElement(element, reference, theme, elementById))}
      {(scene.groups ?? []).map((group) => (
        <GroupLayer
          key={group.id}
          group={group}
          elements={group.elementIds
            .map((id) => elementById.get(id))
            .filter((element): element is SceneElement => element !== undefined)
            .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))}
          reference={reference}
          theme={theme}
          elementById={elementById}
        />
      ))}
    </AbsoluteFill>
  );
};

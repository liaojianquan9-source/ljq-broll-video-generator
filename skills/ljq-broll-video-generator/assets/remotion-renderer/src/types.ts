export type Box = readonly [number, number, number, number];
export type Point = readonly [number, number];

export type RenderMode = 'reference' | 'final';
export type ElementType = 'shape' | 'text' | 'image' | 'video' | 'line';
export type MotionProperty =
  | 'x'
  | 'y'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'rotation'
  | 'opacity'
  | 'blur'
  | 'reveal';
export type OscillationProperty = 'x' | 'y' | 'scale' | 'rotation';
export type EasingName = 'linear' | 'in-out-cubic' | 'out-cubic' | 'out-back';
export type EvidenceType = 'measured' | 'observed' | 'inferred' | 'default';
export type ToneName = 'background' | 'surface' | 'foreground' | 'muted' | 'accent';

export type MotionKeyframe = {
  readonly frame: number;
  readonly value: number;
};

export type MotionTrack = {
  readonly property: MotionProperty;
  readonly keyframes: readonly MotionKeyframe[];
  readonly easing?: EasingName;
  readonly evidence?: EvidenceType;
};

export type Oscillation = {
  readonly property: OscillationProperty;
  readonly start: number;
  readonly end?: number;
  readonly amplitude: number;
  readonly period: number;
  readonly phase?: number;
  readonly evidence?: EvidenceType;
};

type SharedElement = {
  readonly id: string;
  readonly type: ElementType;
  readonly label?: string;
  readonly role?: string;
  readonly groupId?: string;
  readonly zIndex?: number;
  readonly tone?: ToneName;
  readonly transformOrigin?: string;
  readonly tracks?: readonly MotionTrack[];
  readonly oscillations?: readonly Oscillation[];
};

export type SceneGroup = {
  readonly id: string;
  readonly label?: string;
  readonly elementIds: readonly string[];
  readonly zIndex?: number;
  readonly transformOrigin?: string;
  readonly tracks?: readonly MotionTrack[];
  readonly oscillations?: readonly Oscillation[];
};

export type ShapeElement = SharedElement & {
  readonly type: 'shape';
  readonly box: Box;
  readonly shape?: 'rectangle' | 'rounded' | 'circle';
  readonly fill?: string;
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly texture?: string;
  readonly textureSize?: string;
  readonly texturePosition?: string;
  readonly boxShadow?: string;
  readonly textAnchor?: {
    readonly elementId: string;
    readonly segmentIndex: number;
    readonly paddingLeft?: number;
    readonly paddingRight?: number;
    readonly top?: number;
    readonly bottom?: number;
  };
};

export type TextSegment = {
  readonly content: string;
  readonly color?: string;
  readonly fontWeight?: 400 | 500 | 600 | 700 | 800 | 900;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly letterSpacing?: number;
  readonly textShadow?: string;
};

export type TextEntrance = {
  readonly preset: 'jump-in';
  readonly startFrame?: number;
  readonly durationInFrames?: number;
  readonly intensity?: number;
};

export type TextElement = SharedElement & {
  readonly type: 'text';
  readonly box: Box;
  readonly content?: string;
  readonly segments?: readonly TextSegment[];
  readonly fontSize?: number;
  readonly fontWeight?: 400 | 500 | 600 | 700 | 800 | 900;
  readonly align?: 'left' | 'center' | 'right';
  readonly color?: string;
  readonly mixBlendMode?: 'normal' | 'difference';
  readonly fontFamily?: string;
  readonly letterSpacing?: number;
  readonly textShadow?: string;
  readonly gradient?: string;
  readonly revealMode?: 'clip' | 'characters';
  readonly textIndent?: number;
  readonly lineHeight?: number;
  readonly verticalAlign?: 'top' | 'center' | 'bottom';
  readonly noWrap?: boolean;
  readonly textEntrance?: TextEntrance;
};

export type MediaElement = SharedElement & {
  readonly type: 'image' | 'video';
  readonly box: Box;
  readonly src?: string;
  readonly fit?: 'cover' | 'contain' | 'fill';
  readonly borderRadius?: number;
  readonly playbackRate?: number;
};

export type LineElement = SharedElement & {
  readonly type: 'line';
  readonly from: Point;
  readonly to: Point;
  readonly color?: string;
  readonly lineWidth?: number;
};

export type SceneElement = ShapeElement | TextElement | MediaElement | LineElement;

export type SceneTheme = {
  readonly background?: string;
  readonly backgroundImage?: string;
  readonly backgroundSize?: string;
  readonly backgroundPosition?: string;
  readonly surface?: string;
  readonly foreground?: string;
  readonly muted?: string;
  readonly accent?: string;
};

export type SceneSpec = {
  readonly schemaVersion: '1.0';
  readonly id: string;
  readonly renderMode?: RenderMode;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly fps: number;
    readonly durationInFrames: number;
  };
  readonly theme?: SceneTheme;
  readonly focus?: readonly string[];
  readonly groups?: readonly SceneGroup[];
  readonly elements: readonly SceneElement[];
};

export type MotionState = {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotation: number;
  readonly opacity: number;
  readonly blur: number;
  readonly reveal: number;
};

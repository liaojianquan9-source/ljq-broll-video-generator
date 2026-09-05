import React, {useLayoutEffect, useState} from 'react';
import {AbsoluteFill, Composition, Interactive, continueRender, delayRender, registerRoot, staticFile, useCurrentFrame} from 'remotion';
import {casePropsSchema, type CaseProps} from './schema';
import {MotionEnabled, MotionGroup, useElementMotion, useTextMotion, useWhiteGlyphReveal} from './motion-state';

type Box = [number, number, number, number];
type InkProps = {
  id: string; text: string; box: Box; family?: string; weight?: number;
  colors?: string[]; stroke?: string; strokeWidth?: number; opacity?: number;
  glow?: number; glowColor?: string; texture?: string; textureOpacity?: number;
  grain?: number; spacing?: number; patchy?: boolean;
};

// Target rectangles describe visible ink, not CSS line boxes. Measurements
// come from live text and installed fonts, never from reference pixels.
const Ink: React.FC<InkProps> = ({id, text, box, family = 'Songti SC', weight = 900,
  colors = ['#fff', '#c5c9cb'], stroke = 'none', strokeWidth = 0, opacity = 1,
  glow = 0, glowColor = '#fff', texture, textureOpacity = 0.5, grain = 0, spacing = 0, patchy = false}) => {
  const [handle] = useState(() => delayRender(`Measure editable ${id}`));
  const [ink, setInk] = useState({x: 0, y: -90, width: 400, height: 100, advances: [] as number[]});
  const motion = useElementMotion(id);
  const characters = Array.from(text);
  const textMotion = useTextMotion(id, characters.length);
  const whiteReveal = useWhiteGlyphReveal(id);
  useLayoutEffect(() => {
    let alive = true;
    document.fonts.load(`${weight} 100px "${family}"`).then(() => document.fonts.ready).then(() => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${weight} 100px "${family}"`;
      ctx.letterSpacing = `${spacing}px`;
      const m = ctx.measureText(text || ' ');
      if (alive) setInk({x: -m.actualBoundingBoxLeft, y: -m.actualBoundingBoxAscent,
        width: Math.max(1, m.actualBoundingBoxLeft + m.actualBoundingBoxRight),
        height: Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent),
        advances: characters.map((_, i) => ctx.measureText(characters.slice(0, i).join('')).width)});
      continueRender(handle);
    });
    return () => {alive = false;};
  }, [family, weight, text, spacing, handle]);
  const glyph = {fontFamily: family, fontWeight: weight, fontSize: 100, letterSpacing: spacing};
  return <Interactive.Div name={id} data-element-id={id}
    style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], ...motion.style, opacity: opacity * motion.opacity,
      filter: `blur(${motion.blur + (id.startsWith('moon-title') ? 0.85 : 0)}px) brightness(${motion.brightness})`}}>
    <svg width="100%" height="100%" viewBox={`${ink.x} ${ink.y} ${ink.width} ${ink.height}`} preserveAspectRatio="none" style={{overflow: 'visible'}}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2={id === 'parameter-main-number' ? '1' : '0'} y2={id === 'parameter-main-number' ? '0' : '1'}
          gradientTransform={id === 'parameter-main-number' ? 'matrix(1 0 0.28 1 -0.05 0)' : undefined}>
          {colors.map((color, i) => <stop key={i} offset={`${i / Math.max(1, colors.length - 1) * 100}%`} stopColor={color} />)}
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={ink.x - 5} y={ink.y - 5} width={ink.width + 10} height={ink.height + 10}>
          <text x="0" y="0" {...glyph} fill="white">{text}</text>
        </mask>
        <filter id={`${id}-soft`} x="-50%" y="-70%" width="200%" height="240%"><feGaussianBlur stdDeviation={glow} /></filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="23" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <radialGradient id={`${id}-patch-fade`}><stop offset="32%" stopColor="white" /><stop offset="100%" stopColor="black" /></radialGradient>
        <mask id={`${id}-patches`} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill="black" />
          <ellipse cx="0.1" cy="0.17" rx="0.15" ry="0.28" fill={`url(#${id}-patch-fade)`} />
          <ellipse cx="0.46" cy="0.91" rx="0.19" ry="0.20" fill={`url(#${id}-patch-fade)`} />
          <ellipse cx="0.7" cy="0.18" rx="0.075" ry="0.25" fill={`url(#${id}-patch-fade)`} />
          <ellipse cx="0.78" cy="0.83" rx="0.07" ry="0.28" fill={`url(#${id}-patch-fade)`} />
        </mask>
      <g id={`${id}-art`}>
      {glow > 0 && <text aria-hidden="true" x="0" y="0" {...glyph} fill={glowColor} opacity="0.54" filter={`url(#${id}-soft)`}>{text}</text>}
      <text x="0" y="0" {...glyph} fill={`url(#${id}-fill)`} stroke={stroke} strokeWidth={strokeWidth} paintOrder="stroke fill">{text}</text>
      {texture && <g mask={`url(#${id}-mask)`}>
        <image data-element-id={`${id}-texture`} href={staticFile(texture)} x={ink.x} y={ink.y} width={ink.width} height={ink.height}
          preserveAspectRatio="xMidYMid slice" opacity={textureOpacity} mask={patchy ? `url(#${id}-patches)` : undefined} />
      </g>}
      {grain > 0 && <g mask={`url(#${id}-mask)`} opacity={grain} style={{mixBlendMode: 'multiply'}}>
        <rect x={ink.x} y={ink.y} width={ink.width} height={ink.height} filter={`url(#${id}-grain)`} />
      </g>}
      {whiteReveal > 0 && <text x="0" y="0" {...glyph} fill="white" opacity={whiteReveal}>{text}</text>}
      </g>
      {characters.map((_, i) => {
        const left = i === 0 ? ink.x - 5 : ink.advances[i] || 0;
        const right = i === characters.length - 1 ? ink.x + ink.width + 5 : ink.advances[i + 1] || ink.width;
        return <clipPath key={i} id={`${id}-char-${i}`}><rect x={left} y={ink.y - ink.height * 4} width={Math.max(1, right - left)} height={ink.height * 9} /></clipPath>;
      })}
      </defs>
      {textMotion ? characters.map((_, i) => {
        const m = textMotion[i];
        const cy = ink.y + ink.height / 2;
        return <g key={i} opacity={m.opacity} transform={`translate(0 ${m.y * ink.height / box[3]}) translate(0 ${cy}) scale(1 ${m.scaleY}) translate(0 ${-cy})`}
          style={{filter: m.blur ? `blur(${m.blur * ink.height / box[3]}px)` : undefined}}>
          <use href={`#${id}-art`} clipPath={`url(#${id}-char-${i})`} />
        </g>;
      }) : <use href={`#${id}-art`} />}
    </svg>
  </Interactive.Div>;
};

const Rule: React.FC<{id: string; box: Box; color?: string; opacity?: number}> = ({id, box, color = '#a2b3bf', opacity = 0.42}) => {
  const m = useElementMotion(id);
  return <Interactive.Div name={id} data-element-id={id} style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], backgroundColor: color, ...m.style, opacity: opacity * m.opacity}} />;
};

const SceneOverlayTitle: React.FC<CaseProps> = (p) => <AbsoluteFill style={{backgroundColor: p.aRollBackground, overflow: 'hidden'}}>
  <Interactive.Div name="A-roll excluded · white review backing" data-element-id="overlay-blank-background" style={{position: 'absolute', inset: 0, backgroundColor: p.aRollBackground}} />
  <MotionGroup id="@camera" scope="overlay-camera">
  <Ink id="earth-title" text={p.earthTitle} box={[123, 134, 341, 182]} family={p.displayFont}
    colors={[p.paperWhite, '#c3cbd0', '#f0f3ef']} grain={0.38} />
  <Ink id="parameter-label" text={p.parameterLabel} box={[235, 329, 231, 64]} family={p.displayFont}
    colors={['#f4f9f2', p.paperWhite, '#b8ced4']} grain={0.32} />
  <Ink id="emphasis-da" text={p.emphasisCharacter} box={[98, 353, 198, 209]} family={p.displayFont}
    colors={[p.accentCyan, '#93d4dd', '#67bad0']} />
  <Ink id="open-source-title" text={p.openSourceTitle} box={[768, 180, 447, 360]} family={p.displayFont}
    colors={['#b4dae9', p.iceBlue, '#b3cdda']} grain={0.32} />
  </MotionGroup>
</AbsoluteFill>;

const SceneParameterBoard: React.FC<CaseProps> = (p) => <AbsoluteFill style={{backgroundColor: p.backgroundDark, overflow: 'hidden'}}>
  <Interactive.Div name="Parameter board background" data-element-id="parameter-tech-background" style={{position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(ellipse at 52% 51%,#1c242f 0%,#11151e 49%,#080a0e 94%)'}} />
  <MotionGroup id="@camera" scope="parameter-camera">
  <Interactive.Div name="Broad soft halo" data-element-id="parameter-radial-glow" style={{position: 'absolute', left: 178, top: 210, width: 863, height: 355,
    backgroundImage: `radial-gradient(ellipse,${p.iceBlue}20,transparent 69%)`, filter: 'blur(18px)'}} />
  <Rule id="parameter-top-rule" box={[0, 68, 1280, 1.6]} opacity={0.2} />
  <Rule id="parameter-bottom-rule" box={[0, 651, 1280, 1.6]} opacity={0.17} />
  <Rule id="parameter-left-rule" box={[77, 0, 1.6, 720]} opacity={0.14} />
  <Rule id="parameter-right-rule" box={[1200, 0, 1.6, 720]} opacity={0.13} />
  <svg data-element-id="parameter-rule-weathering" width="1280" height="720" style={{position: 'absolute', opacity: 0.27}}>
    <path d="M44 68H355 M414 68H763 M990 68H1143 M85 651H325 M734 651H923 M1040 651H1172" fill="none" stroke="#a4adb1" strokeWidth="2" strokeDasharray="11 5 2 7 29 3 3 6" />
  </svg>
  <Ink id="parameter-main-number" text={p.mainNumber} box={[228, 233, 439, 271]} family={p.numberFont} weight={400}
    colors={p.numberColors} glow={1.2} glowColor="#6b9dae" />
  <Ink id="parameter-billion-unit" text={p.billionUnit} box={[677, 238, 175, 274]} family={p.displayFont}
    colors={['#c5e8f5', p.iceBlue, '#a3d3e7']} />
  <Rule id="parameter-bracket-top" box={[854, 276, 140, 1.4]} opacity={0.72} />
  <Rule id="parameter-bracket-right" box={[992, 276, 1.4, 83]} opacity={0.66} />
  <Rule id="parameter-hairline" box={[838, 434, 132, 0.8]} opacity={0.1} />
  <Interactive.Div name="Annotation" data-element-id="parameter-annotation" style={{position: 'absolute', left: 894, top: 374, width: 124, height: 42}}>
    <Ink id="annotation-line-1" text={p.annotationCopy.split('\n')[0] || ''} box={[0, 0, 124, 13]} family="Songti SC" weight={700} colors={['#c3c5c6', '#c3c5c6']} />
    <Ink id="annotation-line-2" text={p.annotationCopy.split('\n').slice(1).join(' ') || ''} box={[77, 29, 47, 13]} family="Songti SC" weight={700} colors={['#c3c5c6', '#c3c5c6']} />
  </Interactive.Div>
  <Ink id="parameter-weights-script" text={p.weightsLabel} box={[832, 389, 129, 65]} family={p.scriptFont} weight={400}
    colors={['#9c9dff', '#7679f4']} />
  <Ink id="parameter-unit-label" text={p.parameterUnit} box={[849, 431, 175, 85]} family={p.displayFont}
    colors={['#e2e3df', '#c8c7c4']} />
  </MotionGroup>
  <Interactive.Div name="Edge vignette" data-element-id="parameter-vignette" style={{position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(ellipse at center,transparent 40%,#00000054 100%)', pointerEvents: 'none'}} />
</AbsoluteFill>;

const Planet: React.FC<{id: string; src: string; box: Box; rotation: number; blur: number}> = ({id, src, box, rotation, blur}) => {
  const m = useElementMotion(id);
  return <div style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], ...m.style}}>
  <Interactive.Div name={id} data-element-id={id} style={{position: 'absolute', inset: 0,
    borderRadius: '50%', overflow: 'hidden', rotate: `${rotation}deg`, filter: `grayscale(1) brightness(0.69) contrast(1.08) blur(${blur + m.blur}px)`,
    boxShadow: '-2px 0 3px #5c9eb37a'}}>
    <svg width="100%" height="100%" viewBox="494 64 948 948" preserveAspectRatio="none">
      <image href={staticFile(src)} width="1920" height="1080" preserveAspectRatio="xMidYMid slice" />
      <defs><radialGradient id={`${id}-shade`} cx="34%" cy="23%" r="83%"><stop offset="30%" stopColor="#0e1013" stopOpacity="0" /><stop offset="100%" stopColor="#020304" stopOpacity="0.73" /></radialGradient></defs>
      <circle cx="968" cy="538" r="474" fill={`url(#${id}-shade)`} />
    </svg>
  </Interactive.Div></div>;
};

const SceneKimiSpace: React.FC<CaseProps> = (p) => <AbsoluteFill style={{backgroundColor: '#101010', overflow: 'hidden'}}>
  <Interactive.Div name="Space background" data-element-id="space-background" style={{position: 'absolute', inset: 0, backgroundColor: p.backgroundDark}} />
  <MotionGroup id="@camera" scope="space-entry-camera">
  <MotionGroup id="@camera" scope="space-exit-camera">
  <MotionGroup id="space-backdrop-group">
  <Ink id="moon-title-fill" text={p.moonTitle} box={[148, 94, 973, 546]} family={p.displayFont}
    colors={['#111112', '#121214']} texture={p.moonTexture} textureOpacity={0.50} opacity={0.85} patchy />
  <Ink id="moon-title-outline" text={p.moonTitle} box={[148, 94, 973, 546]} family={p.displayFont}
    colors={['transparent', 'transparent']} stroke="#47494a" strokeWidth={0.38} opacity={0.52} />
  </MotionGroup>
  <Planet id="planet-top-right" src={p.moonTopImage} box={[922, -291, 656, 656]} rotation={24} blur={1.3} />
  <Planet id="planet-bottom-left" src={p.moonBottomImage} box={[-311, 375, 676, 676]} rotation={-37} blur={1.9} />
  <MotionGroup id="space-title-group">
  <Interactive.Div name="K3 blue halo" data-element-id="k3-glow" style={{position: 'absolute', left: 687, top: 273, width: 245, height: 182,
    backgroundImage: `radial-gradient(ellipse,${p.primaryBlue}34,transparent 70%)`, filter: 'blur(12px)'}} />
  <Rule id="title-frame-top" box={[325, 267, 630, 1]} opacity={0.35} />
  <Rule id="title-frame-bottom" box={[325, 453, 630, 1]} opacity={0.35} />
  <Rule id="title-frame-left" box={[325, 267, 1, 187]} opacity={0.35} />
  <Rule id="title-frame-right" box={[955, 267, 1, 187]} opacity={0.35} />
  <Rule id="title-node-top-left" box={[321, 263, 8, 8]} color={p.iceBlue} opacity={1} />
  <Rule id="title-node-bottom-right" box={[951, 449, 8, 8]} color={p.iceBlue} opacity={1} />
  <Ink id="kimi-title" text={p.kimiTitle} box={[374, 302, 306, 117]} family={p.latinFont} weight={700} spacing={5.5}
    colors={['#ffffff', '#ececeb', '#bfbfc0']} glow={5} glowColor="#fffde7" />
  <Interactive.Div name="Diamond separator" data-element-id="title-separator" style={{position: 'absolute', left: 704, top: 353, width: 14, height: 14,
    rotate: '45deg', backgroundColor: p.iceBlue, boxShadow: `0 0 12px ${p.accentCyan}60`}} />
  <Ink id="k3-title" text={p.k3Title} box={[738, 301, 163, 119]} family={p.latinFont} weight={700}
    colors={['#b5dff5', '#6d98e6', p.primaryBlue]} stroke="#c8e5f0" strokeWidth={0.65} glow={3} glowColor={p.primaryBlue} />
  </MotionGroup>
  </MotionGroup>
  </MotionGroup>
</AbsoluteFill>;

export const KimiK3Replica: React.FC<CaseProps> = (props) => {
  const frame = useCurrentFrame();
  const animated = props.motionEnabled !== false;
  return <MotionEnabled.Provider value={animated}>
    <AbsoluteFill style={{backgroundColor: props.aRollBackground}}>
      {frame <= (animated ? 103 : 98) && <SceneOverlayTitle {...props} />}
      {frame >= (animated ? 92 : 99) && frame <= 171 && <MotionGroup id="@transition" scope="parameter-incoming"><SceneParameterBoard {...props} /></MotionGroup>}
      {frame >= 172 && frame <= (animated ? 301 : 299) && <MotionGroup id="@transition" scope="space-outgoing"><SceneKimiSpace {...props} /></MotionGroup>}
      {frame >= 302 && <AbsoluteFill data-element-id="excluded-blank-background" style={{backgroundColor: props.aRollBackground}} />}
    </AbsoluteFill>
  </MotionEnabled.Provider>;
};

const FontEvidence: React.FC = () => <AbsoluteFill style={{backgroundColor: '#171a1e', color: '#eee', fontFamily: 'Arial', padding: 28}}>
  <style>{`@font-face{font-family:'Helvetica Condensed Black';src:local('HelveticaNeue-CondensedBlack');font-weight:900;}`}</style>
  <div style={{fontSize: 24}}>Editable font candidates · matched visible bounds · no texture or shadow</div>
  {[
    {text: '地球上', fonts: ['Songti SC', 'Songti SC', 'Hiragino Mincho ProN'], weights: [900, 700, 600], y: 85, height: 83},
    {text: '28000', fonts: ['Impact', 'Helvetica Condensed Black', 'DIN Condensed'], weights: [400, 900, 700], y: 232, height: 95},
    {text: 'KIMI K3', fonts: ['Helvetica Neue', 'Arial', 'Avenir Next'], weights: [700, 700, 700], y: 393, height: 64},
    {text: 'Weights', fonts: ['Savoye LET', 'Snell Roundhand', 'Brush Script MT'], weights: [400, 400, 400], y: 521, height: 65},
  ].map((row, r) => row.fonts.map((font, c) => <React.Fragment key={`${r}-${c}`}>
    <div style={{position: 'absolute', left: 38 + c * 420, top: row.y - 26, fontSize: 17, color: '#9ba8b2'}}>{font} {row.weights[c]}</div>
    <Ink id={`font-${r}-${c}`} text={row.text} family={font} weight={row.weights[c]} box={[38 + c * 420, row.y, 325, row.height]} colors={['#fff', '#fff']} />
  </React.Fragment>))}
</AbsoluteFill>;

const Root: React.FC = () => <>
  <Composition id="LjqBrollCase" component={KimiK3Replica} width={1280} height={720} fps={30} durationInFrames={330} schema={casePropsSchema}
    defaultProps={{
      motionEnabled: true,
      earthTitle: '地球上', parameterLabel: '参数量', emphasisCharacter: '大', openSourceTitle: '开源模型',
      mainNumber: '28000', billionUnit: '亿', parameterUnit: '个参数', weightsLabel: 'Weights',
      annotationCopy: '*大语言模型（LLM）内部的\n权重的数量', moonTitle: '月之暗面', kimiTitle: 'KIMI', k3Title: 'K3',
      backgroundDark: '#101010', aRollBackground: '#ffffff', primaryBlue: '#3557c0', iceBlue: '#b2ddeb', accentCyan: '#87dce1', paperWhite: '#e9eeeb',
      displayFont: 'Songti SC', numberFont: 'Impact', latinFont: 'Helvetica Neue', scriptFont: 'Savoye LET',
      numberColors: ['#294f7b', '#7cacbe', '#b2ddeb', '#70a9c1', '#2d5c83'],
      moonTopImage: 'moon/nasa-lro-farside-1920.jpg', moonBottomImage: 'moon/nasa-lro-farside-1920.jpg', moonTexture: 'moon/nasa-lroc-color-2k.jpg',
    }} />
  <Composition id="FontEvidence" component={FontEvidence} width={1280} height={660} fps={30} durationInFrames={1} />
</>;
registerRoot(Root);

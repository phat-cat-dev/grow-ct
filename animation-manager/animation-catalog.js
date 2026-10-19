// Catalog of hand-drawn "note taking" marks, each extracted from
// .dev/assets/gallery/marks.html as one self-contained, re-colourable,
// re-animatable unit. Pure data: no DOM, no styling decisions. The engine
// (animation-manager-engine.js) turns an entry + instance options into markup
// and CSS; the manager (animation-manager.js) renders, tunes and injects them.
//
// Each entry:
//   id        unique slug (stable; used by keywords, exports and the API)
//   name      human label
//   category  grouping key (see CATEGORIES)
//   kind      'wrap' | 'glyph' | 'wide' | 'hl' | 'note'
//   keywords  words an agent can match on to pick this mark
//   color     default semantic colour role (see COLOR_ROLES)
//   needsText true when the mark wraps / contains text (wrap, hl, note)
//   anim      'draw' | 'hlsweep' | 'wipe' | 'stretch' | 'none'
//   vb        SVG viewBox (svg-based kinds)
//   pos       positioning preset for wrap marks: u uu wav str scr ov box brk bigoval
//   svg       inner SVG markup (strokes in class="am-ink" / dashes in "am-dash")
//   html      full template for hl / note kinds; {{text}} and {{over}} are slots
//   sample    default text for text-bearing marks
//   stretch   add preserveAspectRatio="none" (wrap marks drawn to fit the word)
//
// Ink strokes paint with stroke:currentColor; the element's `color` (or, for a
// highlighter, its `--c`) is driven by a semantic colour token, so a mark
// follows the page theme and can be recoloured without touching its geometry.

export const COLOR_ROLES = [
  ['accent', 'Accent / brand'],
  ['positive', 'Positive (green)'],
  ['negative', 'Negative (red)'],
  ['neutral', 'Neutral (amber)'],
  ['comment', 'Comment (violet)'],
  ['pen', "Teacher's pen"],
  ['ink', 'Ink (text colour)'],
];

export const CATEGORIES = [
  ['emphasis', 'Emphasis on words'],
  ['highlighter', 'Highlighters'],
  ['standalone', 'Ticks, arrows, stars'],
  ['shapes', 'Arrows, shapes & lines'],
  ['ovals', 'Ovals & rectangles'],
  ['notes', 'Handwritten notes'],
];

export const CATALOG = [
  // ---- EMPHASIS: marks that wrap a word -----------------------------------
  { id: 'underline', name: 'Underline', category: 'emphasis', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'u', stretch: true, sample: 'underline',
    vb: '0 0 200 12', svg: '<path class="am-ink" pathLength="1" d="M4 7 C 60 1,120 11,196 6"/>',
    keywords: ['underline', 'underscore', 'emphasise', 'emphasize'] },
  { id: 'double-underline', name: 'Double underline', category: 'emphasis', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'uu', stretch: true, sample: 'double',
    vb: '0 0 200 16', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s" d="M4 5 C 60 0,120 9,196 4"/><path class="am-ink" pathLength="1" style="--am-d:.18s" d="M6 13 C 62 8,118 15,194 11"/>',
    keywords: ['double underline', 'strong emphasis'] },
  { id: 'wavy-underline', name: 'Wavy underline', category: 'emphasis', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'wav', stretch: true, sample: 'wavy',
    vb: '0 0 200 16', svg: '<path class="am-ink" pathLength="1" d="M4 9 q 14 -8 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0"/>',
    keywords: ['wavy', 'squiggle', 'squiggly', 'spelling'] },
  { id: 'circle', name: 'Circle it', category: 'emphasis', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'ov', stretch: true, sample: 'circle it',
    vb: '0 0 200 70', svg: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M152 14 C 60 2,10 20,18 44 C 26 68,140 70,182 52 C 214 40,204 15,150 11"/>',
    keywords: ['circle', 'oval', 'ring', 'encircle'] },
  { id: 'box', name: 'Box it', category: 'emphasis', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'box', stretch: true, sample: 'boxed',
    vb: '0 0 200 64', svg: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M9 9 L192 6 L195 55 L6 58 Z"/>',
    keywords: ['box', 'boxed', 'frame', 'enclose'] },
  { id: 'brackets', name: 'Brackets', category: 'emphasis', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'brk', stretch: true, sample: 'bracketed',
    vb: '0 0 200 64', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:3" d="M22 8 L8 8 L8 56 L22 56"/><path class="am-ink" pathLength="1" style="--am-d:.18s;stroke-width:3" d="M178 8 L192 8 L192 56 L178 56"/>',
    keywords: ['brackets', 'enclose', 'group'] },
  { id: 'strike', name: 'Strike through', category: 'emphasis', kind: 'wrap', color: 'negative', needsText: true, anim: 'draw', pos: 'str', stretch: true, sample: 'struck',
    vb: '0 0 200 14', svg: '<path class="am-ink" pathLength="1" d="M4 8 C 60 3,120 12,196 7"/>',
    keywords: ['strike', 'strikethrough', 'cross out', 'delete', 'remove'] },
  { id: 'scribble', name: 'Scribble out', category: 'emphasis', kind: 'wrap', color: 'negative', needsText: true, anim: 'draw', pos: 'scr', stretch: true, sample: 'scribbled',
    vb: '0 0 200 40', svg: '<path class="am-ink" pathLength="1" style="stroke-width:5" d="M6 24 L36 10 L66 26 L96 10 L126 26 L156 11 L192 22 M186 13 L150 29 L116 14 L84 28 L52 14 L12 27"/>',
    keywords: ['scribble', 'scratch out', 'delete', 'reject'] },

  // ---- HIGHLIGHTER (CSS sweep) --------------------------------------------
  { id: 'highlight', name: 'Highlighter', category: 'highlighter', kind: 'hl', color: 'accent', needsText: true, anim: 'hlsweep', sample: 'highlight',
    html: '<span class="am-item am-run am-hl"{{attrs}}>{{text}}</span>',
    keywords: ['highlight', 'highlighter', 'marker', 'mark', 'sweep', 'key'] },

  // ---- STANDALONE: ticks, arrows, stars, carets ---------------------------
  { id: 'tick', name: 'Tick / check', category: 'standalone', kind: 'glyph', color: 'positive', needsText: false, anim: 'draw',
    vb: '0 0 48 48', svg: '<path class="am-ink" pathLength="1" style="stroke-width:6" d="M9 26 C 13 31,17 35,20 38 C 28 26,36 17,43 9"/>',
    keywords: ['tick', 'check', 'correct', 'right', 'done', 'yes', 'ok'] },
  { id: 'cross', name: 'Cross', category: 'standalone', kind: 'glyph', color: 'negative', needsText: false, anim: 'draw',
    vb: '0 0 48 48', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:6" d="M12 12 C 20 20,28 28,37 37"/><path class="am-ink" pathLength="1" style="--am-d:.25s;stroke-width:6" d="M37 12 C 28 20,20 28,12 37"/>',
    keywords: ['cross', 'wrong', 'incorrect', 'no', 'x', 'error'] },
  { id: 'star', name: 'Star', category: 'standalone', kind: 'glyph', color: 'neutral', needsText: false, anim: 'draw',
    vb: '0 0 54 54', svg: '<path class="am-ink" pathLength="1" d="M27 5 L34 22 L52 22 L37 33 L43 50 L27 39 L11 50 L17 33 L2 22 L20 22 Z"/>',
    keywords: ['star', 'favourite', 'favorite', 'important', 'rating'] },
  { id: 'caret', name: 'Caret / insert', category: 'standalone', kind: 'glyph', color: 'comment', needsText: false, anim: 'draw',
    vb: '0 0 48 34', svg: '<path class="am-ink" pathLength="1" d="M6 28 L24 6 L42 28"/>',
    keywords: ['caret', 'insert', 'add here', 'up'] },
  { id: 'big-tick', name: 'Big tick', category: 'standalone', kind: 'glyph', color: 'positive', needsText: false, anim: 'draw',
    vb: '0 0 54 48', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s" d="M6 24 L18 36"/><path class="am-ink" pathLength="1" style="--am-d:.2s" d="M18 36 L30 20 M30 20 L48 8"/>',
    keywords: ['big tick', 'great', 'approved', 'excellent'] },

  // ---- SHAPES: arrows, outlines, dotted lines -----------------------------
  { id: 'arrow-sweep', name: 'Sweep arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 48', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s" d="M6 20 C 26 8,44 16,52 34"/><path class="am-ink" pathLength="1" style="--am-d:.3s" d="M52 34 L40 30 M52 34 L50 20"/>',
    keywords: ['arrow', 'sweep arrow', 'point'] },
  { id: 'arrow-right', name: 'Arrow right', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M8 26 L46 26 M46 26 L37 19 M46 26 L37 33"/>',
    keywords: ['arrow right', 'next', 'leads to', 'therefore'] },
  { id: 'arrow-left', name: 'Arrow left', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M52 26 L14 26 M14 26 L23 19 M14 26 L23 33"/>',
    keywords: ['arrow left', 'back', 'previous'] },
  { id: 'arrow-up', name: 'Arrow up', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<path class="am-ink" pathLength="1" d="M26 46 L26 10 M26 10 L18 19 M26 10 L34 19"/>',
    keywords: ['arrow up', 'increase', 'rise'] },
  { id: 'arrow-down', name: 'Arrow down', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<path class="am-ink" pathLength="1" d="M26 8 L26 44 M26 44 L18 35 M26 44 L34 35"/>',
    keywords: ['arrow down', 'decrease', 'fall'] },
  { id: 'arrow-curved', name: 'Curved arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M8 42 C 20 12,44 12,52 32 M52 32 L42 31 M52 32 L50 20"/>',
    keywords: ['curved arrow', 'curve', 'point to'] },
  { id: 'arrow-double', name: 'Double-headed arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M14 26 L46 26 M14 26 L22 19 M14 26 L22 33 M46 26 L38 19 M46 26 L38 33"/>',
    keywords: ['double arrow', 'both ways', 'relates to', 'two way'] },
  { id: 'arrow-return', name: 'Return arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M48 14 C 22 8,10 24,22 40 M22 40 L13 33 M22 40 L31 34"/>',
    keywords: ['return arrow', 'loop back', 'redo'] },
  { id: 'arrow-zigzag', name: 'Zigzag arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M8 14 L22 36 L36 14 L50 36 M50 36 L42 31 M50 36 L51 26"/>',
    keywords: ['zigzag arrow', 'volatile', 'back and forth'] },
  { id: 'arrow-hook', name: 'Hook arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" d="M8 16 L40 16 C 50 16,50 25,50 36 M50 36 L43 29 M50 36 L57 29"/>',
    keywords: ['hook arrow', 'branch', 'drop down'] },
  { id: 'arrow-bold', name: 'Bold sweep arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" style="stroke-width:6" d="M8 42 C 24 6,48 10,54 30 M54 30 L43 29 M54 30 L52 16"/>',
    keywords: ['bold arrow', 'strong', 'emphatic arrow'] },
  { id: 'arrow-thin', name: 'Long thin arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-ink" pathLength="1" style="stroke-width:2.3" d="M6 26 L56 26 M56 26 L49 20 M56 26 L49 32"/>',
    keywords: ['thin arrow', 'fine arrow', 'subtle'] },
  { id: 'arrow-dotted', name: 'Dotted arrow', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 60 52', svg: '<path class="am-dash" style="stroke-dasharray:2 7;stroke-width:4" d="M6 26 L42 26"/><path class="am-ink" pathLength="1" style="--am-d:.3s" d="M45 26 L36 19 M45 26 L36 33"/>',
    keywords: ['dotted arrow', 'implied', 'weak link'] },
  { id: 'circle-shape', name: 'Circle', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<circle class="am-ink" pathLength="1" style="stroke-width:3" cx="26" cy="26" r="20"/>',
    keywords: ['circle shape', 'ring', 'node'] },
  { id: 'dot', name: 'Dot', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'none',
    vb: '0 0 52 52', svg: '<circle cx="26" cy="26" r="12" fill="currentColor"/>',
    keywords: ['dot', 'bullet', 'point', 'marker'] },
  { id: 'target', name: 'Target', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<circle class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:3" cx="26" cy="26" r="20"/><circle class="am-ink" pathLength="1" style="--am-d:.25s;stroke-width:3" cx="26" cy="26" r="9"/>',
    keywords: ['target', 'bullseye', 'focus', 'goal'] },
  { id: 'square', name: 'Square', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M8 8 L46 6 L48 46 L6 48 Z"/>',
    keywords: ['square', 'box shape', 'node'] },
  { id: 'rounded', name: 'Rounded square', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<rect class="am-ink" pathLength="1" x="7" y="7" width="38" height="38" rx="9" style="stroke-width:3"/>',
    keywords: ['rounded square', 'card', 'tag'] },
  { id: 'check-box', name: 'Checked box', category: 'shapes', kind: 'glyph', color: 'positive', needsText: false, anim: 'draw',
    vb: '0 0 52 52', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:3" d="M9 9 L43 7 L45 43 L7 45 Z"/><path class="am-ink" pathLength="1" style="--am-d:.3s" d="M15 26 L23 34 L39 16"/>',
    keywords: ['checkbox', 'checked', 'ticked box', 'complete', 'done'] },
  { id: 'exclaim', name: 'Exclamation', category: 'shapes', kind: 'glyph', color: 'neutral', needsText: false, anim: 'draw',
    vb: '0 0 52 58', svg: '<path class="am-ink" pathLength="1" style="stroke-width:7" d="M27 10 C 26 19,26 28,25 37"/><circle class="am-dot" cx="25" cy="47" r="4.4"/>',
    keywords: ['exclamation', 'important', 'warning', 'note'] },
  { id: 'exclaim-circled', name: 'Exclamation circled', category: 'shapes', kind: 'glyph', color: 'neutral', needsText: false, anim: 'draw',
    vb: '0 0 56 62', svg: '<path class="am-ink" pathLength="1" style="stroke-width:7" d="M29 12 C 28 21,28 30,27 39"/><circle class="am-dot" cx="27" cy="47" r="4.4"/><path class="am-ink" pathLength="1" style="--am-d:.42s;stroke-width:3;color:var(--am-c-accent)" d="M40 12 C 14 6,6 26,12 42 C 18 58,46 58,45 34 C 44 18,34 10,24 11"/>',
    keywords: ['exclamation circled', 'alert', 'caution'] },
  { id: 'question', name: 'Question mark', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 52 58', svg: '<path class="am-ink" pathLength="1" style="stroke-width:6" d="M13 19 C 12 7,40 6,40 19 C 40 29,26 28,26 38"/><circle class="am-dot" cx="26" cy="48" r="4.2"/>',
    keywords: ['question', 'unclear', 'query', 'why'] },
  { id: 'question-circled', name: 'Question circled', category: 'shapes', kind: 'glyph', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 56 62', svg: '<path class="am-ink" pathLength="1" style="stroke-width:6" d="M15 20 C 14 8,42 7,42 20 C 42 30,28 29,28 39"/><circle class="am-dot" cx="28" cy="49" r="4.2"/><path class="am-ink" pathLength="1" style="--am-d:.45s;stroke-width:3;color:var(--am-c-comment)" d="M44 12 C 16 6,6 26,12 44 C 18 60,48 60,47 34 C 46 18,36 10,26 11"/>',
    keywords: ['question circled', 'queried', 'needs clarification'] },
  { id: 'line-dotted', name: 'Dotted line', category: 'shapes', kind: 'wide', color: 'accent', needsText: false, anim: 'wipe',
    vb: '0 0 384 24', svg: '<g class="am-wipe"><path class="am-dash" style="stroke-dasharray:2 9;stroke-width:4" d="M6 12 L378 12"/></g>',
    keywords: ['dotted line', 'divider', 'rule', 'separator'] },
  { id: 'line-dashed', name: 'Dashed line', category: 'shapes', kind: 'wide', color: 'accent', needsText: false, anim: 'wipe',
    vb: '0 0 384 24', svg: '<g class="am-wipe"><path class="am-dash" style="stroke-dasharray:14 9;stroke-width:4" d="M6 12 L378 12"/></g>',
    keywords: ['dashed line', 'divider', 'cut here'] },
  { id: 'line-dotted-arrow', name: 'Dotted line + arrow', category: 'shapes', kind: 'wide', color: 'accent', needsText: false, anim: 'wipe',
    vb: '0 0 384 28', svg: '<g class="am-wipe"><path class="am-dash" style="stroke-dasharray:2 9;stroke-width:4" d="M6 14 L348 14"/></g><path class="am-ink" pathLength="1" style="--am-d:.55s;stroke-width:4" d="M356 14 L346 7 M356 14 L346 21"/>',
    keywords: ['dotted line arrow', 'leads to', 'connector'] },

  // ---- OVALS & RECTANGLES: repeat & layer ---------------------------------
  { id: 'oval-phrase', name: 'Oval around a phrase', category: 'ovals', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'bigoval', stretch: true, sample: 'circle the whole idea',
    vb: '0 0 360 70', svg: '<path class="am-ink" pathLength="1" style="stroke-width:2.5" d="M300 12 C 120 0,16 16,20 38 C 24 62,240 70,338 54 C 372 48,360 14,280 9"/>',
    keywords: ['oval phrase', 'circle phrase', 'ring idea', 'whole idea'] },
  { id: 'oval-long', name: 'Long oval', category: 'ovals', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'bigoval', stretch: true, sample: 'around a whole long phrase',
    vb: '0 0 460 72', svg: '<path class="am-ink" pathLength="1" style="stroke-width:2.2" d="M400 12 C 150 -2,20 16,24 40 C 28 64,320 72,436 54 C 474 48,460 12,360 9"/>',
    keywords: ['long oval', 'circle long phrase', 'whole sentence'] },
  { id: 'oval-double-ring', name: 'Double-ringed oval', category: 'ovals', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'bigoval', stretch: true, sample: 'double-ringed idea',
    vb: '0 0 360 78', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:2.3" d="M300 14 C 120 2,16 18,20 40 C 24 64,240 72,338 56"/><path class="am-ink" pathLength="1" style="--am-d:.25s;stroke-width:2.3" d="M338 56 C 372 48,360 14,280 11 C 120 4,14 20,22 44"/>',
    keywords: ['double oval', 'double ring', 'emphatic circle'] },
  { id: 'oval-left', name: 'Oval (lean left)', category: 'ovals', kind: 'wrap', color: 'comment', needsText: true, anim: 'draw', pos: 'ov', stretch: true, sample: 'that way',
    vb: '0 0 200 70', svg: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M48 12 C 140 2,196 18,186 44 C 176 70,60 70,18 52 C -12 40,6 14,50 11"/>',
    keywords: ['oval left', 'circle other way', 'alt circle'] },
  { id: 'oval-triple', name: 'Triple oval', category: 'ovals', kind: 'wrap', color: 'accent', needsText: true, anim: 'draw', pos: 'ov', stretch: true, sample: 'emphatic',
    vb: '0 0 200 74', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:2.5" d="M150 15 C 62 3,12 20,20 44 C 28 68,138 69,180 52"/><path class="am-ink" pathLength="1" style="--am-d:.2s;stroke-width:2.5" d="M180 52 C 214 40,202 14,148 11 C 70 8,8 22,20 46"/><path class="am-ink" pathLength="1" style="--am-d:.4s;stroke-width:2.5" d="M20 46 C 30 66,140 72,184 54"/>',
    keywords: ['triple oval', 'scribbled circle', 'very emphatic'] },
  { id: 'rectangle', name: 'Rectangle', category: 'ovals', kind: 'wide', color: 'accent', needsText: false, anim: 'draw', maxw: 150,
    vb: '0 0 150 76', svg: '<path class="am-ink" pathLength="1" style="stroke-width:3" d="M8 11 L142 6 L145 68 L6 72 Z"/>',
    keywords: ['rectangle', 'hand drawn box', 'frame'] },
  { id: 'rectangle-stacked', name: 'Stacked rectangles', category: 'ovals', kind: 'wide', color: 'accent', needsText: false, anim: 'draw', maxw: 150,
    vb: '0 0 150 104', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:3" d="M8 8 L142 11 L140 44 L7 41 Z"/><path class="am-ink" pathLength="1" style="--am-d:.22s;stroke-width:3" d="M8 58 L142 61 L140 96 L7 92 Z"/>',
    keywords: ['stacked boxes', 'two boxes', 'list frame'] },
  { id: 'boxes-row', name: 'Boxes → bar', category: 'ovals', kind: 'wide', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 364 72', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:3" d="M6 10 L92 8 L94 64 L5 66 Z"/><path class="am-ink" pathLength="1" style="--am-d:.18s;stroke-width:3" d="M94 8 L182 10 L180 66 L92 64 Z"/><path class="am-ink" pathLength="1" style="--am-d:.36s;stroke-width:3" d="M182 10 L270 8 L272 64 L180 66 Z"/><path class="am-ink" pathLength="1" style="--am-d:.54s;stroke-width:3" d="M270 8 L358 10 L356 64 L268 66 Z"/>',
    keywords: ['boxes row', 'segments', 'timeline', 'steps'] },
  { id: 'bar-stretch', name: 'Stretch bar', category: 'ovals', kind: 'wide', color: 'accent', needsText: false, anim: 'stretch',
    vb: '0 0 360 60', svg: '<g class="am-stretchwrap"><path class="am-ink" pathLength="1" style="stroke-width:3" d="M6 10 L352 8 L354 50 L5 52 Z"/></g>',
    keywords: ['stretch bar', 'grow bar', 'progress', 'reveal'] },
  { id: 'circles-row', name: 'Circles in a row', category: 'ovals', kind: 'wide', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 364 80', svg: '<circle class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:3" cx="42" cy="40" r="30"/><circle class="am-ink" pathLength="1" style="--am-d:.14s;stroke-width:3" cx="112" cy="40" r="30"/><circle class="am-ink" pathLength="1" style="--am-d:.28s;stroke-width:3" cx="182" cy="40" r="30"/><circle class="am-ink" pathLength="1" style="--am-d:.42s;stroke-width:3" cx="252" cy="40" r="30"/><circle class="am-ink" pathLength="1" style="--am-d:.56s;stroke-width:3" cx="322" cy="40" r="30"/>',
    keywords: ['circles row', 'steps', 'dots row', 'sequence'] },
  { id: 'rules', name: 'Horizontal rules', category: 'ovals', kind: 'wide', color: 'accent', needsText: false, anim: 'draw',
    vb: '0 0 384 128', svg: '<path class="am-ink" pathLength="1" style="--am-d:0s;stroke-width:4" d="M8 20 L376 20"/><path class="am-ink" pathLength="1" style="--am-d:.15s;stroke-width:3" d="M8 50 C 120 47,260 53,376 49"/><path class="am-ink" pathLength="1" style="--am-d:.3s;stroke-width:3.5" d="M8 84 q 24 -8 48 0 t 48 0 t 48 0 t 48 0 t 48 0 t 48 0 t 48 0"/><path class="am-ink" pathLength="1" style="--am-d:.45s;stroke-width:3.5" d="M8 116 q 16 -10 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0"/>',
    keywords: ['rules', 'horizontal rule', 'dividers', 'underlines row'] },

  // ---- HANDWRITTEN NOTES ---------------------------------------------------
  { id: 'hand', name: 'Handwriting', category: 'notes', kind: 'note', color: 'accent', needsText: true, anim: 'none', sample: 'a handwritten note',
    html: '<span class="am-item am-hand"{{attrs}}>{{text}}</span>',
    keywords: ['handwriting', 'hand', 'note', 'scrawl'] },
  { id: 'hnote', name: 'Soft note', category: 'notes', kind: 'note', color: 'ink', needsText: true, anim: 'none', sample: 'a quieter aside',
    html: '<span class="am-item am-hnote"{{attrs}}>{{text}}</span>',
    keywords: ['soft note', 'aside', 'kalam', 'margin aside'] },
  { id: 'margin-note', name: 'Margin note', category: 'notes', kind: 'note', color: 'pen', needsText: true, anim: 'none', sample: 'remember this!',
    html: '<span class="am-item am-marginnote"{{attrs}}>{{text}}</span>',
    keywords: ['margin note', 'remember', 'reminder', 'aside'] },
  { id: 'teacher-mark', name: 'Teacher mark', category: 'notes', kind: 'note', color: 'pen', needsText: true, anim: 'draw', sample: 'Nice — clear structure!',
    html: '<span class="am-item am-teacher"{{attrs}}><svg class="am-teacher-tick am-run" viewBox="0 0 48 48"><path class="am-ink" pathLength="1" d="M9 26 L21 38 L40 11"/></svg>{{text}}</span>',
    keywords: ['teacher mark', 'marked', 'feedback', 'grade'] },
  { id: 'correction', name: 'Correction', category: 'notes', kind: 'note', color: 'negative', needsText: true, anim: 'draw', themed: false, sample: 'backdrop', over: 'horizon',
    html: '<span class="am-item am-corr"{{attrs}}><span class="am-mk pos-str am-run">{{text}}<svg viewBox="0 0 200 14" preserveAspectRatio="none"><path class="am-ink" pathLength="1" d="M4 8 C 60 3,120 12,196 7"/></svg></span><span class="am-over">{{over}}</span></span>',
    keywords: ['correction', 'replace', 'edit', 'fix word'] },
  { id: 'sticky', name: 'Sticky note', category: 'notes', kind: 'note', color: 'ink', needsText: true, anim: 'none', themed: false, sample: 'Try sketching your own in 3 bands.',
    html: '<span class="am-item am-sticky"{{attrs}}>{{text}}</span>',
    keywords: ['sticky', 'post-it', 'note card', 'reminder card'] },
  { id: 'checklist-item', name: 'Checklist item', category: 'notes', kind: 'note', color: 'positive', needsText: true, anim: 'draw', sample: 'Name the three planes',
    html: '<span class="am-item am-checkitem"{{attrs}}><svg class="am-check-tick am-run" viewBox="0 0 48 48"><path class="am-ink" pathLength="1" d="M9 26 L21 38 L40 11"/></svg>{{text}}</span>',
    keywords: ['checklist', 'checklist item', 'todo', 'task'] },
];

const INDEX = new Map(CATALOG.map(entry => [entry.id, entry]));
export const findAnimation = id => INDEX.get(id) ?? null;
export const animationIds = () => CATALOG.map(entry => entry.id);

// Pick the best catalog entry for a free-text keyword (exact id, then exact
// keyword, then substring). Returns the entry or null. Used by the agent API.
export function matchKeyword(query) {
  if (typeof query !== 'string') return null;
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  if (INDEX.has(needle)) return INDEX.get(needle);
  for (const entry of CATALOG) if (entry.keywords.includes(needle)) return entry;
  for (const entry of CATALOG) if (entry.keywords.some(word => word.includes(needle) || needle.includes(word))) return entry;
  for (const entry of CATALOG) if (entry.name.toLowerCase().includes(needle)) return entry;
  return null;
}

// Serialisable manifest (no markup) for agents / animations.json.
export function manifest() {
  return {
    generated: 'Derived from animation-catalog.js',
    colorRoles: COLOR_ROLES.map(([id, label]) => ({ id, label })),
    animations: CATALOG.map(({ id, name, category, kind, color, needsText, anim, keywords }) => ({
      id, name, category, kind, defaultColor: color, needsText, animation: anim, keywords,
    })),
  };
}

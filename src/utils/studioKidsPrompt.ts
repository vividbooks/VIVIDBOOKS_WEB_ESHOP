/**
 * Šablona „děti ve studiu“ pro AI Image agent (ImageGallery).
 * Texty v angličtině — stejně jako zbytek pipeline pro Gemini.
 */

export type StudioKidsCompositionId =
  | 'girl_boy'
  | 'two_boys'
  | 'two_girls'
  | 'girl_two_boys'
  | 'boy_two_girls'
  | 'three_mixed';

export type StudioKidsPoseId = 'floor_crosslegged' | 'desk_sitting' | 'standing';

export type StudioKidsFramingId = 'full_body' | 'waist_up';

export type StudioKidsPrintsId = 'in_hands' | 'scattered_around' | 'on_surface_front';

export type StudioKidsAgePreset = '4_6' | '7_9' | '10_12' | '13_15' | 'custom';

/** Volby scény „děti ve studiu“ (bez přepínače zapnuto — aktivuje je výběr stylu s aiTemplate studio_kids). */
export interface StudioKidsOptions {
  composition: StudioKidsCompositionId;
  pose: StudioKidsPoseId;
  framing: StudioKidsFramingId;
  prints: StudioKidsPrintsId;
  agePreset: StudioKidsAgePreset;
  ageMin: number;
  ageMax: number;
}

/** Uložené volby per referenční styl (id stylu z KV) */
export const STUDIO_KIDS_BY_STYLE_STORAGE_KEY = 'vb:ai-studio-kids-by-style-v1';

export const DEFAULT_STUDIO_KIDS_OPTIONS: StudioKidsOptions = {
  composition: 'girl_boy',
  pose: 'floor_crosslegged',
  framing: 'full_body',
  prints: 'in_hands',
  agePreset: '7_9',
  ageMin: 7,
  ageMax: 9,
};

const COMPOSITION_EN: Record<StudioKidsCompositionId, string> = {
  girl_boy: 'Exactly two children: one girl and one boy.',
  two_boys: 'Exactly two boys.',
  two_girls: 'Exactly two girls.',
  girl_two_boys: 'Exactly three children: one girl and two boys.',
  boy_two_girls: 'Exactly three children: one boy and two girls.',
  three_mixed: 'Exactly three children with a natural mixed-gender group (not all the same).',
};

const POSE_EN: Record<StudioKidsPoseId, string> = {
  floor_crosslegged:
    'Pose: children sit on the seamless studio floor, cross-legged, relaxed and cheerful, facing the camera.',
  desk_sitting:
    'Pose: children sit at a simple studio table facing the camera. The tabletop must be the SAME solid matte color as the seamless studio backdrop and floor (one unified hue, like painted MDF — no wood grain, no contrasting desk).',
  standing:
    'Pose: children stand in the studio in relaxed natural poses, facing the camera.',
};

const FRAMING_EN: Record<StudioKidsFramingId, string> = {
  full_body:
    'Framing: show full-length figures (head to feet visible). Keep workbook covers large enough to read.',
  waist_up:
    'Framing: waist-up only (half-body). Heads, expressions, and hands must be clearly visible; workbook covers must stay readable.',
};

function thinWorkbookReminder(): string {
  return (
    'Each item stays a slim stitched sešit: visible page edges are whisper-thin, never a tall white “novel” block. '
  );
}

function printsInstruction(pose: StudioKidsPoseId, prints: StudioKidsPrintsId): string {
  if (prints === 'in_hands') {
    return (
      'Printed materials: children hold the Vividbooks workbooks so the printed COVER faces the camera; ' +
      thinWorkbookReminder() +
      'Covers accurate.'
    );
  }
  if (prints === 'scattered_around') {
    return (
      'Printed materials: some workbooks in children’s hands, additional copies on the floor/surface around them; ' +
      thinWorkbookReminder() +
      'All visible covers accurate and legible.'
    );
  }
  // on_surface_front
  if (pose === 'desk_sitting') {
    return (
      'Printed materials: workbooks on the table in front of the children (flat, slightly fanned, or lightly propped) — ' +
      'CRITICAL: do not show a thick cross-section of pages from above or from the front foot of the book; ' +
      'tilt covers toward the lens or lower the camera so the dominant read is cover art, not a deep white page brick. ' +
      thinWorkbookReminder() +
      'Tabletop color discipline as above; covers accurate.'
    );
  }
  return (
    'Printed materials: workbooks on the floor or low surface in front of the children (and optionally in hands); ' +
    thinWorkbookReminder() +
    'Covers accurate and readable.'
  );
}

function ageEnglish(s: StudioKidsOptions): string {
  let min = s.ageMin;
  let max = s.ageMax;
  if (s.agePreset !== 'custom') {
    const map: Record<Exclude<StudioKidsAgePreset, 'custom'>, [number, number]> = {
      '4_6': [4, 6],
      '7_9': [7, 9],
      '10_12': [10, 12],
      '13_15': [13, 15],
    };
    [min, max] = map[s.agePreset];
  }
  min = Math.max(3, Math.min(17, Math.round(min)));
  max = Math.max(min, Math.min(17, Math.round(max)));
  return `Ages: portray children around ${min}–${max} years old (stay within this band).`;
}

/** Blok vložený do promptu po „Scene color“ — odkazuje na barvu scény výše. */
export function buildStudioKidsPromptSection(s: StudioKidsOptions): string {
  const lines = [
    '=== STUDIO CHILDREN SCENE (mandatory) ===',
    'Style: high-end commercial studio photograph for an education brand — bright, even soft lighting, clean cyclorama / seamless backdrop.',
    'Product shape: slim soft school sešity (stitched), NOT hardcovers — forbid tall white layered page “slabs” along the bottom or sides of closed books; max ~3–10 mm apparent thickness at any visible edge unless the book is deliberately opened flat.',
    'Casting: children must look European (Central/Western European appearance, natural variety of hair/skin tones — avoid stereotyped or non-European ethnic coding).',
    COMPOSITION_EN[s.composition],
    ageEnglish(s),
    POSE_EN[s.pose],
    FRAMING_EN[s.framing],
    printsInstruction(s.pose, s.prints),
    'Background / floor / table color: strictly follow the “Scene color” instructions already given above — wall, floor, and (if present) table share that ONE unified color.',
    'Mood: warm, genuine smiles, school-age friendly, professional catalog quality.',
  ];

  return lines.join('\n');
}

/**
 * Výchozí text pro pole „Prompt / instrukce pro AI“ u stylu „Děti ve studiu“ (Nastavení).
 * Anglicky — stejně jako technická část pipeline.
 */
export const STUDIO_KIDS_REFERENCE_STYLE_PROMPT =
  `Professional studio photograph: European children in a seamless monochrome cyclorama with Czech Vividbooks educational workbooks. ` +
  `Bright, even soft lighting; cheerful authentic expressions; commercial education-brand quality. ` +
  `Covers must match the supplied reference product images exactly (layout, colors, title art). ` +
  `\n\n` +
  `CRITICAL — these are soft school SEŠITY (exercise books), NOT hardcover novels: no rigid boards, no tall white “brick” of pages along the bottom or fore-edge. ` +
  `Closed book thickness should read like ~3–10 mm total (stitched sešit), never a deep hardback text block. SEWN binding (šitá vazba); when open, fully lay-flat. ` +
  `Favor camera angles where printed covers face the viewer; if books are on a table, tilt them so cover art dominates — avoid shots that emphasize a thick cross-section of paper.`;

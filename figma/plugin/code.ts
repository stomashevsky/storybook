// Base UI - Variable Collections Documentation Generator
// Generates clean, compact tables from selected Variable Collections

// ============================================================================
// Types
// ============================================================================

interface CollectionData {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  variableCount: number;
  modeCount: number;
}

interface ResolvedValue {
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  value: RGB | RGBA | number | string | boolean;
  isAlias: boolean;
  aliasName?: string;
  aliasId?: string;
}

// Helper to handle optional alpha in color objects
interface ColorWithAlpha extends RGB {
  a?: number;
}

interface VariableRowData {
  name: string;
  group: string;
  description: string;
  scopes: string[];
  valuesByMode: Map<string, ResolvedValue>;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 },
  gray50: { r: 0.937, g: 0.937, b: 0.937 },
  gray100: { r: 0.96, g: 0.96, b: 0.96 },
  gray200: { r: 0.9, g: 0.9, b: 0.9 },
  gray300: { r: 0.8, g: 0.8, b: 0.8 },
  gray400: { r: 0.6, g: 0.6, b: 0.6 },
  gray500: { r: 0.4, g: 0.4, b: 0.4 },
  gray900: { r: 0.1, g: 0.1, b: 0.1 },
  checkerLight: { r: 1, g: 1, b: 1 },
  checkerDark: { r: 0.9, g: 0.9, b: 0.9 },
  // Alpha colors (RGBA)
  grayAlpha08: { r: 0, g: 0, b: 0, a: 0.08 },
};

const LAYOUT = {
  columnWidths: {
    group: 100,
    token: 220,  // Increased from 120 to prevent truncation
    mode: 400,   // Increased to fit very long reference paths
    description: 400,
    scope: 120,
    cssToken: 200,
  },
  rowHeight: 72,
  headerHeight: 40,
  cellPadding: 12,
  swatchSize: 48,
  pillHeight: 32,
  borderRadius: 8,
  tableGap: 80,
  // Section styling
  sectionPadding: 128,
  sectionRadius: 20,
  // Title styling (72px heading)
  titlePaddingBottom: 8,
  titleFontSize: 72,
  titleLetterSpacing: -1.44,
  // Subtitle styling (32px heading with gray bg)
  subtitlePaddingTop: 96,
  subtitlePaddingHorizontal: 12,
  subtitlePaddingVertical: 16,
  subtitleFontSize: 32,
  subtitleLetterSpacing: -0.64,
  subtitleLineHeight: 38,
};

const FONT = {
  family: { family: 'Inter', style: 'Regular' },
  familyMedium: { family: 'Inter', style: 'Medium' },
  familySemiBold: { family: 'Inter', style: 'Semi Bold' },
  familyBold: { family: 'Inter', style: 'Bold' },
  familyMono: { family: 'Roboto Mono', style: 'Regular' },
  size: {
    small: 12,
    regular: 14,
    medium: 14,
    header: 14,
    secondary: 12,
    code: 13,
    title: 72,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function rgbToHex(color: RGB | RGBA): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

function hasAlpha(color: RGB | RGBA): boolean {
  if (!color || typeof color !== 'object') return false;
  return 'a' in color && color.a !== undefined && color.a < 1;
}

function getAlphaPercent(color: RGBA): number {
  const alpha = color.a !== undefined ? color.a : 1;
  return Math.round(alpha * 100);
}

function formatScope(scopes: VariableScope[]): string {
  if (!scopes || scopes.length === 0) return 'All';

  const scopeMap: Record<string, string> = {
    'ALL_SCOPES': 'All',
    'ALL_FILLS': 'Fill',
    'FRAME_FILL': 'Frame Fill',
    'SHAPE_FILL': 'Shape Fill',
    'TEXT_FILL': 'Text Fill',
    'STROKE_COLOR': 'Stroke',
    'CORNER_RADIUS': 'Radius',
    'WIDTH_HEIGHT': 'Size',
    'GAP': 'Gap',
    'STROKE_FLOAT': 'Stroke Width',
    'OPACITY': 'Opacity',
    'EFFECT_COLOR': 'Effect',
    'FONT_FAMILY': 'Font Family',
    'FONT_STYLE': 'Font Style',
    'FONT_WEIGHT': 'Font Weight',
    'FONT_SIZE': 'Font Size',
    'LINE_HEIGHT': 'Line Height',
    'LETTER_SPACING': 'Letter Spacing',
    'PARAGRAPH_SPACING': 'Para Spacing',
    'PARAGRAPH_INDENT': 'Para Indent',
  };

  return scopes.map(s => scopeMap[s] || s).join(', ');
}

function formatNumberValue(value: number, scopes: VariableScope[]): string {
  // Round to 2 decimal places
  const rounded = Math.round(value * 100) / 100;

  // Determine unit based on scope
  const needsPx = scopes.some(s =>
    ['CORNER_RADIUS', 'WIDTH_HEIGHT', 'GAP', 'STROKE_FLOAT', 'FONT_SIZE', 'LINE_HEIGHT', 'LETTER_SPACING', 'PARAGRAPH_SPACING', 'PARAGRAPH_INDENT'].includes(s)
  );

  if (needsPx) {
    return `${rounded}px`;
  }

  if (scopes.includes('OPACITY' as VariableScope)) {
    return `${Math.round(value * 100)}%`;
  }

  return String(rounded);
}

function getVariableGroup(name: string): string {
  const parts = name.split('/');
  if (parts.length > 1) {
    return parts.slice(0, -1).join('/');
  }
  return '';
}

function getFirstLevelGroup(name: string): string {
  const parts = name.split('/');
  return parts[0] || '';
}

function getSubGroup(name: string): string {
  const parts = name.split('/');
  if (parts.length > 2) {
    return parts.slice(1, -1).join('/');
  }
  return '';
}

function getVariableBaseName(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1];
}

// Convert text to Sentence case (first letter uppercase, rest lowercase)
function toSentenceCase(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

interface ParsedDescription {
  description: string;
  tokenRef: string | null;
}

function parseDescription(description: string): ParsedDescription {
  if (!description) {
    return { description: '', tokenRef: null };
  }

  // Check if description starts with a token reference like "--color-surface\n..."
  const lines = description.split('\n');
  if (lines.length >= 1 && lines[0].startsWith('--')) {
    const tokenRef = lines[0].replace(/^--/, ''); // Remove leading --
    const descriptionText = lines.slice(1).join('\n').trim();
    return { description: descriptionText, tokenRef };
  }

  return { description: description, tokenRef: null };
}

// ============================================================================
// Font Loading
// ============================================================================

async function loadFonts(): Promise<void> {
  console.log('[loadFonts] Starting to load fonts...');
  try {
    console.log('[loadFonts] Loading Inter fonts...');
    await figma.loadFontAsync(FONT.family);
    await figma.loadFontAsync(FONT.familyMedium);
    await figma.loadFontAsync(FONT.familySemiBold);
    await figma.loadFontAsync(FONT.familyBold);
    await figma.loadFontAsync(FONT.familyMono);
    console.log('[loadFonts] Inter fonts loaded successfully');
  } catch (error) {
    console.log('[loadFonts] Inter fonts failed, falling back to Roboto:', error);
    // Fallback to Roboto if Inter is not available
    FONT.family = { family: 'Roboto', style: 'Regular' };
    FONT.familyMedium = { family: 'Roboto', style: 'Medium' };
    FONT.familySemiBold = { family: 'Roboto', style: 'Bold' };
    FONT.familyBold = { family: 'Roboto', style: 'Bold' };
    FONT.familyMono = { family: 'Roboto Mono', style: 'Regular' };
    await figma.loadFontAsync(FONT.family);
    await figma.loadFontAsync(FONT.familyMedium);
    await figma.loadFontAsync(FONT.familySemiBold);
    await figma.loadFontAsync(FONT.familyBold);
    await figma.loadFontAsync(FONT.familyMono);
    console.log('[loadFonts] Roboto fonts loaded successfully');
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getCollectionsData(): Promise<CollectionData[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  return collections.map(collection => ({
    id: collection.id,
    name: collection.name,
    modes: collection.modes.map(m => ({ modeId: m.modeId, name: m.name })),
    variableCount: collection.variableIds.length,
    modeCount: collection.modes.length,
  }));
}

async function getVariablesForCollection(collectionId: string): Promise<Variable[]> {
  const allVariables = await figma.variables.getLocalVariablesAsync();
  return allVariables.filter(v => v.variableCollectionId === collectionId);
}

async function resolveValue(variable: Variable, modeId: string, modeName: string): Promise<ResolvedValue> {
  // Cache for collections to avoid redundant async calls
  const collectionCache = new Map<string, VariableCollection>();

  // Helper to find mode ID by name in a collection
  const findModeIdByName = async (collectionId: string, targetModeName: string): Promise<string | null> => {
    let collection = collectionCache.get(collectionId);
    if (!collection) {
      const fetchedCollection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
      if (fetchedCollection) {
        collection = fetchedCollection;
        collectionCache.set(collectionId, collection);
      }
    }
    if (!collection) {
      console.log('  [DEBUG] Collection not found:', collectionId);
      return null;
    }

    const normalizedTargetName = targetModeName.trim().toLowerCase();

    // 1. Exact name match
    const exactMatch = collection.modes.find(m => m.name.trim().toLowerCase() === normalizedTargetName);
    if (exactMatch) return exactMatch.modeId;

    // 2. Fuzzy match (contains)
    const fuzzyMatch = collection.modes.find(m => m.name.trim().toLowerCase().includes(normalizedTargetName));
    if (fuzzyMatch) return fuzzyMatch.modeId;

    // 3. Single-mode collection - use that mode
    if (collection.modes.length === 1) return collection.modes[0].modeId;

    // 4. Fallback to first mode
    return collection.modes[0]?.modeId || null;
  };

  // Start with the initial value for the given mode
  let currentValue = variable.valuesByMode[modeId];

  // Track the first alias for display purposes
  let firstAliasName: string | undefined;
  let firstAliasId: string | undefined;
  let currentModeName = modeName;
  let depth = 0;
  const maxDepth = 10;

  // Resolve alias chain
  while (depth < maxDepth && currentValue && typeof currentValue === 'object' && 'type' in currentValue && currentValue.type === 'VARIABLE_ALIAS') {
    const aliasedVar = await figma.variables.getVariableByIdAsync(currentValue.id);
    if (!aliasedVar) {
      console.log('  [DEBUG] Aliased variable not found:', currentValue.id);
      break;
    }

    // Store first alias info for display
    if (depth === 0) {
      firstAliasName = aliasedVar.name;
      firstAliasId = aliasedVar.id;
    }

    // Find the correct mode ID in the aliased variable's collection
    const targetModeId = await findModeIdByName(aliasedVar.variableCollectionId, currentModeName);
    if (!targetModeId) {
      console.log('  [DEBUG] Mode not found for:', aliasedVar.name, 'in collection:', aliasedVar.variableCollectionId);
      break;
    }

    // Get the value from the aliased variable for that mode
    currentValue = aliasedVar.valuesByMode[targetModeId];

    // If no value for that mode, try first available mode
    if (currentValue === undefined) {
      const modeIds = Object.keys(aliasedVar.valuesByMode);
      if (modeIds.length > 0) {
        currentValue = aliasedVar.valuesByMode[modeIds[0]];
      }
    }

    depth++;
  }

  // Check if we resolved to a primitive value
  const isResolved = currentValue !== null &&
    currentValue !== undefined &&
    !(typeof currentValue === 'object' && 'type' in currentValue && currentValue.type === 'VARIABLE_ALIAS');

  if (isResolved) {
    return {
      type: variable.resolvedType,
      value: currentValue as RGB | RGBA | number | string | boolean,
      isAlias: firstAliasName !== undefined,
      aliasName: firstAliasName,
      aliasId: firstAliasId,
    };
  }

  // Resolution failed - return fallback
  console.log('[WARN] Resolution failed for:', variable.name, 'mode:', modeName, 'depth reached:', depth);
  return {
    type: variable.resolvedType,
    value: variable.resolvedType === 'COLOR'
      ? { r: 1, g: 0, b: 1 } // Return MAGENTA for failed resolution (visible debug color)
      : variable.resolvedType === 'FLOAT'
        ? 0
        : '',
    isAlias: firstAliasName !== undefined,
    aliasName: firstAliasName,
    aliasId: firstAliasId,
  };
}

// ============================================================================
// Component Builders
// ============================================================================

// Apply root frame styles from Figma variables
async function applyRootFrameStyles(root: FrameNode) {
  // Find style variables from the library
  const getVarByName = async (name: string) => {
    const vars = await figma.variables.getLocalVariablesAsync();
    return vars.find(v => v.name === name);
  };

  const radiusVar = await getVarByName('figma/section/radius');
  const strokeWeightVar = await getVarByName('figma/section/stroke');
  const bgVar = await getVarByName('figma/section/notes/background');
  const strokeColorVar = await getVarByName('figma/section/notes/stroke');

  root.layoutMode = 'VERTICAL';
  root.primaryAxisSizingMode = 'AUTO';
  root.counterAxisSizingMode = 'AUTO';

  // Set corner radius with variable binding
  if (radiusVar) {
    root.setBoundVariable('topLeftRadius', radiusVar);
    root.setBoundVariable('topRightRadius', radiusVar);
    root.setBoundVariable('bottomLeftRadius', radiusVar);
    root.setBoundVariable('bottomRightRadius', radiusVar);
  } else {
    root.cornerRadius = 20;
  }

  // Set background with variable binding
  if (bgVar) {
    root.fills = [{
      type: 'SOLID',
      color: COLORS.white,
      boundVariables: { color: { type: 'VARIABLE_ALIAS', id: bgVar.id } }
    }];
  } else {
    root.fills = [{ type: 'SOLID', color: COLORS.white }];
  }

  // Set stroke with variable binding
  if (strokeColorVar) {
    root.strokes = [{
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0 },
      opacity: 0.4,
      boundVariables: { color: { type: 'VARIABLE_ALIAS', id: strokeColorVar.id } }
    }];
  } else {
    root.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }];
  }

  // Set stroke weight with variable binding
  if (strokeWeightVar) {
    root.setBoundVariable('strokeWeight', strokeWeightVar);
  } else {
    root.strokeWeight = 1;
  }

  root.paddingLeft = 0;
  root.paddingRight = 0;
  root.paddingTop = 0;
  root.paddingBottom = 0;
}

// Find .title component and create an instance with given text
async function createTitleInstance(title: string): Promise<InstanceNode | FrameNode> {
  // Load all pages to access components across the document
  await figma.loadAllPagesAsync();

  // Try to find .title component by ID first, then by name
  let titleComponent = (await figma.getNodeByIdAsync('6151:90928')) as ComponentNode | null;
  if (!titleComponent) {
    titleComponent = figma.root.findOne(node =>
      node.type === 'COMPONENT' && node.name === '.title'
    ) as ComponentNode | null;
  }

  if (titleComponent) {
    const instance = titleComponent.createInstance();
    // Find text node inside and update it
    const textNode = instance.findOne(node => node.type === 'TEXT') as TextNode | null;
    if (textNode) {
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = title;
    }
    return instance;
  }

  // Fallback: create frame if component not found
  const frame = figma.createFrame();
  frame.name = '.title';
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'CENTER';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.paddingBottom = LAYOUT.titlePaddingBottom;
  frame.fills = [];

  const textNode = figma.createText();
  textNode.characters = title;
  textNode.fontSize = LAYOUT.titleFontSize;
  textNode.fontName = FONT.familyBold;
  textNode.fills = [{ type: 'SOLID', color: COLORS.black }];
  textNode.letterSpacing = { value: LAYOUT.titleLetterSpacing, unit: 'PIXELS' };
  textNode.lineHeight = { value: LAYOUT.titleFontSize, unit: 'PIXELS' };

  frame.appendChild(textNode);
  return frame;
}

// Find .subtitle component and create an instance with given text
async function createSubtitleInstance(subtitle: string): Promise<InstanceNode | FrameNode> {
  // Load all pages to access components across the document
  await figma.loadAllPagesAsync();

  // Try to find .subtitle component by ID first, then by name
  let subtitleComponent = (await figma.getNodeByIdAsync('6194:43052')) as ComponentNode | null;
  if (!subtitleComponent) {
    subtitleComponent = figma.root.findOne(node =>
      node.type === 'COMPONENT' && node.name === '.subtitle'
    ) as ComponentNode | null;
  }

  if (subtitleComponent) {
    const instance = subtitleComponent.createInstance();
    // Find text node inside and update it
    const textNode = instance.findOne(node => node.type === 'TEXT') as TextNode | null;
    if (textNode) {
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = subtitle;
    }
    // Note: FILL width will be set by caller after appending to autolayout parent
    return instance;
  }

  // Fallback: create frame if component not found
  const outerFrame = figma.createFrame();
  outerFrame.name = '.subtitle';
  outerFrame.layoutMode = 'HORIZONTAL';
  outerFrame.primaryAxisAlignItems = 'MIN';
  outerFrame.counterAxisAlignItems = 'CENTER';
  outerFrame.primaryAxisSizingMode = 'AUTO';
  outerFrame.counterAxisSizingMode = 'AUTO';
  outerFrame.paddingTop = LAYOUT.subtitlePaddingTop;
  outerFrame.fills = [];

  const innerFrame = figma.createFrame();
  innerFrame.name = 'group';
  innerFrame.layoutMode = 'HORIZONTAL';
  innerFrame.primaryAxisAlignItems = 'MIN';
  innerFrame.counterAxisAlignItems = 'CENTER';
  outerFrame.appendChild(innerFrame);
  innerFrame.layoutSizingHorizontal = 'FILL';
  innerFrame.counterAxisSizingMode = 'AUTO';
  innerFrame.paddingLeft = LAYOUT.subtitlePaddingHorizontal;
  innerFrame.paddingRight = LAYOUT.subtitlePaddingHorizontal;
  innerFrame.paddingTop = LAYOUT.subtitlePaddingVertical;
  innerFrame.paddingBottom = LAYOUT.subtitlePaddingVertical;
  innerFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];

  const textNode = figma.createText();
  textNode.characters = subtitle;
  textNode.fontSize = LAYOUT.subtitleFontSize;
  textNode.fontName = FONT.familySemiBold;
  textNode.fills = [{ type: 'SOLID', color: COLORS.black }];
  textNode.letterSpacing = { value: LAYOUT.subtitleLetterSpacing, unit: 'PIXELS' };
  textNode.lineHeight = { value: LAYOUT.subtitleLineHeight, unit: 'PIXELS' };

  innerFrame.appendChild(textNode);
  return outerFrame;
}

// Find .subtitle component (Table small variant) and create instance
async function createTableSmallSubtitleInstance(subtitle: string): Promise<InstanceNode | FrameNode> {
  await figma.loadAllPagesAsync();

  let subtitleComponent = (await figma.getNodeByIdAsync('6194:130146')) as ComponentNode | null;
  if (!subtitleComponent) {
    subtitleComponent = figma.root.findOne(node =>
      node.type === 'COMPONENT' && node.name === '.subtitle'
    ) as ComponentNode | null;
  }

  if (subtitleComponent) {
    const instance = subtitleComponent.createInstance();
    const textNode = instance.findOne(node => node.type === 'TEXT') as TextNode | null;
    if (textNode) {
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = subtitle;
    }
    return instance;
  }

  // Fallback: create frame if component not found
  const frame = figma.createFrame();
  frame.name = 'Header Cell';
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'CENTER';
  frame.layoutSizingHorizontal = 'FIXED';
  frame.counterAxisSizingMode = 'AUTO';
  frame.paddingLeft = 12;
  frame.paddingRight = 12;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;
  frame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];

  const text = figma.createText();
  text.characters = subtitle;
  text.fontSize = 16;
  text.fontName = FONT.familySemiBold;
  text.fills = [{ type: 'SOLID', color: COLORS.black }];
  frame.appendChild(text);

  return frame;
}

// Calculate luminance to determine if color is light or dark
function isLightColor(color: RGB | RGBA): boolean {
  if (!color || typeof color !== 'object') return false;
  // Use relative luminance formula
  const r = color.r !== undefined ? color.r : 0;
  const g = color.g !== undefined ? color.g : 0;
  const b = color.b !== undefined ? color.b : 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5; // Consider light if luminance > 50%
}

// Create checkerboard pattern for transparency display (Figma-style)
function createCheckerboardPattern(size: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = 'Checkerboard Pattern';
  frame.resize(size, size);
  frame.clipsContent = true;
  frame.fills = [];

  // Standard checkerboard colors: white and light gray
  const color1 = { r: 1, g: 1, b: 1 };      // White
  const color2 = { r: 0.9, g: 0.9, b: 0.9 }; // Light gray

  // Size of each square in the checkerboard
  const squareSize = 4;

  const cols = Math.ceil(size / squareSize);
  const rows = Math.ceil(size / squareSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const square = figma.createRectangle();
      square.resize(squareSize, squareSize);
      square.x = col * squareSize;
      square.y = row * squareSize;

      // Alternate colors for checkerboard pattern
      const isEven = (row + col) % 2 === 0;
      square.fills = [{ type: 'SOLID', color: isEven ? color1 : color2 }];

      frame.appendChild(square);
    }
  }

  return frame;
}

// Create dot grid pattern like OpenAI's approach (kept for backward compatibility if needed)
function createTransparencyPattern(size: number, useDarkPattern: boolean = false): FrameNode {
  const frame = figma.createFrame();
  frame.name = 'Transparency Pattern';
  frame.resize(size, size);
  frame.clipsContent = true;
  frame.cornerRadius = LAYOUT.borderRadius;

  // Background color - dark for light colors, light for dark colors
  const bgColor = useDarkPattern
    ? { r: 0.15, g: 0.15, b: 0.15 }  // Dark background for light/white colors
    : { r: 0.92, g: 0.92, b: 0.92 }; // Light background for dark colors

  frame.fills = [{ type: 'SOLID', color: bgColor }];

  // Add dot grid pattern
  const dotColor = useDarkPattern
    ? { r: 0.3, g: 0.3, b: 0.3 }   // Lighter dots on dark bg
    : { r: 0.8, g: 0.8, b: 0.8 };  // Darker dots on light bg

  const dotSize = 1.5;
  const spacing = 4;
  const cols = Math.ceil(size / spacing);
  const rows = Math.ceil(size / spacing);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dot = figma.createEllipse();
      dot.resize(dotSize, dotSize);
      dot.x = col * spacing + (spacing - dotSize) / 2;
      dot.y = row * spacing + (spacing - dotSize) / 2;
      dot.fills = [{ type: 'SOLID', color: dotColor }];
      frame.appendChild(dot);
    }
  }

  return frame;
}

function createColorSwatch(color: RGB | RGBA, size: number = LAYOUT.swatchSize): FrameNode {
  const container = figma.createFrame();
  container.name = 'Color Swatch';
  container.resize(size, size);
  container.fills = [];
  container.clipsContent = true;
  container.cornerRadius = LAYOUT.borderRadius;
  container.strokes = [{ type: 'SOLID', color: COLORS.gray200 }];
  container.strokeWeight = 1;

  const hasTransparency = hasAlpha(color as RGBA);
  const alpha = hasTransparency ? (color as RGBA).a : 1;

  if (!hasTransparency || alpha === 1) {
    // Opaque color: show solid color on entire area
    const colorRect = figma.createRectangle();
    colorRect.name = 'Color';
    colorRect.resize(size, size);
    colorRect.cornerRadius = LAYOUT.borderRadius;
    colorRect.fills = [{
      type: 'SOLID',
      color: { r: color.r, g: color.g, b: color.b },
      opacity: 1,
    }];
    container.appendChild(colorRect);
    colorRect.x = 0;
    colorRect.y = 0;
  } else {
    // Transparent color: split-view approach
    const halfWidth = size / 2;

    // Left half: solid color (no transparency)
    const leftRect = figma.createRectangle();
    leftRect.name = 'Color Solid';
    leftRect.resize(halfWidth, size);
    leftRect.cornerRadius = 0;
    leftRect.fills = [{
      type: 'SOLID',
      color: { r: color.r, g: color.g, b: color.b },
      opacity: 1,
    }];
    container.appendChild(leftRect);
    leftRect.x = 0;
    leftRect.y = 0;

    // Right half: checkerboard pattern + color with transparency
    const rightFrame = figma.createFrame();
    rightFrame.name = 'Color Transparent';
    rightFrame.resize(halfWidth, size);
    rightFrame.fills = [];
    rightFrame.clipsContent = true;
    rightFrame.cornerRadius = 0;

    // Add checkerboard pattern (full size, will be clipped by rightFrame)
    const checkerboard = createCheckerboardPattern(size);
    rightFrame.appendChild(checkerboard);
    checkerboard.x = 0;
    checkerboard.y = 0;

    // Add color with transparency on top
    const rightColorRect = figma.createRectangle();
    rightColorRect.name = 'Color Overlay';
    rightColorRect.resize(halfWidth, size);
    rightColorRect.cornerRadius = 0;
    rightColorRect.fills = [{
      type: 'SOLID',
      color: { r: color.r, g: color.g, b: color.b },
      opacity: alpha,
    }];
    rightFrame.appendChild(rightColorRect);
    rightColorRect.x = 0;
    rightColorRect.y = 0;

    container.appendChild(rightFrame);
    rightFrame.x = halfWidth;
    rightFrame.y = 0;
  }

  return container;
}

function createPill(text: string, style: 'token' | 'reference' | 'value' | 'cssToken'): FrameNode {
  const pill = figma.createFrame();
  pill.name = `Pill: ${text}`;
  pill.layoutMode = 'HORIZONTAL';
  pill.primaryAxisAlignItems = 'CENTER';
  pill.counterAxisAlignItems = 'CENTER';
  pill.paddingLeft = 10;
  pill.paddingRight = 10;
  pill.paddingTop = 6;
  pill.paddingBottom = 6;
  pill.primaryAxisSizingMode = 'AUTO';
  pill.counterAxisSizingMode = 'AUTO';

  // Style-specific appearance
  if (style === 'cssToken') {
    // Dark pill style with full rounding (like OpenAI design tokens)
    pill.cornerRadius = 100; // Full rounding
    pill.fills = [{ type: 'SOLID', color: COLORS.gray200 }];
    pill.strokes = [];
  } else {
    // Default style
    pill.cornerRadius = 6;
    pill.fills = [{ type: 'SOLID', color: COLORS.gray50 }];
    pill.strokes = [{ type: 'SOLID', color: COLORS.gray200 }];
    pill.strokeWeight = 1;
  }

  const textNode = figma.createText();
  textNode.characters = text;
  textNode.fontSize = 13;
  textNode.fontName = FONT.familyMono;
  textNode.fills = [{ type: 'SOLID', color: COLORS.gray900 }];

  pill.appendChild(textNode);
  return pill;
}

function createTextCell(text: string, width: number, align: 'LEFT' | 'CENTER' | 'RIGHT' = 'LEFT', isHeader: boolean = false): FrameNode {
  const cell = figma.createFrame();
  cell.name = `Cell: ${text}`;
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisAlignItems = align === 'LEFT' ? 'MIN' : align === 'RIGHT' ? 'MAX' : 'CENTER';
  cell.counterAxisAlignItems = 'CENTER';
  cell.resize(width, isHeader ? LAYOUT.headerHeight : LAYOUT.rowHeight);
  cell.layoutSizingHorizontal = 'FIXED';
  cell.layoutSizingVertical = 'FIXED';
  cell.paddingLeft = LAYOUT.cellPadding;
  cell.paddingRight = LAYOUT.cellPadding;
  cell.clipsContent = false;
  cell.fills = [];

  const textNode = figma.createText();
  textNode.characters = text || '—';
  textNode.fontSize = isHeader ? FONT.size.header : FONT.size.regular;
  textNode.fontName = isHeader ? FONT.familySemiBold : FONT.family;
  textNode.fills = [{ type: 'SOLID', color: isHeader ? COLORS.gray500 : COLORS.gray900 }];
  textNode.textAlignHorizontal = align;
  textNode.textAutoResize = 'WIDTH_AND_HEIGHT';

  cell.appendChild(textNode);
  return cell;
}

function createWrappingTextCell(text: string, width: number, isDark: boolean = false): FrameNode {
  const cell = figma.createFrame();
  cell.name = `Cell: ${text}`;
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisAlignItems = 'MIN';
  cell.counterAxisAlignItems = 'CENTER';
  cell.resize(width, LAYOUT.rowHeight);
  cell.layoutSizingHorizontal = 'FIXED';
  cell.layoutSizingVertical = 'FIXED';
  cell.paddingLeft = LAYOUT.cellPadding;
  cell.paddingRight = LAYOUT.cellPadding;
  cell.clipsContent = true;
  cell.fills = [];

  const textNode = figma.createText();
  textNode.characters = text || '—';
  textNode.fontSize = FONT.size.regular; // 14px for name and description
  textNode.fontName = FONT.family;
  textNode.fills = [{ type: 'SOLID', color: isDark ? COLORS.gray900 : COLORS.gray500 }];
  textNode.textAlignHorizontal = 'LEFT';
  textNode.textAlignVertical = 'CENTER';
  textNode.resize(width - LAYOUT.cellPadding * 2, LAYOUT.rowHeight);
  textNode.textAutoResize = 'NONE';

  cell.appendChild(textNode);
  return cell;
}

function createColorValueCell(resolvedValue: ResolvedValue, width: number): FrameNode {
  const cell = figma.createFrame();
  cell.name = 'Color Value Cell';
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisAlignItems = 'MIN';
  cell.counterAxisAlignItems = 'CENTER';
  cell.itemSpacing = 6;
  cell.resize(width, LAYOUT.rowHeight);
  cell.layoutSizingHorizontal = 'FIXED';
  cell.layoutSizingVertical = 'FIXED';
  cell.paddingLeft = LAYOUT.cellPadding;
  cell.paddingRight = LAYOUT.cellPadding;
  cell.clipsContent = true;
  cell.fills = [];

  const color = resolvedValue.value as RGBA;

  // Color swatch
  const swatch = createColorSwatch(color);
  cell.appendChild(swatch);

  if (resolvedValue.isAlias && resolvedValue.aliasName) {
    // Show reference pill
    const refPill = createPill(`${resolvedValue.aliasName}`, 'reference');
    cell.appendChild(refPill);
  } else {
    // Show hex value
    const hexPill = createPill(rgbToHex(color), 'value');
    cell.appendChild(hexPill);

    // Show opacity if alpha < 100%
    if (hasAlpha(color)) {
      const alphaPill = createPill(`${getAlphaPercent(color)}%`, 'value');
      cell.appendChild(alphaPill);
    }
  }

  return cell;
}

function createNumberValueCell(resolvedValue: ResolvedValue, width: number, scopes: VariableScope[]): FrameNode {
  const cell = figma.createFrame();
  cell.name = 'Number Value Cell';
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisAlignItems = 'MIN';
  cell.counterAxisAlignItems = 'CENTER';
  cell.itemSpacing = 8;
  cell.resize(width, LAYOUT.rowHeight);
  cell.layoutSizingHorizontal = 'FIXED';
  cell.layoutSizingVertical = 'FIXED';
  cell.paddingLeft = LAYOUT.cellPadding;
  cell.paddingRight = LAYOUT.cellPadding;
  cell.fills = [];

  if (resolvedValue.isAlias && resolvedValue.aliasName) {
    const refPill = createPill(`${resolvedValue.aliasName}`, 'reference');
    cell.appendChild(refPill);
  } else {
    const formattedValue = formatNumberValue(resolvedValue.value as number, scopes);
    const valuePill = createPill(formattedValue, 'value');
    cell.appendChild(valuePill);
  }

  return cell;
}

function createStringValueCell(resolvedValue: ResolvedValue, width: number): FrameNode {
  const cell = figma.createFrame();
  cell.name = 'String Value Cell';
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisAlignItems = 'MIN';
  cell.counterAxisAlignItems = 'CENTER';
  cell.resize(width, LAYOUT.rowHeight);
  cell.layoutSizingHorizontal = 'FIXED';
  cell.layoutSizingVertical = 'FIXED';
  cell.paddingLeft = LAYOUT.cellPadding;
  cell.paddingRight = LAYOUT.cellPadding;
  cell.fills = [];

  if (resolvedValue.isAlias && resolvedValue.aliasName) {
    const refPill = createPill(`${resolvedValue.aliasName}`, 'reference');
    cell.appendChild(refPill);
  } else {
    const valuePill = createPill(String(resolvedValue.value), 'value');
    cell.appendChild(valuePill);
  }

  return cell;
}

function createValueCell(resolvedValue: ResolvedValue, width: number, scopes: VariableScope[]): FrameNode {
  switch (resolvedValue.type) {
    case 'COLOR':
      return createColorValueCell(resolvedValue, width);
    case 'FLOAT':
      return createNumberValueCell(resolvedValue, width, scopes);
    case 'STRING':
    case 'BOOLEAN':
    default:
      return createStringValueCell(resolvedValue, width);
  }
}

// ============================================================================
// Table Generation
// ============================================================================

interface ColumnVisibility {
  showDescription: boolean;
  showScope: boolean;
  showTokenRef: boolean;
}

function createHeaderRow(modes: { modeId: string; name: string }[], visibility: ColumnVisibility, totalWidth: number): FrameNode {
  const row = figma.createFrame();
  row.name = 'Header Row';
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.resize(totalWidth, LAYOUT.headerHeight);
  row.layoutSizingVertical = 'FIXED';
  row.clipsContent = false;
  row.fills = [{ type: 'SOLID', color: COLORS.white }];

  // Name column
  row.appendChild(createTextCell('Name', LAYOUT.columnWidths.token, 'LEFT', true));

  // Mode columns
  for (const mode of modes) {
    row.appendChild(createTextCell(mode.name, LAYOUT.columnWidths.mode, 'LEFT', true));
  }

  // Scope column (if any variable has non-All scope)
  if (visibility.showScope) {
    row.appendChild(createTextCell('Scope', LAYOUT.columnWidths.scope, 'LEFT', true));
  }

  // Description column (if any variable has description)
  if (visibility.showDescription) {
    row.appendChild(createTextCell('Description', LAYOUT.columnWidths.description, 'LEFT', true));
  }

  // Token column (if any variable has token reference in description) - HUG width
  if (visibility.showTokenRef) {
    const tokenHeaderCell = figma.createFrame();
    tokenHeaderCell.name = 'Token Header';
    tokenHeaderCell.layoutMode = 'HORIZONTAL';
    tokenHeaderCell.primaryAxisAlignItems = 'MIN';
    tokenHeaderCell.counterAxisAlignItems = 'CENTER';
    tokenHeaderCell.layoutSizingHorizontal = 'HUG';
    tokenHeaderCell.layoutSizingVertical = 'FIXED';
    tokenHeaderCell.resize(100, LAYOUT.headerHeight);
    tokenHeaderCell.paddingLeft = LAYOUT.cellPadding;
    tokenHeaderCell.paddingRight = LAYOUT.cellPadding;
    tokenHeaderCell.fills = [];

    const textNode = figma.createText();
    textNode.characters = 'Token';
    textNode.fontSize = FONT.size.header;
    textNode.fontName = FONT.familyMedium;
    textNode.fills = [{ type: 'SOLID', color: COLORS.gray500 }];
    tokenHeaderCell.appendChild(textNode);

    row.appendChild(tokenHeaderCell);
  }

  return row;
}

async function createGroupHeader(groupName: string, totalWidth: number, visibility: ColumnVisibility): Promise<InstanceNode | FrameNode> {
  // Use .subtitle component instance for group headers
  return await createSubtitleInstance(groupName || 'Ungrouped');
}

async function createSubGroupHeader(fullGroupPath: string, totalWidth: number, visibility: ColumnVisibility): Promise<InstanceNode | FrameNode> {
  // Use .subtitle component instance for sub-group headers
  return await createSubtitleInstance(fullGroupPath);
}

async function createDataRow(
  variable: Variable,
  modes: { modeId: string; name: string }[],
  visibility: ColumnVisibility,
  totalWidth: number,
  columnWidths: typeof LAYOUT.columnWidths
): Promise<FrameNode> {
  const row = figma.createFrame();
  row.name = `Row: ${variable.name}`;
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.layoutSizingHorizontal = 'HUG';
  row.layoutSizingVertical = 'FIXED';
  row.resize(100, LAYOUT.rowHeight);
  row.clipsContent = false;
  row.fills = [{ type: 'SOLID', color: COLORS.white }];
  row.strokes = [{ type: 'SOLID', color: COLORS.gray100 }];
  row.strokeWeight = 1;
  row.strokeAlign = 'INSIDE';
  // Only bottom stroke
  row.strokeTopWeight = 0;
  row.strokeLeftWeight = 0;
  row.strokeRightWeight = 0;
  row.strokeBottomWeight = 1;

  // Name column (plain text, base name only since group is in section header)
  row.appendChild(createWrappingTextCell(getVariableBaseName(variable.name), columnWidths.token, true));

  // Mode columns
  for (const mode of modes) {
    const resolvedValue = await resolveValue(variable, mode.modeId, mode.name);
    const valueCell = createValueCell(resolvedValue, columnWidths.mode, variable.scopes);
    row.appendChild(valueCell);
  }

  // Scope column (if visible)
  if (visibility.showScope) {
    row.appendChild(createWrappingTextCell(formatScope(variable.scopes), LAYOUT.columnWidths.scope));
  }

  // Parse description for token reference
  const parsed = parseDescription(variable.description || '');

  // Description column (if visible) - use parsed description without token ref
  if (visibility.showDescription) {
    row.appendChild(createWrappingTextCell(parsed.description, LAYOUT.columnWidths.description));
  }

  // Token column (if visible) - HUG width to never clip
  if (visibility.showTokenRef) {
    const tokenCell = figma.createFrame();
    tokenCell.name = 'Token Cell';
    tokenCell.layoutMode = 'HORIZONTAL';
    tokenCell.primaryAxisAlignItems = 'MIN';
    tokenCell.counterAxisAlignItems = 'CENTER';
    tokenCell.layoutSizingHorizontal = 'HUG';
    tokenCell.layoutSizingVertical = 'FIXED';
    tokenCell.resize(100, LAYOUT.rowHeight);
    tokenCell.paddingLeft = LAYOUT.cellPadding;
    tokenCell.paddingRight = LAYOUT.cellPadding;
    tokenCell.fills = [];

    if (parsed.tokenRef) {
      const tokenPill = createPill(parsed.tokenRef, 'cssToken');
      tokenCell.appendChild(tokenPill);
    }

    row.appendChild(tokenCell);
  }

  return row;
}

async function generateTable(collectionId: string): Promise<FrameNode> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  const variables = await getVariablesForCollection(collectionId);
  const modes = collection.modes.map(m => ({ modeId: m.modeId, name: m.name }));

  // Create autolayout frame as root
  const root = figma.createFrame();
  root.name = `Base UI: ${collection.name}`;

  await applyRootFrameStyles(root);

  // Create inner group frame for autolayout content
  const group = figma.createFrame();
  group.name = 'group';
  group.layoutMode = 'VERTICAL';
  group.primaryAxisSizingMode = 'AUTO';
  group.counterAxisSizingMode = 'AUTO';
  group.paddingLeft = LAYOUT.sectionPadding;
  group.paddingRight = LAYOUT.sectionPadding;
  group.paddingTop = LAYOUT.sectionPadding;
  group.paddingBottom = LAYOUT.sectionPadding;
  group.fills = [];
  group.clipsContent = false;



  // Get variables in Figma's original order (based on collection.variableIds)
  const orderedVariables: Variable[] = [];
  for (const varId of collection.variableIds) {
    const variable = variables.find(v => v.id === varId);
    if (variable) {
      orderedVariables.push(variable);
    }
  }

  // Determine column visibility
  // Show Description column only if at least one variable has a description (after parsing)
  const showDescription = orderedVariables.some(v => {
    const parsed = parseDescription(v.description || '');
    return parsed.description.trim() !== '';
  });

  // Show Scope column only if at least one variable has a non-All scope
  const showScope = orderedVariables.some(v => {
    const scopeText = formatScope(v.scopes);
    return scopeText !== 'All';
  });

  // Show Token column only if at least one variable has a token reference in description
  const showTokenRef = orderedVariables.some(v => {
    const parsed = parseDescription(v.description || '');
    return parsed.tokenRef !== null;
  });

  const visibility: ColumnVisibility = { showDescription, showScope, showTokenRef };

  // Calculate dynamic column widths based on collection name
  const isColorCollection = collection.name.toLowerCase().includes('color');
  const columnWidths = {
    ...LAYOUT.columnWidths,
    token: isColorCollection ? LAYOUT.columnWidths.token : 120,
    mode: isColorCollection ? LAYOUT.columnWidths.mode : 120,
  };

  // Calculate total table width (accounting for hidden columns)
  let totalWidth = columnWidths.token + (modes.length * columnWidths.mode);
  if (showDescription) totalWidth += columnWidths.description;
  if (showScope) totalWidth += columnWidths.scope;
  if (showTokenRef) totalWidth += columnWidths.cssToken;

  // Add title component with Sentence case collection name
  const titleComponent = await createTitleInstance(toSentenceCase(collection.name));
  group.appendChild(titleComponent);
  titleComponent.layoutSizingHorizontal = 'FILL';

  // Group variables by first-level group (preserving order)
  const firstLevelGroups = new Map<string, Variable[]>();
  for (const variable of orderedVariables) {
    const firstLevel = getFirstLevelGroup(variable.name);
    if (!firstLevelGroups.has(firstLevel)) {
      firstLevelGroups.set(firstLevel, []);
    }
    firstLevelGroups.get(firstLevel)!.push(variable);
  }

  // Create horizontal content container for columns
  const contentFrame = figma.createFrame();
  contentFrame.name = 'Content';
  contentFrame.layoutMode = 'HORIZONTAL';
  contentFrame.primaryAxisAlignItems = 'MIN';
  contentFrame.counterAxisAlignItems = 'MIN';
  contentFrame.primaryAxisSizingMode = 'AUTO';
  contentFrame.counterAxisSizingMode = 'AUTO';
  contentFrame.itemSpacing = 160; // 160px gap between columns
  contentFrame.fills = [];
  contentFrame.clipsContent = false;

  group.appendChild(contentFrame);

  // Create a vertical column for each first-level group
  for (const [firstLevelName, groupVariables] of firstLevelGroups) {
    // Create column frame for this first-level group
    const column = figma.createFrame();
    column.name = `Group: ${firstLevelName}`;
    column.layoutMode = 'VERTICAL';
    column.primaryAxisAlignItems = 'MIN';
    column.counterAxisAlignItems = 'MIN';
    column.primaryAxisSizingMode = 'AUTO';
    column.counterAxisSizingMode = 'AUTO';
    column.fills = [];
    column.clipsContent = false;

    // Check if there are sub-groups within this first-level group
    const subGrouped = new Map<string, Variable[]>();
    for (const variable of groupVariables) {
      const subGroup = getSubGroup(variable.name);
      if (!subGrouped.has(subGroup)) {
        subGrouped.set(subGroup, []);
      }
      subGrouped.get(subGroup)!.push(variable);
    }

    // Check if there are direct variables (not in sub-groups)
    const hasDirectVariables = subGrouped.has('') && subGrouped.get('')!.length > 0;

    // If there are multiple sub-groups or meaningful sub-groups, show sub-headers
    const hasSubGroups = subGrouped.size > 1 || (subGrouped.size === 1 && !subGrouped.has(''));

    // Add column header only if there are direct variables in this group
    if (hasDirectVariables || !hasSubGroups) {
      const columnHeader = await createGroupHeader(firstLevelName, totalWidth, visibility);
      column.appendChild(columnHeader);
      columnHeader.layoutSizingHorizontal = 'FILL';
    }

    if (hasSubGroups) {
      // Add rows with sub-group headers
      let isFirstSubGroup = true;
      for (const [subGroupName, subGroupVars] of subGrouped) {
        // Add spacer before sub-group header (except first)
        if (!isFirstSubGroup && subGroupName !== '') {
          const spacer = figma.createFrame();
          spacer.name = 'Sub-Group Spacer';
          spacer.layoutMode = 'HORIZONTAL';
          spacer.layoutSizingHorizontal = 'HUG';
          spacer.layoutSizingVertical = 'FIXED';
          spacer.resize(100, 96);
          spacer.fills = [];
          column.appendChild(spacer);
          spacer.layoutSizingHorizontal = 'FILL';
        }
        isFirstSubGroup = false;

        // Add sub-group header if there's a sub-group name
        if (subGroupName !== '') {
          const fullGroupPath = `${firstLevelName}/${subGroupName}`;
          const subHeader = await createSubGroupHeader(fullGroupPath, totalWidth, visibility);
          column.appendChild(subHeader);
          subHeader.layoutSizingHorizontal = 'FILL';
        }

        // Add data rows
        for (const variable of subGroupVars) {
          const dataRow = await createDataRow(variable, modes, visibility, totalWidth, columnWidths);
          column.appendChild(dataRow);
          dataRow.layoutSizingHorizontal = 'FILL';
        }
      }
    } else {
      // No sub-groups, just add rows directly
      for (const variable of groupVariables) {
        const dataRow = await createDataRow(variable, modes, visibility, totalWidth, columnWidths);
        column.appendChild(dataRow);
        dataRow.layoutSizingHorizontal = 'FILL';
      }
    }

    contentFrame.appendChild(column);
  }

  root.appendChild(group);
  return root;
}

// ============================================================================
// Typography Table Generation
// ============================================================================

async function generateTypographyTable(): Promise<FrameNode> {
  const textStyles = await figma.getLocalTextStylesAsync();

  if (textStyles.length === 0) {
    throw new Error('No text styles found in this file');
  }

  // Weight mapping for sorting
  const getWeight = (style: string): number => {
    const weightMap: Record<string, number> = {
      'Thin': 100, 'ExtraLight': 200, 'Light': 300, 'Regular': 400,
      'Medium': 500, 'SemiBold': 600, 'Semi Bold': 600, 'Bold': 700,
      'ExtraBold': 800, 'Black': 900
    };
    return weightMap[style] || 400;
  };

  // Size category order (largest to smallest)
  const getSizeOrder = (name: string): number => {
    const sizeOrder: Record<string, number> = {
      '5xl': 0, '4xl': 1, '3xl': 2, '2xl': 3, 'xl': 4,
      'lg': 5, 'md': 6, 'sm': 7, 'xs': 8, '2xs': 9, '3xs': 10
    };
    const parts = name.split('/');
    for (const part of parts) {
      if (sizeOrder[part] !== undefined) {
        return sizeOrder[part];
      }
    }
    return 99;
  };

  // Get name prefix (e.g., "heading" or "text")
  const getPrefix = (name: string): string => {
    return name.split('/')[0] || '';
  };

  // Sort by: tabular styles last, then prefix (alphabetically), then size category, then weight (heaviest first)
  textStyles.sort((a, b) => {
    // First check if either style is tabular - tabular styles go to the end
    const isTabularA = a.name.toLowerCase().includes('tabular');
    const isTabularB = b.name.toLowerCase().includes('tabular');
    if (isTabularA !== isTabularB) {
      return isTabularA ? 1 : -1; // Tabular styles come after non-tabular
    }
    // If both are tabular or both are not, continue with normal sorting
    // First by prefix
    const prefixA = getPrefix(a.name);
    const prefixB = getPrefix(b.name);
    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB);
    }
    // Then by size category
    const sizeOrderA = getSizeOrder(a.name);
    const sizeOrderB = getSizeOrder(b.name);
    if (sizeOrderA !== sizeOrderB) {
      return sizeOrderA - sizeOrderB;
    }
    // Then by weight (heaviest first)
    return getWeight(b.fontName.style) - getWeight(a.fontName.style);
  });

  // Create root frame
  const root = figma.createFrame();
  root.name = 'Base UI: text styles';

  await applyRootFrameStyles(root);

  // Create inner group frame for autolayout content
  const group = figma.createFrame();
  group.name = 'group';
  group.layoutMode = 'VERTICAL';
  group.primaryAxisSizingMode = 'AUTO';
  group.counterAxisSizingMode = 'AUTO';
  group.paddingLeft = LAYOUT.sectionPadding;
  group.paddingRight = LAYOUT.sectionPadding;
  group.paddingTop = LAYOUT.sectionPadding;
  group.paddingBottom = LAYOUT.sectionPadding;
  group.fills = [];
  group.clipsContent = false;
  root.appendChild(group);

  // Column widths for typography table
  const TYPO_COLUMNS = {
    name: 220,
    size: 100,
    weight: 100,
    trackingPx: 140,
    trackingEm: 140,
    line: 100,
    example: 500,
  };
  const totalWidth = TYPO_COLUMNS.name + TYPO_COLUMNS.size + TYPO_COLUMNS.weight + TYPO_COLUMNS.trackingPx + TYPO_COLUMNS.trackingEm + TYPO_COLUMNS.line + TYPO_COLUMNS.example;

  // Add title (using .title instance)
  const titleInstance = await createTitleInstance('Text styles');
  group.appendChild(titleInstance);
  titleInstance.layoutSizingHorizontal = 'FILL';

  // Add header row (using .subtitle Table small instances)
  const headerRow = figma.createFrame();
  headerRow.name = 'Header Row';
  headerRow.layoutMode = 'HORIZONTAL';
  headerRow.primaryAxisAlignItems = 'MIN';
  headerRow.counterAxisAlignItems = 'CENTER';
  headerRow.primaryAxisSizingMode = 'AUTO';
  headerRow.counterAxisSizingMode = 'AUTO';
  headerRow.fills = [];

  const headers = ['Name', 'Size', 'Weight', 'Tracking (px)', 'Tracking (em)', 'Line', 'Example'];
  const widths = [TYPO_COLUMNS.name, TYPO_COLUMNS.size, TYPO_COLUMNS.weight, TYPO_COLUMNS.trackingPx, TYPO_COLUMNS.trackingEm, TYPO_COLUMNS.line, TYPO_COLUMNS.example];

  for (let i = 0; i < headers.length; i++) {
    const subtitleInstance = await createTableSmallSubtitleInstance(headers[i]);
    headerRow.appendChild(subtitleInstance);

    if (headers[i] === 'Example') {
      subtitleInstance.layoutSizingHorizontal = 'FILL';
    } else {
      subtitleInstance.resize(widths[i], subtitleInstance.height);
      subtitleInstance.layoutSizingHorizontal = 'FIXED';
    }
  }

  group.appendChild(headerRow);
  headerRow.layoutSizingHorizontal = 'FILL';

  // Sample paragraph for text normal styles with small font sizes
  const sampleParagraph = 'Typography is the silent art that shapes how we experience written language. Beyond mere letters, it orchestrates rhythm, hierarchy, and emotion, guiding the reader\'s eye and setting the tone before a single word is read. The beauty of typography lies in its subtlety: the careful balance of space and form, the harmony between font size and line height, and the way thoughtfully chosen type can make content feel effortless, inviting, and human.';

  // Helper to get example text based on style
  const getExampleText = (styleName: string, fontStyle: string, fontSize: number): string => {
    const nameLower = styleName.toLowerCase();
    const weightLower = fontStyle.toLowerCase();
    const isHeading = nameLower.includes('heading');
    const isTabular = nameLower.includes('tabular');
    const isNormalWeight = weightLower.includes('regular') || weightLower.includes('normal');

    // Tabular numbers styles should show numeric example text
    if (isTabular) {
      return '0123456789';
    }

    if (isHeading) {
      return 'Page title example';
    } else {
      // For text normal/regular with size <= 18, show sample paragraph
      if (isNormalWeight && fontSize <= 18) {
        return sampleParagraph;
      }
      return 'Body text example';
    }
  };

  // Add rows for each text style
  for (const style of textStyles) {
    // Load the font for this style
    try {
      await figma.loadFontAsync(style.fontName);
    } catch {
      // Skip styles with unavailable fonts
      continue;
    }

    const exampleText = getExampleText(style.name, style.fontName.style, style.fontSize);

    // Check if this will be a paragraph case
    const nameLowerCheck = style.name.toLowerCase();
    const weightLowerCheck = style.fontName.style.toLowerCase();
    const isHeadingCheck = nameLowerCheck.includes('heading');
    const isTabularCheck = nameLowerCheck.includes('tabular');
    const isNormalWeightCheck = weightLowerCheck.includes('regular') || weightLowerCheck.includes('normal');
    const willShowParagraph = !isHeadingCheck && !isTabularCheck && isNormalWeightCheck && style.fontSize <= 18;

    const finalExampleText = willShowParagraph ? `Body text example\n${exampleText}` : exampleText;

    // Create example text (auto width for non-paragraph, fixed width for paragraph)
    const exampleTextNode = figma.createText();
    await exampleTextNode.setTextStyleIdAsync(style.id);
    exampleTextNode.characters = finalExampleText;
    exampleTextNode.fills = [{ type: 'SOLID', color: COLORS.gray900 }];

    if (willShowParagraph) {
      // Paragraph needs fixed width to wrap
      exampleTextNode.resize(600, style.fontSize);
      exampleTextNode.textAutoResize = 'HEIGHT';
    } else {
      // Short text - auto width, no wrap
      exampleTextNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    }

    // Calculate row height based on content
    let rowHeight = 72;
    if (willShowParagraph) {
      // For paragraph: title + paragraph + spacing + padding
      const paragraphHeight = exampleTextNode.height;
      rowHeight = Math.max(72, style.fontSize + 8 + paragraphHeight + 32);
    } else {
      // For short text: just font size + padding
      rowHeight = Math.max(72, style.fontSize + 32);
    }

    const row = figma.createFrame();
    row.name = `Row: ${style.name}`;
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisAlignItems = 'MIN';
    row.counterAxisAlignItems = 'CENTER';
    row.resize(totalWidth, rowHeight);
    row.layoutSizingHorizontal = 'HUG';
    row.layoutSizingVertical = 'FIXED';
    row.fills = [{ type: 'SOLID', color: COLORS.white }];
    row.strokes = [{ type: 'SOLID', color: COLORS.gray100 }];
    row.strokeWeight = 1;
    row.strokeAlign = 'INSIDE';
    row.strokeTopWeight = 0;
    row.strokeLeftWeight = 0;
    row.strokeRightWeight = 0;
    row.strokeBottomWeight = 1;

    // Name cell - regular font size like Token column
    row.appendChild(createWrappingTextCell(style.name, TYPO_COLUMNS.name, true));

    // Size cell
    const sizeCell = figma.createFrame();
    sizeCell.name = 'Size Cell';
    sizeCell.layoutMode = 'HORIZONTAL';
    sizeCell.primaryAxisAlignItems = 'MIN';
    sizeCell.counterAxisAlignItems = 'CENTER';
    sizeCell.resize(TYPO_COLUMNS.size, rowHeight);
    sizeCell.layoutSizingHorizontal = 'FIXED';
    sizeCell.layoutSizingVertical = 'FIXED';
    sizeCell.paddingLeft = LAYOUT.cellPadding;
    sizeCell.fills = [];
    sizeCell.appendChild(createPill(`${Math.round(style.fontSize)}px`, 'value'));
    row.appendChild(sizeCell);

    // Weight cell
    const weightCell = figma.createFrame();
    weightCell.name = 'Weight Cell';
    weightCell.layoutMode = 'HORIZONTAL';
    weightCell.primaryAxisAlignItems = 'MIN';
    weightCell.counterAxisAlignItems = 'CENTER';
    weightCell.resize(TYPO_COLUMNS.weight, rowHeight);
    weightCell.layoutSizingHorizontal = 'FIXED';
    weightCell.layoutSizingVertical = 'FIXED';
    weightCell.paddingLeft = LAYOUT.cellPadding;
    weightCell.fills = [];
    // Extract weight from font style name or use common mapping
    const weightMap: Record<string, number> = {
      'Thin': 100, 'ExtraLight': 200, 'Light': 300, 'Regular': 400,
      'Medium': 500, 'SemiBold': 600, 'Semi Bold': 600, 'Bold': 700,
      'ExtraBold': 800, 'Black': 900
    };
    const fontStyle = style.fontName.style;
    const weight = weightMap[fontStyle] || 400;
    weightCell.appendChild(createPill(`${weight}`, 'value'));
    row.appendChild(weightCell);

    // Tracking cell in pixels
    const trackingPxCell = figma.createFrame();
    trackingPxCell.name = 'Tracking Px Cell';
    trackingPxCell.layoutMode = 'HORIZONTAL';
    trackingPxCell.primaryAxisAlignItems = 'MIN';
    trackingPxCell.counterAxisAlignItems = 'CENTER';
    trackingPxCell.resize(TYPO_COLUMNS.trackingPx, rowHeight);
    trackingPxCell.layoutSizingHorizontal = 'FIXED';
    trackingPxCell.layoutSizingVertical = 'FIXED';
    trackingPxCell.paddingLeft = LAYOUT.cellPadding;
    trackingPxCell.fills = [];

    let trackingPxValue = 0;
    if (style.letterSpacing.unit === 'PIXELS') {
      trackingPxValue = Math.round(style.letterSpacing.value * 100) / 100;
    } else if (style.letterSpacing.unit === 'PERCENT') {
      trackingPxValue = Math.round((style.letterSpacing.value / 100) * style.fontSize * 100) / 100;
    }
    trackingPxCell.appendChild(createPill(`${trackingPxValue}px`, 'value'));
    row.appendChild(trackingPxCell);

    // Tracking cell in em
    const trackingEmCell = figma.createFrame();
    trackingEmCell.name = 'Tracking Em Cell';
    trackingEmCell.layoutMode = 'HORIZONTAL';
    trackingEmCell.primaryAxisAlignItems = 'MIN';
    trackingEmCell.counterAxisAlignItems = 'CENTER';
    trackingEmCell.resize(TYPO_COLUMNS.trackingEm, rowHeight);
    trackingEmCell.layoutSizingHorizontal = 'FIXED';
    trackingEmCell.layoutSizingVertical = 'FIXED';
    trackingEmCell.paddingLeft = LAYOUT.cellPadding;
    trackingEmCell.fills = [];

    const emValue = Math.round((trackingPxValue / style.fontSize) * 100) / 100;
    trackingEmCell.appendChild(createPill(`${emValue}em`, 'value'));
    row.appendChild(trackingEmCell);

    // Line height cell
    const lineCell = figma.createFrame();
    lineCell.name = 'Line Cell';
    lineCell.layoutMode = 'HORIZONTAL';
    lineCell.primaryAxisAlignItems = 'MIN';
    lineCell.counterAxisAlignItems = 'CENTER';
    lineCell.resize(TYPO_COLUMNS.line, rowHeight);
    lineCell.layoutSizingHorizontal = 'FIXED';
    lineCell.layoutSizingVertical = 'FIXED';
    lineCell.paddingLeft = LAYOUT.cellPadding;
    lineCell.fills = [];
    let lineHeightStr = 'auto';
    if (style.lineHeight.unit === 'PIXELS') {
      lineHeightStr = `${Math.round(style.lineHeight.value)}px`;
    } else if (style.lineHeight.unit === 'PERCENT') {
      lineHeightStr = `${Math.round(style.lineHeight.value)}%`;
    }
    lineCell.appendChild(createPill(lineHeightStr, 'value'));
    row.appendChild(lineCell);

    // Example cell - rendered at actual font size (last column, hug so it expands)
    const exampleCell = figma.createFrame();
    exampleCell.name = `Example: ${style.name}`;
    exampleCell.layoutMode = 'VERTICAL';
    exampleCell.primaryAxisAlignItems = 'CENTER';
    exampleCell.counterAxisAlignItems = 'MIN';
    exampleCell.itemSpacing = 8;
    exampleCell.layoutSizingHorizontal = 'HUG';
    exampleCell.layoutSizingVertical = 'FIXED';
    exampleCell.resize(exampleCell.width, rowHeight);
    exampleCell.paddingLeft = LAYOUT.cellPadding;
    exampleCell.paddingRight = LAYOUT.cellPadding;
    exampleCell.clipsContent = false;
    exampleCell.fills = [];

    // Check if this is a paragraph case - add title above paragraph
    const nameLower = style.name.toLowerCase();
    const weightLower = style.fontName.style.toLowerCase();
    const isHeading = nameLower.includes('heading');
    const isTabular = nameLower.includes('tabular');
    const isNormalWeight = weightLower.includes('regular') || weightLower.includes('normal');
    const showParagraph = !isHeading && !isTabular && isNormalWeight && style.fontSize <= 18;

    exampleCell.appendChild(exampleTextNode);
    row.appendChild(exampleCell);

    group.appendChild(row);
  }

  return root;
}

// ============================================================================
// Effects Table Generation
// ============================================================================

async function generateEffectsTable(): Promise<FrameNode> {
  const effectStyles = await figma.getLocalEffectStylesAsync();

  if (effectStyles.length === 0) {
    throw new Error('No effect styles found in this file');
  }

  // Custom sort: hairline first, then by numeric value
  effectStyles.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // Extract base name (last part after /)
    const aBase = aName.split('/').pop() || aName;
    const bBase = bName.split('/').pop() || bName;

    // Hairline always first
    if (aBase.includes('hairline')) return -1;
    if (bBase.includes('hairline')) return 1;

    // Extract numeric part for comparison
    const aNum = parseInt(aBase.match(/\d+/)?.[0] || '0');
    const bNum = parseInt(bBase.match(/\d+/)?.[0] || '0');

    if (aNum !== bNum) return aNum - bNum;

    // Same base number - sort by variant (base < strong < stronger)
    if (aBase.includes('stronger')) return 1;
    if (bBase.includes('stronger')) return -1;
    if (aBase.includes('strong')) return 1;
    if (bBase.includes('strong')) return -1;

    return 0;
  });

  // All effects will be shown in both Light and Dark columns
  const allEffects = effectStyles;

  // Create main table frame
  const table = figma.createFrame();
  table.name = 'Base UI: shadow';
  table.layoutMode = 'VERTICAL';
  table.primaryAxisSizingMode = 'AUTO';
  table.counterAxisSizingMode = 'AUTO';
  table.paddingLeft = 40;
  table.paddingRight = 40;
  table.paddingTop = 40;
  table.paddingBottom = 40;
  table.fills = [{ type: 'SOLID', color: COLORS.white }];
  table.cornerRadius = 24;
  table.clipsContent = false;
  table.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.19 },
    offset: { x: 0, y: 8 },
    radius: 16,
    spread: -4,
    visible: true,
    blendMode: 'NORMAL',
  }];

  // Add title
  const titleFrame = figma.createFrame();
  titleFrame.name = 'Title';
  titleFrame.layoutMode = 'HORIZONTAL';
  titleFrame.primaryAxisAlignItems = 'MIN';
  titleFrame.counterAxisAlignItems = 'CENTER';
  titleFrame.primaryAxisSizingMode = 'AUTO';
  titleFrame.counterAxisSizingMode = 'AUTO';
  titleFrame.paddingBottom = 80;
  titleFrame.fills = [];

  const titleText = figma.createText();
  titleText.characters = 'shadow';
  titleText.fontSize = FONT.size.title;
  titleText.fontName = FONT.familyBold;
  titleText.fills = [{ type: 'SOLID', color: COLORS.black }];
  titleText.letterSpacing = { value: -1.44, unit: 'PIXELS' };
  titleText.lineHeight = { value: FONT.size.title, unit: 'PIXELS' };
  titleFrame.appendChild(titleText);
  table.appendChild(titleFrame);

  // Content container (horizontal layout for Light and Dark columns)
  const contentFrame = figma.createFrame();
  contentFrame.name = 'Content';
  contentFrame.layoutMode = 'HORIZONTAL';
  contentFrame.primaryAxisAlignItems = 'MIN';
  contentFrame.counterAxisAlignItems = 'MIN';
  contentFrame.primaryAxisSizingMode = 'AUTO';
  contentFrame.counterAxisSizingMode = 'AUTO';
  contentFrame.itemSpacing = 0;
  contentFrame.fills = [];
  contentFrame.clipsContent = false;

  table.appendChild(contentFrame);

  // Helper function to create effect card
  const createEffectCard = async (style: EffectStyle, bgColor: RGB): Promise<FrameNode> => {
    const card = figma.createFrame();
    card.name = 'shadow';
    card.layoutMode = 'VERTICAL';
    card.primaryAxisAlignItems = 'CENTER';
    card.counterAxisAlignItems = 'CENTER';
    card.resize(220, 120);
    card.layoutSizingHorizontal = 'FIXED';
    card.layoutSizingVertical = 'FIXED';
    card.paddingLeft = 8;
    card.paddingRight = 8;
    card.paddingTop = 8;
    card.paddingBottom = 8;
    card.cornerRadius = 8;
    card.fills = [{ type: 'SOLID', color: bgColor }];
    card.clipsContent = true;

    // Apply the effect style (async for dynamic-page access)
    await card.setEffectStyleIdAsync(style.id);

    // No border as requested
    card.strokes = [];

    // Add label
    const label = figma.createText();
    label.characters = style.name.split('/').pop() || style.name;
    label.fontSize = 14;
    label.fontName = FONT.family;
    label.fills = [{ type: 'SOLID', color: bgColor.r < 0.5 ? COLORS.white : COLORS.gray900 }];
    label.textAlignHorizontal = 'CENTER';
    card.appendChild(label);

    return card;
  };

  // Helper function to create mode column
  const createModeColumn = async (modeName: string, effects: EffectStyle[], isDark: boolean): Promise<FrameNode> => {
    const column = figma.createFrame();
    column.name = `Group: ${modeName}`;
    column.layoutMode = 'VERTICAL';
    column.primaryAxisAlignItems = 'MIN';
    column.counterAxisAlignItems = 'MIN';
    column.primaryAxisSizingMode = 'AUTO';
    column.counterAxisSizingMode = 'AUTO';
    // Light: #f3f3f3, Dark: #161616
    const lightBg = { r: 0.953, g: 0.953, b: 0.953 }; // #f3f3f3
    const darkBg = { r: 0.086, g: 0.086, b: 0.086 };  // #161616
    column.fills = [{ type: 'SOLID', color: isDark ? darkBg : lightBg }];
    column.clipsContent = false;

    // Mode header
    const header = figma.createFrame();
    header.name = 'Group';
    header.layoutMode = 'HORIZONTAL';
    header.primaryAxisAlignItems = 'MIN';
    header.counterAxisAlignItems = 'CENTER';
    header.primaryAxisSizingMode = 'AUTO';
    header.counterAxisSizingMode = 'AUTO';
    header.paddingLeft = 40;
    header.paddingRight = 40;
    header.paddingTop = 40;
    header.paddingBottom = 40;
    header.fills = [];

    const headerText = figma.createText();
    headerText.characters = modeName;
    headerText.fontSize = 40;
    headerText.fontName = FONT.familySemiBold;
    // Light: #0d0d0d, Dark: white
    headerText.fills = [{ type: 'SOLID', color: isDark ? COLORS.white : { r: 0.051, g: 0.051, b: 0.051 } }];
    header.appendChild(headerText);
    column.appendChild(header);

    // Effects content
    const content = figma.createFrame();
    content.name = modeName;
    content.layoutMode = 'VERTICAL';
    content.primaryAxisAlignItems = 'MIN';
    content.counterAxisAlignItems = 'MIN';
    content.primaryAxisSizingMode = 'AUTO';
    content.counterAxisSizingMode = 'AUTO';
    content.paddingLeft = 40;
    content.paddingRight = 40;
    content.paddingTop = 0;
    content.paddingBottom = 40;
    content.itemSpacing = 40;
    content.fills = [];
    content.clipsContent = false;

    // Group effects by base name (e.g., "shadow/100", "shadow/100-strong" -> "100")
    const groups = new Map<string, EffectStyle[]>();
    for (const effect of effects) {
      const nameParts = effect.name.split('/');
      const baseName = nameParts[nameParts.length - 1].replace(/-strong(er)?$/, '');
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push(effect);
    }

    // Create rows for each group
    for (const [, groupEffects] of groups) {
      const row = figma.createFrame();
      row.name = 'group';
      row.layoutMode = 'HORIZONTAL';
      row.primaryAxisAlignItems = 'MIN';
      row.counterAxisAlignItems = 'MIN';
      row.primaryAxisSizingMode = 'AUTO';
      row.counterAxisSizingMode = 'AUTO';
      row.itemSpacing = 40;  // Gap between variant cards
      row.fills = [];
      row.clipsContent = false;

      for (const effect of groupEffects) {
        // Light: #FFFFFF cards, Dark: #212121 cards
        const cardBgLight = COLORS.white;
        const cardBgDark = { r: 0.129, g: 0.129, b: 0.129 }; // #212121
        const bgColor = isDark ? cardBgDark : cardBgLight;
        const card = await createEffectCard(effect, bgColor);
        row.appendChild(card);
      }

      content.appendChild(row);
    }

    column.appendChild(content);
    return column;
  };

  // Create Light column (all effects on light background)
  if (allEffects.length > 0) {
    const lightColumn = await createModeColumn('Light', allEffects, false);
    contentFrame.appendChild(lightColumn);
  }

  // Create Dark column (same effects on dark background)
  if (allEffects.length > 0) {
    const darkColumn = await createModeColumn('Dark', allEffects, true);
    contentFrame.appendChild(darkColumn);
  }

  return table;
}

// ============================================================================
// Main Plugin Logic
// ============================================================================

figma.showUI(__html__, { width: 400, height: 800 });

figma.ui.onmessage = async (msg: { type: string; collectionIds?: string[] }) => {
  try {
    if (msg.type === 'get-collections') {
      const collections = await getCollectionsData();
      figma.ui.postMessage({ type: 'collections-data', collections });
    }

    if (msg.type === 'generate-tables' && msg.collectionIds) {
      await loadFonts();

      const tables: FrameNode[] = [];
      let xOffset = 0;

      // Get viewport center for positioning
      const viewportCenter = figma.viewport.center;

      for (const collectionId of msg.collectionIds) {
        const table = await generateTable(collectionId);

        // Position table horizontally (side by side)
        table.x = viewportCenter.x + xOffset;
        table.y = viewportCenter.y;

        figma.currentPage.appendChild(table);
        tables.push(table);

        xOffset += table.width + LAYOUT.tableGap;
      }

      // Select all generated tables and scroll to view
      figma.currentPage.selection = tables;
      figma.viewport.scrollAndZoomIntoView(tables);

      figma.ui.postMessage({
        type: 'generation-complete',
        count: tables.length
      });
    }

    if (msg.type === 'generate-typography') {
      await loadFonts();

      const table = await generateTypographyTable();

      // Position at viewport center
      const viewportCenter = figma.viewport.center;
      table.x = viewportCenter.x;
      table.y = viewportCenter.y;

      figma.currentPage.appendChild(table);
      figma.currentPage.selection = [table];
      figma.viewport.scrollAndZoomIntoView([table]);

      figma.ui.postMessage({ type: 'typography-complete' });
    }

    if (msg.type === 'generate-effects') {
      await loadFonts();

      const table = await generateEffectsTable();

      // Position at viewport center
      const viewportCenter = figma.viewport.center;
      table.x = viewportCenter.x;
      table.y = viewportCenter.y;

      figma.currentPage.appendChild(table);
      figma.currentPage.selection = [table];
      figma.viewport.scrollAndZoomIntoView([table]);

      figma.ui.postMessage({ type: 'effects-complete' });
    }

    if (msg.type === 'fix-descriptions') {
      const result = await fixDescriptions();
      figma.ui.postMessage({
        type: 'fix-descriptions-complete',
        count: result.fixedCount
      });
      figma.notify(`Fixed ${result.fixedCount} variable description(s)`);
    }


  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    figma.notify(`Error: ${errorMessage}`, { error: true });
    figma.ui.postMessage({ type: 'generation-error', message: errorMessage });
  }
};

/**
 * Fixes variable descriptions by:
 * 1. Removing pixel values like "(12px)" or "(16px)" from descriptions
 * 2. Auto-generating missing token names and descriptions from variable paths
 */
async function fixDescriptions(): Promise<{ fixedCount: number }> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let fixedCount = 0;

  // Pattern to match values in parentheses like (12px), (16px), etc.
  const valuePattern = /\s*\(\d+(?:\.\d+)?px\)\s*/g;

  for (const collection of collections) {
    // Skip primitive collections (they don't need descriptions)
    const collectionName = collection.name.toLowerCase();
    if (collectionName.includes('primitive')) continue;

    for (const variableId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) continue;

      // Skip hidden variables
      if (variable.hiddenFromPublishing) continue;

      const originalDescription = variable.description || '';
      let newDescription = originalDescription;
      let wasModified = false;

      // Step 1: Remove pixel value patterns from existing descriptions
      if (valuePattern.test(newDescription)) {
        valuePattern.lastIndex = 0;
        newDescription = newDescription.replace(valuePattern, '').trim();
        wasModified = true;
      }

      // Step 2: Auto-generate description if empty (only human description, no token)
      // Note: Token names should only be added manually when confirmed to exist in CSS
      if (!newDescription) {
        const generated = generateDescriptionFromPath(variable.name, variable.resolvedType);

        if (generated) {
          // Only add human-readable description, NOT the token name
          newDescription = generated.humanDescription;
          wasModified = true;
        }
      }

      // Step 3: Ensure description is in sentence case
      // Format: "--token-name\nHuman description" or just "Human description"
      if (newDescription) {
        const convertedDescription = convertDescriptionToSentenceCase(newDescription);
        if (convertedDescription !== newDescription) {
          newDescription = convertedDescription;
          wasModified = true;
        }
      }

      // Apply changes if modified
      if (wasModified && newDescription !== originalDescription) {
        variable.description = newDescription;
        fixedCount++;
      }
    }
  }

  return { fixedCount };
}

/**
 * Generates a CSS token name and human description from a Figma variable path.
 * 
 * Examples:
 * - "color/background/soft/default/primary" → "--color-background-primary-soft"
 * - "component/checkbox/border" → "--checkbox-border-color"
 * - "component/input/border/outline/default" → "--input-outline-border-color"
 */
function generateDescriptionFromPath(
  variablePath: string,
  resolvedType: VariableResolvedDataType
): { tokenName: string; humanDescription: string } | null {
  const parts = variablePath.split('/').map(p => p.toLowerCase().trim());

  if (parts.length < 2) return null;

  const isColor = resolvedType === 'COLOR';
  const isNumber = resolvedType === 'FLOAT';

  // Handle component-specific tokens
  if (parts[0] === 'component') {
    return generateComponentToken(parts.slice(1), isColor);
  }

  // Handle semantic color tokens
  if (parts[0] === 'color' && isColor) {
    return generateSemanticColorToken(parts.slice(1));
  }

  // Handle sizing tokens
  if (isNumber) {
    return generateSizingToken(parts);
  }

  return null;
}

/**
 * Generates tokens for component-specific variables
 * e.g., "checkbox/border" → "--checkbox-border-color"
 */
function generateComponentToken(
  parts: string[],
  isColor: boolean
): { tokenName: string; humanDescription: string } {
  const componentName = parts[0]; // e.g., "checkbox", "input", "radio"
  const propertyParts = parts.slice(1); // e.g., ["border", "hover"]

  // Build token name
  let tokenParts = [componentName, ...propertyParts];

  // Add "-color" suffix for color tokens if not already present
  if (isColor && !tokenParts.some(p => p === 'color')) {
    tokenParts.push('color');
  }

  const tokenName = '--' + tokenParts.join('-');

  // Build human description
  const descriptions: Record<string, string> = {
    'border': 'border color',
    'background': 'background color',
    'foreground': 'foreground color',
    'text': 'text color',
    'hover': 'hover state',
    'active': 'active/pressed state',
    'focus': 'focus state',
    'disabled': 'disabled state',
    'selected': 'selected state',
  };

  const descParts: string[] = [];
  descParts.push(componentName);

  for (const part of propertyParts) {
    if (descriptions[part]) {
      descParts.push(descriptions[part]);
    } else if (!['default', 'primary', 'secondary'].includes(part)) {
      descParts.push(part);
    }
  }

  return {
    tokenName,
    humanDescription: toSentenceCase(descParts.join(' '))
  };
}

/**
 * Generates tokens for semantic color variables
 * e.g., "background/soft/default/primary" → "--color-background-primary-soft"
 */
function generateSemanticColorToken(
  parts: string[]
): { tokenName: string; humanDescription: string } {
  // Extract category (background, text, border, ring, foreground)
  const category = parts[0];

  // Find intent (primary, secondary, danger, success, info, warning, caution, discovery)
  const intents = ['primary', 'secondary', 'danger', 'success', 'info', 'warning', 'caution', 'discovery'];
  const intent = parts.find(p => intents.includes(p)) || '';

  // Find variant (soft, solid, outline, ghost, surface)
  const variants = ['soft', 'solid', 'outline', 'ghost', 'surface'];
  const variant = parts.find(p => variants.includes(p)) || '';

  // Find state (hover, active, disabled, selected)
  const states = ['hover', 'active', 'disabled', 'selected', 'focus'];
  const state = parts.find(p => states.includes(p)) || '';

  // Find modifiers (alpha, alt)
  const modifiers = ['alpha', 'alt'];
  const modifier = parts.find(p => modifiers.includes(p)) || '';

  // Build token name: --color-{category}-{intent}-{variant}-{modifier}-{state}
  const tokenParts = ['color', category];
  if (intent) tokenParts.push(intent);
  if (variant) tokenParts.push(variant);
  if (modifier) tokenParts.push(modifier);
  if (state) tokenParts.push(state);

  const tokenName = '--' + tokenParts.join('-');

  // Build human description
  const descParts: string[] = [];
  if (intent) descParts.push(intent);
  if (variant) descParts.push(variant);
  descParts.push(category);
  if (modifier) descParts.push(`(${modifier})`);
  if (state) descParts.push(state);

  return {
    tokenName,
    humanDescription: toSentenceCase(descParts.join(' '))
  };
}

/**
 * Generates tokens for sizing variables
 */
function generateSizingToken(
  parts: string[]
): { tokenName: string; humanDescription: string } {
  // Simple conversion: join all parts with dashes
  const tokenName = '--' + parts.join('-');
  const humanDescription = toSentenceCase(parts.join(' '));

  return { tokenName, humanDescription };
}



/**
 * Convert variable description to sentence case.
 * Handles format: "--token-name\nHuman description" or just "Human description"
 * Preserves the token name but converts description part to sentence case.
 */
function convertDescriptionToSentenceCase(description: string): string {
  if (!description) return description;

  // Check if description has a token name (starts with --)
  if (description.startsWith('--')) {
    const newlineIndex = description.indexOf('\n');
    if (newlineIndex !== -1) {
      // Format: "--token-name\nHuman description"
      const tokenPart = description.substring(0, newlineIndex + 1);
      const humanPart = description.substring(newlineIndex + 1);
      return tokenPart + toSentenceCase(humanPart);
    }
    // Just a token name with no description
    return description;
  }

  // No token name, just human description
  return toSentenceCase(description);
}

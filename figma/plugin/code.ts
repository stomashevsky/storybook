// UI Kit - Variable Collections Documentation Generator
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
};

const LAYOUT = {
  columnWidths: {
    group: 100,
    token: 120,
    mode: 240,
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

async function resolveValue(variable: Variable, modeId: string): Promise<ResolvedValue> {
  const value = variable.valuesByMode[modeId];

  // Handle null/undefined values
  if (value === null || value === undefined) {
    return {
      type: variable.resolvedType,
      value: variable.resolvedType === 'COLOR'
        ? { r: 0, g: 0, b: 0 }
        : variable.resolvedType === 'FLOAT'
          ? 0
          : '',
      isAlias: false,
    };
  }

  // Check if it's an alias
  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const aliasedVar = await figma.variables.getVariableByIdAsync(value.id);
    if (aliasedVar) {
      // Get the resolved value from the aliased variable - try the same mode first, then first available mode
      let resolvedVal = aliasedVar.valuesByMode[modeId];
      if (resolvedVal === undefined) {
        // Mode doesn't exist in aliased var, get first available mode's value
        const modeIds = Object.keys(aliasedVar.valuesByMode);
        if (modeIds.length > 0) {
          resolvedVal = aliasedVar.valuesByMode[modeIds[0]];
        }
      }

      // If resolved value is also an alias, we need to resolve it recursively
      if (resolvedVal && typeof resolvedVal === 'object' && 'type' in resolvedVal && resolvedVal.type === 'VARIABLE_ALIAS') {
        // For now, just return the alias reference - deep resolution would be complex
        return {
          type: variable.resolvedType,
          value: variable.resolvedType === 'COLOR' ? { r: 0.5, g: 0.5, b: 0.5 } : 0,
          isAlias: true,
          aliasName: aliasedVar.name,
          aliasId: aliasedVar.id,
        };
      }

      return {
        type: variable.resolvedType,
        value: resolvedVal as RGB | RGBA | number | string | boolean,
        isAlias: true,
        aliasName: aliasedVar.name,
        aliasId: aliasedVar.id,
      };
    }
  }

  return {
    type: variable.resolvedType,
    value: value as RGB | RGBA | number | string | boolean,
    isAlias: false,
  };
}

// ============================================================================
// Component Builders
// ============================================================================

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

// Create dot grid pattern like OpenAI's approach
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

  // Add transparency pattern if color has alpha
  // Use dark pattern for light colors so transparency is visible
  if (hasAlpha(color as RGBA)) {
    const useDarkPattern = isLightColor(color);
    const pattern = createTransparencyPattern(size, useDarkPattern);
    container.appendChild(pattern);
    pattern.x = 0;
    pattern.y = 0;
  }

  // Add color rectangle
  const colorRect = figma.createRectangle();
  colorRect.name = 'Color';
  colorRect.resize(size, size);
  colorRect.cornerRadius = LAYOUT.borderRadius;
  colorRect.fills = [{
    type: 'SOLID',
    color: { r: color.r, g: color.g, b: color.b },
    opacity: hasAlpha(color as RGBA) ? (color as RGBA).a : 1,
  }];
  colorRect.strokes = [{ type: 'SOLID', color: COLORS.gray200 }];
  colorRect.strokeWeight = 1;
  container.appendChild(colorRect);
  colorRect.x = 0;
  colorRect.y = 0;

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

function createGroupHeader(groupName: string, totalWidth: number, visibility: ColumnVisibility): FrameNode {
  const row = figma.createFrame();
  row.name = `Group: ${groupName}`;
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.layoutSizingHorizontal = 'HUG';
  row.layoutSizingVertical = 'FIXED';
  row.resize(100, 96);
  row.fills = [{ type: 'SOLID', color: COLORS.gray50 }];
  row.paddingLeft = LAYOUT.cellPadding;
  row.paddingRight = LAYOUT.cellPadding;

  const textNode = figma.createText();
  textNode.characters = groupName || 'Ungrouped';
  textNode.fontSize = 40;
  textNode.fontName = FONT.familySemiBold;
  textNode.fills = [{ type: 'SOLID', color: COLORS.gray900 }];

  row.appendChild(textNode);
  return row;
}

function createSubGroupHeader(fullGroupPath: string, totalWidth: number, visibility: ColumnVisibility): FrameNode {
  const row = figma.createFrame();
  row.name = `Sub-Group: ${fullGroupPath}`;
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.layoutSizingHorizontal = 'HUG';
  row.layoutSizingVertical = 'FIXED';
  row.resize(100, 96);
  row.fills = [{ type: 'SOLID', color: COLORS.gray50 }];
  row.paddingLeft = LAYOUT.cellPadding;
  row.paddingRight = LAYOUT.cellPadding;

  const textNode = figma.createText();
  textNode.characters = fullGroupPath;
  textNode.fontSize = 40;
  textNode.fontName = FONT.familySemiBold;
  textNode.fills = [{ type: 'SOLID', color: COLORS.gray900 }];

  row.appendChild(textNode);
  return row;
}

async function createDataRow(
  variable: Variable,
  modes: { modeId: string; name: string }[],
  visibility: ColumnVisibility,
  totalWidth: number
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
  row.appendChild(createWrappingTextCell(getVariableBaseName(variable.name), LAYOUT.columnWidths.token, true));

  // Mode columns
  for (const mode of modes) {
    const resolvedValue = await resolveValue(variable, mode.modeId);
    const valueCell = createValueCell(resolvedValue, LAYOUT.columnWidths.mode, variable.scopes);
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

  // Create main table frame
  const table = figma.createFrame();
  table.name = `UI Kit: ${collection.name}`;
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
  table.strokes = [];
  table.strokeWeight = 0;
  table.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.19 },
    offset: { x: 0, y: 8 },
    radius: 16,
    spread: -4,
    visible: true,
    blendMode: 'NORMAL',
  }];

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

  // Calculate total table width (accounting for hidden columns)
  let totalWidth = LAYOUT.columnWidths.token + (modes.length * LAYOUT.columnWidths.mode);
  if (showDescription) totalWidth += LAYOUT.columnWidths.description;
  if (showScope) totalWidth += LAYOUT.columnWidths.scope;
  if (showTokenRef) totalWidth += LAYOUT.columnWidths.cssToken;

  // Add title with correct width
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
  titleText.characters = collection.name;
  titleText.fontSize = FONT.size.title;
  titleText.fontName = FONT.familyBold;
  titleText.fills = [{ type: 'SOLID', color: COLORS.black }];
  titleText.letterSpacing = { value: -1.44, unit: 'PIXELS' };
  titleText.lineHeight = { value: FONT.size.title, unit: 'PIXELS' };
  titleFrame.appendChild(titleText);

  table.appendChild(titleFrame);

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

  table.appendChild(contentFrame);

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
      const columnHeader = createGroupHeader(firstLevelName, totalWidth, visibility);
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
          const subHeader = createSubGroupHeader(fullGroupPath, totalWidth, visibility);
          column.appendChild(subHeader);
          subHeader.layoutSizingHorizontal = 'FILL';
        }

        // Add data rows
        for (const variable of subGroupVars) {
          const dataRow = await createDataRow(variable, modes, visibility, totalWidth);
          column.appendChild(dataRow);
          dataRow.layoutSizingHorizontal = 'FILL';
        }
      }
    } else {
      // No sub-groups, just add rows directly
      for (const variable of groupVariables) {
        const dataRow = await createDataRow(variable, modes, visibility, totalWidth);
        column.appendChild(dataRow);
        dataRow.layoutSizingHorizontal = 'FILL';
      }
    }

    contentFrame.appendChild(column);
  }

  return table;
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

  // Sort by: prefix (alphabetically), then size category, then weight (heaviest first)
  textStyles.sort((a, b) => {
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

  // Create main table frame with same styling as variable tables
  const table = figma.createFrame();
  table.name = 'UI Kit: text styles';
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
  titleText.characters = 'text styles';
  titleText.fontSize = FONT.size.title;
  titleText.fontName = FONT.familyBold;
  titleText.fills = [{ type: 'SOLID', color: COLORS.black }];
  titleText.letterSpacing = { value: -1.44, unit: 'PIXELS' };
  titleText.lineHeight = { value: FONT.size.title, unit: 'PIXELS' };
  titleFrame.appendChild(titleText);
  table.appendChild(titleFrame);

  // Add header row (styled like group headers in variable tables)
  const headerRow = figma.createFrame();
  headerRow.name = 'Header Row';
  headerRow.layoutMode = 'HORIZONTAL';
  headerRow.primaryAxisAlignItems = 'MIN';
  headerRow.counterAxisAlignItems = 'CENTER';
  headerRow.primaryAxisSizingMode = 'AUTO';
  headerRow.counterAxisSizingMode = 'FIXED';
  headerRow.resize(totalWidth, LAYOUT.rowHeight);
  headerRow.fills = [{ type: 'SOLID', color: COLORS.gray50 }];
  headerRow.paddingLeft = 16;
  headerRow.paddingRight = 16;

  const createHeaderCell = (text: string, width: number): FrameNode => {
    const cell = figma.createFrame();
    cell.name = `Header: ${text}`;
    cell.layoutMode = 'HORIZONTAL';
    cell.primaryAxisAlignItems = 'MIN';
    cell.counterAxisAlignItems = 'CENTER';
    cell.primaryAxisSizingMode = 'FIXED';
    cell.counterAxisSizingMode = 'AUTO';
    cell.resize(width, 24);
    cell.fills = [];

    const label = figma.createText();
    label.characters = text;
    label.fontSize = 16;
    label.fontName = FONT.familySemiBold;
    label.fills = [{ type: 'SOLID', color: COLORS.gray900 }];
    cell.appendChild(label);
    return cell;
  };

  headerRow.appendChild(createHeaderCell('Name', TYPO_COLUMNS.name));
  headerRow.appendChild(createHeaderCell('Size', TYPO_COLUMNS.size));
  headerRow.appendChild(createHeaderCell('Weight', TYPO_COLUMNS.weight));
  headerRow.appendChild(createHeaderCell('Tracking (px)', TYPO_COLUMNS.trackingPx));
  headerRow.appendChild(createHeaderCell('Tracking (em)', TYPO_COLUMNS.trackingEm));
  headerRow.appendChild(createHeaderCell('Line', TYPO_COLUMNS.line));
  headerRow.appendChild(createHeaderCell('Example', TYPO_COLUMNS.example));
  table.appendChild(headerRow);
  headerRow.layoutSizingHorizontal = 'FILL';

  // Sample paragraph for text normal styles with small font sizes
  const sampleParagraph = 'Typography is the silent art that shapes how we experience written language. Beyond mere letters, it orchestrates rhythm, hierarchy, and emotion, guiding the reader\'s eye and setting the tone before a single word is read. The beauty of typography lies in its subtlety: the careful balance of space and form, the harmony between font size and line height, and the way thoughtfully chosen type can make content feel effortless, inviting, and human.';

  // Helper to get example text based on style
  const getExampleText = (styleName: string, fontStyle: string, fontSize: number): string => {
    const nameLower = styleName.toLowerCase();
    const weightLower = fontStyle.toLowerCase();
    const isHeading = nameLower.includes('heading');
    const isNormalWeight = weightLower.includes('regular') || weightLower.includes('normal');

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
    const isNormalWeightCheck = weightLowerCheck.includes('regular') || weightLowerCheck.includes('normal');
    const willShowParagraph = !isHeadingCheck && isNormalWeightCheck && style.fontSize <= 18;

    // Create example text (auto width for non-paragraph, fixed width for paragraph)
    const exampleTextNode = figma.createText();
    exampleTextNode.characters = exampleText;
    exampleTextNode.fontSize = style.fontSize;
    exampleTextNode.fontName = style.fontName;
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

    // Example cell - rendered at actual font size (last column, auto width)
    const exampleCell = figma.createFrame();
    exampleCell.name = `Example: ${style.name}`;
    exampleCell.layoutMode = 'VERTICAL';
    exampleCell.primaryAxisAlignItems = 'CENTER';
    exampleCell.counterAxisAlignItems = 'MIN';
    exampleCell.itemSpacing = 8;
    exampleCell.layoutSizingHorizontal = 'HUG';
    exampleCell.layoutSizingVertical = 'FIXED';
    exampleCell.resize(100, rowHeight);
    exampleCell.paddingLeft = LAYOUT.cellPadding;
    exampleCell.paddingRight = LAYOUT.cellPadding;
    exampleCell.clipsContent = false;
    exampleCell.fills = [];

    // Check if this is a paragraph case - add title above paragraph
    const nameLower = style.name.toLowerCase();
    const weightLower = style.fontName.style.toLowerCase();
    const isHeading = nameLower.includes('heading');
    const isNormalWeight = weightLower.includes('regular') || weightLower.includes('normal');
    const showParagraph = !isHeading && isNormalWeight && style.fontSize <= 18;

    if (showParagraph) {
      // Add "Body text example" title above paragraph
      const titleTextNode = figma.createText();
      titleTextNode.characters = 'Body text example';
      titleTextNode.fontSize = style.fontSize;
      titleTextNode.fontName = style.fontName;
      titleTextNode.fills = [{ type: 'SOLID', color: COLORS.gray900 }];
      exampleCell.appendChild(titleTextNode);
    }

    exampleCell.appendChild(exampleTextNode);
    row.appendChild(exampleCell);

    table.appendChild(row);
  }

  return table;
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
  table.name = 'UI Kit: shadow';
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

    if (msg.type === 'generate-buttons') {
      await loadFonts();

      const targetColors = (msg as any).colors as string[] | undefined;
      try {
        await generateButtons(targetColors);
        // Note: color-complete messages are sent per color, buttons-complete is for backward compatibility
        figma.notify(targetColors ? `Generated ${targetColors.length} button set(s)` : 'All button sets generated');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        figma.notify(`Error: ${errorMessage}`, { error: true });
        figma.ui.postMessage({ type: 'buttons-error', message: errorMessage });
      }
    }

    if (msg.type === 'generate-icons') {
      try {
        const count = await updateIconComponents();
        figma.notify(`Updated ${count} icon component(s)`);
        figma.ui.postMessage({ type: 'icons-complete', count });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        figma.notify(`Error: ${errorMessage}`, { error: true });
        figma.ui.postMessage({ type: 'icons-error', message: errorMessage });
      }
    }

    if (msg.type === 'group-icons') {
      try {
        const count = await groupIconsByCategory();
        figma.notify(`Organized ${count} icon(s) into groups`);
        figma.ui.postMessage({ type: 'icons-complete', count });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        figma.notify(`Error: ${errorMessage}`, { error: true });
        figma.ui.postMessage({ type: 'icons-error', message: errorMessage });
      }
    }

    if (msg.type === 'generate-inputs') {
      await loadFonts();

      try {
        await generateInputs();
        figma.notify('Input component set generated');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        figma.notify(`Error: ${errorMessage}`, { error: true });
        figma.ui.postMessage({ type: 'inputs-error', message: errorMessage });
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    figma.notify(`Error: ${errorMessage}`, { error: true });
    figma.ui.postMessage({ type: 'buttons-error', message: errorMessage });
  }
};

// ============================================================================
// Button Component Generator
// ============================================================================

// Button sizing specifications - matching OpenAI Apps SDK UI documentation
// https://openai.github.io/apps-sdk-ui/?path=/docs/components-button--docs
// Variables: control/size/{size}, control/gutter/{size}, control/icon-size/{size}, button/gap/{size}
const BUTTON_SIZES = {
  // size: { height, paddingX, fontSize, iconSize, borderRadius, gap }
  '3xs': { height: 22, paddingX: 6, fontSize: 12, iconSize: 14, borderRadius: 6, gap: 3 },
  '2xs': { height: 24, paddingX: 8, fontSize: 12, iconSize: 16, borderRadius: 6, gap: 4 },
  'xs': { height: 26, paddingX: 8, fontSize: 14, iconSize: 16, borderRadius: 6, gap: 4 },
  'sm': { height: 28, paddingX: 10, fontSize: 14, iconSize: 18, borderRadius: 6, gap: 4 },
  'md': { height: 32, paddingX: 12, fontSize: 14, iconSize: 18, borderRadius: 8, gap: 6 },
  'lg': { height: 36, paddingX: 12, fontSize: 14, iconSize: 18, borderRadius: 8, gap: 6 },
  'xl': { height: 40, paddingX: 14, fontSize: 14, iconSize: 18, borderRadius: 10, gap: 6 },
  '2xl': { height: 44, paddingX: 14, fontSize: 16, iconSize: 20, borderRadius: 12, gap: 6 },
  '3xl': { height: 48, paddingX: 16, fontSize: 16, iconSize: 20, borderRadius: 12, gap: 6 },
};

// Variable name mappings for sizing (to bind Figma variables)
// Radius uses size-specific control/radius/* tokens (all sizes now in sizing.json)
const BUTTON_SIZE_VARS = {
  // Icon sizes are now directly mapped in sizing.json for each button size
  '3xs': { height: 'control/size/3xs', padding: 'control/gutter/3xs', iconSize: 'control/icon-size/3xs', gap: 'control/gap/3xs', radius: 'control/radius/3xs', fontSize: 'control/font-size/3xs' },
  '2xs': { height: 'control/size/2xs', padding: 'control/gutter/2xs', iconSize: 'control/icon-size/2xs', gap: 'control/gap/2xs', radius: 'control/radius/2xs', fontSize: 'control/font-size/2xs' },
  'xs': { height: 'control/size/xs', padding: 'control/gutter/xs', iconSize: 'control/icon-size/xs', gap: 'control/gap/xs', radius: 'control/radius/xs', fontSize: 'control/font-size/xs' },
  'sm': { height: 'control/size/sm', padding: 'control/gutter/sm', iconSize: 'control/icon-size/sm', gap: 'control/gap/sm', radius: 'control/radius/sm', fontSize: 'control/font-size/sm' },
  'md': { height: 'control/size/md', padding: 'control/gutter/md', iconSize: 'control/icon-size/md', gap: 'control/gap/md', radius: 'control/radius/md', fontSize: 'control/font-size/md' },
  'lg': { height: 'control/size/lg', padding: 'control/gutter/lg', iconSize: 'control/icon-size/lg', gap: 'control/gap/lg', radius: 'control/radius/lg', fontSize: 'control/font-size/lg' },
  'xl': { height: 'control/size/xl', padding: 'control/gutter/xl', iconSize: 'control/icon-size/xl', gap: 'control/gap/xl', radius: 'control/radius/xl', fontSize: 'control/font-size/xl' },
  '2xl': { height: 'control/size/2xl', padding: 'control/gutter/2xl', iconSize: 'control/icon-size/2xl', gap: 'control/gap/2xl', radius: 'control/radius/2xl', fontSize: 'control/font-size/2xl' },
  '3xl': { height: 'control/size/3xl', padding: 'control/gutter/3xl', iconSize: 'control/icon-size/3xl', gap: 'control/gap/3xl', radius: 'control/radius/3xl', fontSize: 'control/font-size/3xl' },
};

type ButtonSizeName = keyof typeof BUTTON_SIZES;
type IconMode = 'none' | 'start' | 'end' | 'both';

const BUTTON_STYLES = ['soft', 'solid', 'outline', 'ghost'] as const;
// Reversed size order: Largest to Smallest
const BUTTON_SIZE_ORDER: ButtonSizeName[] = ['3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs', '2xs', '3xs'];

// Removed 'inverse'
const BUTTON_COLOR_VARIANTS = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'discovery', 'caution'] as const;
const BUTTON_STATES = ['default', 'hover', 'active', 'disabled'] as const;
const ICON_MODES = ['none', 'start', 'end', 'both'] as const;

type ButtonStyle = typeof BUTTON_STYLES[number];
type ButtonColorVariant = typeof BUTTON_COLOR_VARIANTS[number];
type ButtonState = typeof BUTTON_STATES[number];

// Variable name mappings for each style/variant/state combination
function getButtonColorVarName(style: ButtonStyle, variant: ButtonColorVariant, state: ButtonState, property: 'bg' | 'text' | 'border'): string {
  // Handle disabled state first
  if (state === 'disabled') {
    if (property === 'bg') return 'background/disabled';
    if (property === 'text') return 'text/disabled';
    if (property === 'border') return 'border/disabled';
  }

  if (property === 'bg') {
    if (state === 'default') {
      return `background/${style}/${variant}`;
    } else {
      return `background/${style}/${state}/${variant}`;
    }
  } else if (property === 'text') {
    // Solid has its own text color (usually white/on-color)
    if (style === 'solid') {
      return `text/solid/${variant}`;
    }
    // Soft also has its own text color path
    if (style === 'soft') {
      return `text/soft/${variant}`;
    }
    // Outline has its own text color path
    if (style === 'outline') {
      return `text/outline/${variant}`;
    }
    // Ghost has its own text color path
    if (style === 'ghost') {
      return `text/ghost/${variant}`;
    }
    // Link and other styles use the variant color directly
    return `text/${variant}`;
  } else {
    // Border colors
    if (style === 'outline') {
      return `border/outline/${variant}`;
    }
    return `border/${style}/${variant}`;
  }
}

// Fallback colors for each style/variant
function getButtonFallbackColors(style: ButtonStyle, variant: ButtonColorVariant, state: ButtonState): { bg: RGB | RGBA | null; text: RGB | RGBA; border: RGB | RGBA | null } {
  // Simplified fallback colors - will be overridden by variables when available
  const colorMap: Record<ButtonColorVariant, RGB> = {
    primary: { r: 0.094, g: 0.094, b: 0.094 },
    secondary: { r: 0.365, g: 0.365, b: 0.365 },
    success: { r: 0.133, g: 0.545, b: 0.133 },
    info: { r: 0.0, g: 0.45, b: 0.9 },
    discovery: { r: 0.553, g: 0.055, b: 0.89 },
    danger: { r: 0.937, g: 0.267, b: 0.267 },
    warning: { r: 1, g: 0.6, b: 0 },
    caution: { r: 0.85, g: 0.65, b: 0 },
  };

  const baseColor = colorMap[variant];

  switch (style) {
    case 'solid':
      return {
        bg: baseColor,
        text: { r: 1, g: 1, b: 1 },
        border: null,
      };
    case 'soft':
      return {
        // Use 15% opacity for soft background if variable is missing
        bg: { r: baseColor.r, g: baseColor.g, b: baseColor.b, a: 0.15 },
        text: baseColor,
        border: null,
      };
    case 'ghost':
      return {
        bg: null,
        text: baseColor,
        border: null,
      };
    case 'outline':
      return {
        bg: null,
        text: baseColor,
        border: baseColor,
      };
  }

  // Default fallback (should not be reached if styles match)
  return {
    bg: baseColor,
    text: { r: 1, g: 1, b: 1 },
    border: null,
  };
}

// ============================================================================
// Input Component Generator
// ============================================================================

// Input sizing specifications - uses same sizes as Button
// Variables: control/size/{size}, control/gutter/{size}, control/font-size/{size} (for icon size)
const INPUT_SIZES = {
  // size: { height, paddingX, fontSize, borderRadius, gap }
  // Note: iconSize uses fontSize (1em in CSS)
  '3xs': { height: 22, paddingX: 6, fontSize: 12, borderRadius: 6, gap: 3 },
  '2xs': { height: 24, paddingX: 8, fontSize: 12, borderRadius: 6, gap: 4 },
  'xs': { height: 26, paddingX: 8, fontSize: 14, borderRadius: 6, gap: 4 },
  'sm': { height: 28, paddingX: 10, fontSize: 14, borderRadius: 6, gap: 4 },
  'md': { height: 32, paddingX: 12, fontSize: 14, borderRadius: 8, gap: 6 },
  'lg': { height: 36, paddingX: 12, fontSize: 14, borderRadius: 8, gap: 6 },
  'xl': { height: 40, paddingX: 14, fontSize: 14, borderRadius: 10, gap: 6 },
  '2xl': { height: 44, paddingX: 14, fontSize: 16, borderRadius: 12, gap: 6 },
  '3xl': { height: 48, paddingX: 16, fontSize: 16, borderRadius: 12, gap: 6 },
};

// Variable name mappings for sizing (to bind Figma variables)
const INPUT_SIZE_VARS = {
  // Icon size uses fontSize variable (1em in CSS = fontSize)
  '3xs': { height: 'control/size/3xs', padding: 'control/gutter/3xs', fontSize: 'control/font-size/3xs', gap: 'control/gap/3xs', radius: 'control/radius/3xs' },
  '2xs': { height: 'control/size/2xs', padding: 'control/gutter/2xs', fontSize: 'control/font-size/2xs', gap: 'control/gap/2xs', radius: 'control/radius/2xs' },
  'xs': { height: 'control/size/xs', padding: 'control/gutter/xs', fontSize: 'control/font-size/xs', gap: 'control/gap/xs', radius: 'control/radius/xs' },
  'sm': { height: 'control/size/sm', padding: 'control/gutter/sm', fontSize: 'control/font-size/sm', gap: 'control/gap/sm', radius: 'control/radius/sm' },
  'md': { height: 'control/size/md', padding: 'control/gutter/md', fontSize: 'control/font-size/md', gap: 'control/gap/md', radius: 'control/radius/md' },
  'lg': { height: 'control/size/lg', padding: 'control/gutter/lg', fontSize: 'control/font-size/lg', gap: 'control/gap/lg', radius: 'control/radius/lg' },
  'xl': { height: 'control/size/xl', padding: 'control/gutter/xl', fontSize: 'control/font-size/xl', gap: 'control/gap/xl', radius: 'control/radius/xl' },
  '2xl': { height: 'control/size/2xl', padding: 'control/gutter/2xl', fontSize: 'control/font-size/2xl', gap: 'control/gap/2xl', radius: 'control/radius/2xl' },
  '3xl': { height: 'control/size/3xl', padding: 'control/gutter/3xl', fontSize: 'control/font-size/3xl', gap: 'control/gap/3xl', radius: 'control/radius/3xl' },
};

type InputSizeName = keyof typeof INPUT_SIZES;

const INPUT_STYLES = ['outline', 'soft'] as const;
// Reversed size order: Largest to Smallest (same as Button)
const INPUT_SIZE_ORDER: InputSizeName[] = ['3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs', '2xs', '3xs'];

const INPUT_STATES = ['default', 'hover', 'focus', 'disabled', 'invalid'] as const;

type InputStyle = typeof INPUT_STYLES[number];
type InputState = typeof INPUT_STATES[number];

// Variable name mappings for each style/state combination
function getInputColorVarName(style: InputStyle, state: InputState, property: 'bg' | 'text' | 'border'): string | null {
  // Handle disabled state first
  if (state === 'disabled') {
    if (property === 'bg') return 'background/disabled';
    if (property === 'text') return 'text/disabled';
    if (property === 'border') return 'border/disabled';
  }

  // Handle invalid state
  if (state === 'invalid') {
    if (property === 'border') return 'component/input/border/invalid';
    // Text and bg use default for invalid
  }

  // Border colors
  if (property === 'border') {
    if (style === 'outline') {
      if (state === 'hover') return 'component/input/border/outline/hover';
      if (state === 'focus') return 'component/input/border/outline/focus';
      // For default state
      return 'component/input/border/outline/default';
    } else if (style === 'soft') {
      // Soft style: focus has border, default and hover have no border
      // Invalid state uses component/input/border/invalid (handled above)
      if (state === 'focus') return 'component/input/border/soft/focus';
      if (state === 'invalid') return 'component/input/border/invalid';
      // For default and hover, return null (no border)
      return null;
    }
    // Fallback (should not happen)
    return null;
  }

  // Background colors
  if (property === 'bg') {
    if (style === 'outline') return null; // Transparent for outline
    if (style === 'soft') return 'component/input/background/soft/default'; // Soft style background
    return null;
  }

  // Text colors - not used directly, handled separately in createStyledInput
  if (property === 'text') {
    return null;
  }

  return null;
}

// Fallback colors for each style/state
function getInputFallbackColors(style: InputStyle, state: InputState): { bg: RGB | RGBA | null; text: RGB | RGBA; border: RGB | RGBA | null } {
  const defaultText = { r: 0.051, g: 0.051, b: 0.051 }; // gray.1000 (#0d0d0d)
  const disabledText = { r: 0.557, g: 0.557, b: 0.557 }; // gray.400 (#8e8e8e)
  const outlineDefaultBorder = { r: 0, g: 0, b: 0, a: 0.1 }; // alpha.10 (border/outline/primary)
  const outlineHoverBorder = { r: 0, g: 0, b: 0, a: 0.25 }; // alpha.25
  const outlineFocusBorder = { r: 0, g: 0, b: 0, a: 0.5 }; // alpha.50
  const softFocusBorder = { r: 0, g: 0, b: 0, a: 0.2 }; // alpha.20
  const invalidBorder = { r: 0.937, g: 0.267, b: 0.267 }; // red.500
  const disabledBorder = { r: 0, g: 0, b: 0, a: 0.06 }; // alpha.6
  const disabledBg = { r: 0, g: 0, b: 0, a: 0.05 }; // alpha.5
  const softBg = { r: 0, g: 0, b: 0, a: 0.08 }; // alpha.8 (background/soft/alpha/primary)

  // Disabled state - same for both styles
  if (state === 'disabled') {
    return {
      bg: disabledBg,
      text: disabledText,
      border: disabledBorder,
    };
  }

  // Invalid state - border is red for both styles
  if (state === 'invalid') {
    return {
      bg: style === 'soft' ? softBg : null,
      text: defaultText,
      border: invalidBorder,
    };
  }

  // Outline style states
  if (style === 'outline') {
    if (state === 'hover') {
      return {
        bg: null,
        text: defaultText,
        border: outlineHoverBorder,
      };
    }
    if (state === 'focus') {
      return {
        bg: null,
        text: defaultText,
        border: outlineFocusBorder,
      };
    }
    // default state
    return {
      bg: null,
      text: defaultText,
      border: outlineDefaultBorder,
    };
  }

  // Soft style states
  if (style === 'soft') {
    if (state === 'focus') {
      return {
        bg: softBg,
        text: defaultText,
        border: softFocusBorder,
      };
    }
    // default and hover - no border for soft style
    return {
      bg: softBg,
      text: defaultText,
      border: null,
    };
  }

  // Fallback (should not happen)
  return {
    bg: null,
    text: defaultText,
    border: null,
  };
}

// Icon component node IDs from the Figma library (placeholder - to be replaced with actual IDs)
const INPUT_ICON_NODE_IDS = {
  startAdornment: '6011:127065', // Placeholder - same as button left icon for now
  endAdornment: '6011:126766', // Placeholder - same as button right icon for now
};

// Cache for variables lookup
let variablesCache: Variable[] | null = null;

async function getVariableByName(name: string): Promise<Variable | null> {
  if (!variablesCache) {
    variablesCache = await figma.variables.getLocalVariablesAsync();
  }

  // Try exact match first
  let found = variablesCache.find(v => v.name === name);
  if (found) {
    console.log(`Found variable by exact match: ${name} (scopes: ${found.scopes.join(', ')})`);
    return found;
  }

  // Try with slashes replaced by dots (some legacy formats)
  const dotName = name.replace(/\//g, '.');
  found = variablesCache.find(v => v.name === dotName);
  if (found) {
    console.log(`Found variable by dot format: ${name} -> ${dotName} (scopes: ${found.scopes.join(', ')})`);
    return found;
  }

  // Try partial match (ends with the path) - but only if it's a valid path segment
  // This prevents finding text/primary when searching for text/soft/primary
  // Only match if the variable name ends with the exact path we're looking for
  found = variablesCache.find(v => {
    // Must end with the exact name or with a slash followed by the name
    const endsWithExact = v.name === name || v.name.endsWith('/' + name);
    if (!endsWithExact) return false;

    // For paths with multiple segments (like text/soft/primary), ensure we don't match
    // shorter paths (like text/primary) by checking the segment count
    const nameSegments = name.split('/').length;
    const varSegments = v.name.split('/').length;

    // Only match if segment counts are equal or variable has more segments
    // This prevents text/primary from matching text/soft/primary
    if (varSegments < nameSegments) return false;

    // CRITICAL: If the search path starts with 'component/', only match variables that also start with 'component/'
    // This prevents finding 'border/default' when searching for 'component/input/border/outline/default'
    if (name.startsWith('component/') && !v.name.startsWith('component/')) {
      return false;
    }

    return true;
  });
  if (found) {
    console.log(`Found variable by partial match: ${name} -> ${found.name} (scopes: ${found.scopes.join(', ')})`);
    return found;
  }

  // Log available variables for debugging if not found
  if (name.includes('soft') || name.includes('primary') || name.includes('secondary')) {
    const matchingVars = variablesCache.filter(v =>
      v.resolvedType === 'COLOR' &&
      (v.name.includes('soft') || v.name.includes('primary') || v.name.includes('secondary'))
    ).map(v => `${v.name} (${v.scopes.join(', ')})`).slice(0, 30);
    console.log(`Variable not found: ${name}`);
    console.log(`Available matching color variables:`, matchingVars);
  }

  return null;
}

async function bindVariableToFill(node: FrameNode | ComponentNode | RectangleNode, varName: string): Promise<boolean> {
  const variable = await getVariableByName(varName);
  if (variable && variable.resolvedType === 'COLOR') {
    try {
      // Create a base solid paint
      const basePaint: SolidPaint = {
        type: 'SOLID',
        color: { r: 0.5, g: 0.5, b: 0.5 }, // placeholder color
      };
      // Use the official API to bind the variable
      const boundPaint = figma.variables.setBoundVariableForPaint(basePaint, 'color', variable);
      node.fills = [boundPaint];
      return true;
    } catch (e) {
      // Variable binding might fail for various reasons
      console.log('Failed to bind fill variable:', varName, e);
    }
  }
  return false;
}

async function bindVariableToStroke(node: FrameNode | ComponentNode | RectangleNode, varName: string): Promise<boolean> {
  const variable = await getVariableByName(varName);
  if (variable && variable.resolvedType === 'COLOR') {
    try {
      // Create a base solid paint
      const basePaint: SolidPaint = {
        type: 'SOLID',
        color: { r: 0.5, g: 0.5, b: 0.5 },
      };
      // Use the official API to bind the variable
      const boundPaint = figma.variables.setBoundVariableForPaint(basePaint, 'color', variable);
      node.strokes = [boundPaint];
      return true;
    } catch (e) {
      // Variable binding might fail
      console.log('Failed to bind stroke variable:', varName, e);
    }
  }
  return false;
}

async function bindVariableToTextFill(node: TextNode, varName: string): Promise<boolean> {
  const variable = await getVariableByName(varName);
  if (!variable || variable.resolvedType !== 'COLOR') return false;

  try {
    const basePaint: SolidPaint = {
      type: 'SOLID',
      color: { r: 0.5, g: 0.5, b: 0.5 },
    };
    const boundPaint = figma.variables.setBoundVariableForPaint(basePaint, 'color', variable);
    node.fills = [boundPaint];
    return true;
  } catch (e) {
    return false;
  }
}

// Bind a FLOAT variable to a node property (width, height, etc.)
async function bindVariableToProperty(node: SceneNode, property: 'width' | 'height' | 'paddingLeft' | 'paddingRight' | 'itemSpacing' | 'cornerRadius' | 'fontSize', varName: string): Promise<boolean> {
  const variable = await getVariableByName(varName);
  if (variable && variable.resolvedType === 'FLOAT') {
    try {
      if (property === 'fontSize' && node.type === 'TEXT') {
        node.setBoundVariable('fontSize', variable);
      } else {
        (node as any).setBoundVariable(property, variable);
      }
      return true;
    } catch (e) {
      console.log(`Failed to bind ${property} variable:`, varName, e);
    }
  }
  return false;
}

// Bind color variable to an instance node (for icons) - recursively targets children with fills
async function bindColorToInstance(instance: InstanceNode | FrameNode, varName: string): Promise<boolean> {
  const variable = await getVariableByName(varName);
  if (!variable || variable.resolvedType !== 'COLOR') return false;

  try {
    const basePaint: SolidPaint = {
      type: 'SOLID',
      color: { r: 0.5, g: 0.5, b: 0.5 },
    };
    const boundPaint = figma.variables.setBoundVariableForPaint(basePaint, 'color', variable);

    // Recursively apply to all vector children
    const applyToChildren = (node: SceneNode) => {
      if (!node.visible) return;

      if (
        'fills' in node &&
        (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'STAR' || node.type === 'LINE' || node.type === 'ELLIPSE' || node.type === 'RECTANGLE' || node.type === 'TEXT')
      ) {
        const hasVisibleFills = Array.isArray(node.fills) && node.fills.some(fill => fill.visible !== false);

        if (hasVisibleFills) {
          node.fills = [];
          node.fills = [boundPaint];
        }

        if ('strokes' in node && node.strokes.length > 0) {
          const boundStroke = figma.variables.setBoundVariableForPaint(basePaint, 'color', variable);
          node.strokes = [boundStroke];
        }
      }

      if ('children' in node) {
        (node as any).children.forEach(applyToChildren);
      }
    };

    if ('children' in instance) {
      instance.children.forEach(applyToChildren);
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Find and apply a text style by name or size-based pattern
async function applyTextStyle(node: TextNode, size: string): Promise<boolean> {
  try {
    const styles = await figma.getLocalTextStylesAsync();
    const lowerSize = size.toLowerCase();

    // Translation map: Button Size -> Text Style Size
    // Based on actual font sizes: xs=12px, sm=14px, md=16px, lg=18px
    // Button font sizes from sizing.json: 3xs/2xs=12px, xs/sm/md/lg/xl=14px, 2xl/3xl=16px
    const sizeShiftMap: Record<string, string> = {
      '3xs': 'xs',  // 12px → xs (12px)
      '2xs': 'xs',  // 12px → xs (12px)
      'xs': 'sm',   // 14px → sm (14px)
      'sm': 'sm',   // 14px → sm (14px)
      'md': 'sm',   // 14px → sm (14px)
      'lg': 'sm',   // 14px → sm (14px)
      'xl': 'sm',   // 14px → sm (14px)
      '2xl': 'md',  // 16px → md (16px)
      '3xl': 'md'   // 16px → md (16px)
    };

    const textStyleSize = sizeShiftMap[lowerSize] || lowerSize;

    // We target "text/{size}/medium" as the standard for buttons
    // Patterns to try in order:
    const targetPatterns = [
      // Standard patterns
      `text/${textStyleSize}/medium`,
      `text/${textStyleSize}/semibold`,
      `text/${textStyleSize}/bold`,
      `text/${textStyleSize}/normal`,
      `text/${textStyleSize}/regular`,

      // Direct size patterns (without shifting)
      `text/${lowerSize}/medium`,
      `text/${lowerSize}/semibold`,

      // Short patterns
      `${textStyleSize}/medium`,
      `${textStyleSize}/semibold`,
      `text/${textStyleSize}`,

      // Button specific patterns (commonly used)
      `button/${textStyleSize}`,
      `btn/${textStyleSize}`,
      `button/${lowerSize}`,
      `btn/${lowerSize}`,

      // Simple size fallback
      `${textStyleSize}`,
      `${lowerSize}`
    ];

    let style: TextStyle | undefined = undefined;
    for (const pattern of targetPatterns) {
      style = styles.find(s => s.name.toLowerCase() === pattern);
      if (style) break;
    }

    // fallback: find any style that contains the shifted size and "text"
    if (!style) {
      style = styles.find(s => {
        const name = s.name.toLowerCase();
        return name.includes('text') && name.includes(textStyleSize);
      });
    }

    if (style) {
      await node.setTextStyleIdAsync(style.id);
      console.log(`Applied text style: ${style.name}`);
      return true;
    }
    console.log(`No matching text style found for size: ${size}`);
  } catch (e) {
    console.log('Failed to apply text style for size:', size, e);
  }
  return false;
}

// Find and apply a text style for Input components (uses normal/regular weight - font-weight: 400)
async function applyInputTextStyle(node: TextNode, size: string): Promise<boolean> {
  try {
    const styles = await figma.getLocalTextStylesAsync();
    const lowerSize = size.toLowerCase();

    // Translation map: Control Size -> Text Style Size
    // Based on control/font-size from sizing.json:
    // 3xs, 2xs = 12px → text/xs (12/18)
    // xs, sm, md, lg, xl = 14px → text/sm (14/20)
    // 2xl, 3xl = 16px → text/md (16/24)
    const sizeMap: Record<string, string> = {
      '3xs': 'xs',  // 12px → xs (12/18)
      '2xs': 'xs',  // 12px → xs (12/18)
      'xs': 'sm',   // 14px → sm (14/20)
      'sm': 'sm',   // 14px → sm (14/20)
      'md': 'sm',   // 14px → sm (14/20)
      'lg': 'sm',   // 14px → sm (14/20)
      'xl': 'sm',   // 14px → sm (14/20)
      '2xl': 'md',  // 16px → md (16/24)
      '3xl': 'md'   // 16px → md (16/24)
    };

    const textStyleSize = sizeMap[lowerSize] || lowerSize;

    // For Input: prefer normal/regular weight (font-weight: 400)
    const targetPatterns = [
      `text/${textStyleSize}/normal`,
      `text/${textStyleSize}/regular`,
      `text/${textStyleSize}`,
      `${textStyleSize}/normal`,
      `${textStyleSize}/regular`,
    ];

    let style: TextStyle | undefined = undefined;
    for (const pattern of targetPatterns) {
      style = styles.find(s => s.name.toLowerCase() === pattern);
      if (style) break;
    }

    // fallback: find any style with the right size and "normal" or "regular"
    if (!style) {
      style = styles.find(s => {
        const name = s.name.toLowerCase();
        return name.includes(textStyleSize) && (name.includes('normal') || name.includes('regular'));
      });
    }

    if (style) {
      await node.setTextStyleIdAsync(style.id);
      console.log(`Applied input text style: ${style.name}`);
      return true;
    }
    console.log(`No matching input text style found for size: ${size}`);
  } catch (e) {
    console.log('Failed to apply input text style for size:', size, e);
  }
  return false;
}

async function generateButtons(targetColors?: string[]): Promise<void> {
  // Reset variables cache for fresh lookup
  variablesCache = null;

  let y = 0;
  const GAP_BETWEEN_SETS = 200;
  const GAP_WITHIN_SET = 50;

  // If specific colors are requested, filter the colors list. Otherwise use all.
  const colorsToGenerate = targetColors && targetColors.length > 0
    ? BUTTON_COLOR_VARIANTS.filter(c => targetColors.some(tc => tc.trim().toLowerCase() === c.toLowerCase()))
    : BUTTON_COLOR_VARIANTS;

  if (colorsToGenerate.length === 0) {
    console.warn(`No valid colors found in request: ${JSON.stringify(targetColors)}`);
    return;
  }

  // Fixed values for IconMode (pill is now a variant property, not fixed)
  const iconMode: IconMode = 'both';

  // Calculate total components: styles × states × sizes × 3 (regular + 2 icon-only variants) × 2 (pill variants)
  const componentsPerColor = BUTTON_STYLES.length * BUTTON_STATES.length * BUTTON_SIZE_ORDER.length * 3 * 2;
  const totalComponentsAll = componentsPerColor * colorsToGenerate.length;

  let totalCreatedComponents = 0;

  // Loop for each color to create a SEPARATE component set
  for (const color of colorsToGenerate) {
    const colorComponents: ComponentNode[] = [];
    let x = 0;
    let localY = 0;

    let currentComponentIndexForColor = 0;

    // For each style
    for (const style of BUTTON_STYLES) {
      // For each state
      for (const state of BUTTON_STATES) {
        // For each size
        for (const size of BUTTON_SIZE_ORDER) {
          // Generate variants with pill=true first (default), then pill=false
          for (const pillValue of [true, false]) {
            // Regular button (not icon-only), pill=true first
            const component = await createStyledButton(style, color, state, size, pillValue, iconMode, false, false);
            component.x = x;
            component.y = localY;
            x += component.width + GAP_WITHIN_SET;
            colorComponents.push(component);
            currentComponentIndexForColor++;
            totalCreatedComponents++;

            // Icon-only variant with uniform=false
            const componentIconOnlyUniformFalse = await createStyledButton(style, color, state, size, pillValue, iconMode, true, false);
            componentIconOnlyUniformFalse.x = x;
            componentIconOnlyUniformFalse.y = localY;
            x += componentIconOnlyUniformFalse.width + GAP_WITHIN_SET;
            colorComponents.push(componentIconOnlyUniformFalse);
            currentComponentIndexForColor++;
            totalCreatedComponents++;

            // Icon-only variant with uniform=true
            const componentIconOnlyUniformTrue = await createStyledButton(style, color, state, size, pillValue, iconMode, true, true);
            componentIconOnlyUniformTrue.x = x;
            componentIconOnlyUniformTrue.y = localY;
            x += componentIconOnlyUniformTrue.width + GAP_WITHIN_SET;
            colorComponents.push(componentIconOnlyUniformTrue);
            currentComponentIndexForColor++;
            totalCreatedComponents++;
          }

          // Send progress update after all 6 variants (3 × 2 pill variants) for this size are created
          // Use setTimeout to allow UI to process previous messages
          await new Promise(resolve => setTimeout(resolve, 0));
          figma.ui.postMessage({
            type: 'progress-update',
            color: color,
            style: style,
            state: state,
            size: size,
            currentForColor: currentComponentIndexForColor,
            totalForColor: componentsPerColor,
            currentTotal: totalCreatedComponents,
            totalAll: totalComponentsAll
          });
        }
        // New row for each state/style combo within the set
        x = 0;
        localY += 100; // rough vertical spacing for pre-combined items
      }
    }

    // Log component count for debugging
    console.log(`[${color}] Total components to combine: ${colorComponents.length}, expected: ${componentsPerColor}`);

    // Verify we have the expected number of components
    if (colorComponents.length !== componentsPerColor) {
      console.warn(`[${color}] Component count mismatch! Expected ${componentsPerColor}, got ${colorComponents.length}`);
      // Log component names to debug
      colorComponents.forEach((comp, idx) => {
        console.log(`  [${idx}] ${comp.name}`);
      });
    }

    // Send progress update before combining variants (this can be slow)
    figma.ui.postMessage({
      type: 'progress-update',
      color: color,
      style: 'combining',
      state: 'variants',
      size: '',
      currentForColor: currentComponentIndexForColor,
      totalForColor: componentsPerColor,
      currentTotal: totalCreatedComponents,
      totalAll: totalComponentsAll
    });

    // Create the component set for THIS color
    // Note: combineAsVariants can be slow with many components, so we send progress update before
    let componentSet: ComponentSetNode;
    try {
      componentSet = figma.combineAsVariants(colorComponents, figma.currentPage);
      componentSet.name = color.toLowerCase(); // Name the set "primary", "secondary", etc.

      // Log the number of variants in the set
      console.log(`[${color}] Component set created with ${componentSet.children.length} variants`);

      // Verify icon-only variants are present
      const iconOnlyVariants = componentSet.children.filter(child => {
        if (child.type === 'COMPONENT') {
          return child.name.includes('iconOnly=true');
        }
        return false;
      });
      console.log(`[${color}] Icon-only variants in set: ${iconOnlyVariants.length}, expected: ${BUTTON_STYLES.length * BUTTON_STATES.length * BUTTON_SIZE_ORDER.length * 2 * 2}`);

      // Position the SET itself
      componentSet.y = y;

      // Move Y down for the next set
      y += componentSet.height + GAP_BETWEEN_SETS;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${color}] Error combining variants: ${errorMessage}`);
      figma.notify(`Error combining variants for ${color}: ${errorMessage}`, { error: true });
      figma.ui.postMessage({ type: 'buttons-error', message: `Error combining variants for ${color}: ${errorMessage}` });
      // Continue to next color even if one fails
      continue;
    }

    // Position the SET itself
    componentSet.y = y;

    // Move Y down for the next set
    y += componentSet.height + GAP_BETWEEN_SETS;

    // Send message that this color is complete
    figma.ui.postMessage({
      type: 'color-complete',
      color: color,
      currentTotal: totalCreatedComponents,
      totalAll: totalComponentsAll
    });
  }
}

// function createButtonStyleSection removed

async function createStyledButton(
  style: ButtonStyle,
  colorVariant: ButtonColorVariant,
  state: ButtonState,
  size: ButtonSizeName,
  pill: boolean,
  iconMode: IconMode,
  iconOnly: boolean = false,
  uniform: boolean = false
): Promise<ComponentNode> {
  const config = BUTTON_SIZES[size];
  const colors = getButtonFallbackColors(style, colorVariant, state);

  // Create as component
  const button = figma.createComponent();
  // Name using Property=Value syntax
  // Note: Property KEYS are lowercase as per design system convention.
  // All components must have the same property structure for variants to work correctly
  // Color is not included because it's already defined by the component set name
  let nameParts = [`style=${style}`, `state=${state}`, `size=${size}`];
  // Always include iconOnly and uniform properties for consistent variant structure
  nameParts.push(`iconOnly=${iconOnly}`);
  if (iconOnly) {
    nameParts.push(`uniform=${uniform}`);
  } else {
    // For non-icon-only buttons, uniform is not applicable, but we can set it to false for consistency
    nameParts.push('uniform=false');
  }
  // Add pill property (pill=true is the default/first value)
  nameParts.push(`pill=${pill}`);
  button.name = nameParts.join(', ');

  button.layoutMode = 'HORIZONTAL';
  button.primaryAxisAlignItems = 'CENTER';
  button.counterAxisAlignItems = 'CENTER';
  button.primaryAxisSizingMode = 'AUTO';
  button.counterAxisSizingMode = 'FIXED';

  // For icon-only buttons: uniform=true means square (width = height), uniform=false means use normal padding
  if (iconOnly && uniform) {
    button.layoutSizingHorizontal = 'FIXED';
    button.resize(config.height, config.height);
  }

  // Padding
  // OpenAI Apps SDK UI uses a 1.33x multiplier for padding when pill={true}
  // For icon-only: uniform=true means padding=0 (square), uniform=false means use normal padding
  const paddingX = iconOnly
    ? (uniform ? 0 : config.paddingX)
    : (pill ? Math.round(config.paddingX * 1.33) : config.paddingX);
  // Set fallback padding values (will be overridden by variable binding if successful)
  button.paddingLeft = paddingX;
  button.paddingRight = paddingX;
  button.itemSpacing = config.gap;

  // Border radius
  // For pill=true, use 9999 (full radius). For pill=false, use config.borderRadius
  button.cornerRadius = pill ? 9999 : config.borderRadius;

  // Try to bind background variable
  const bgVarName = getButtonColorVarName(style, colorVariant, state, 'bg');
  const bgBound = await bindVariableToFill(button, bgVarName);
  if (!bgBound) {
    if (colors.bg) {
      const alpha = (colors.bg as RGBA).a !== undefined ? (colors.bg as RGBA).a : 1;
      button.fills = [{
        type: 'SOLID',
        color: { r: colors.bg.r, g: colors.bg.g, b: colors.bg.b },
        opacity: alpha
      }];
    } else {
      button.fills = [];
    }
  }

  // Border for outline style
  if (style === 'outline') {
    const borderVarName = getButtonColorVarName(style, colorVariant, state, 'border');
    const borderBound = await bindVariableToStroke(button, borderVarName);
    if (!borderBound && colors.border) {
      button.strokes = [{ type: 'SOLID', color: colors.border }];
    }
    button.strokeWeight = 1;
  }

  // Bind sizing properties to the button frame
  const sizeVars = BUTTON_SIZE_VARS[size];
  await bindVariableToProperty(button, 'height', sizeVars.height);
  if (iconOnly) {
    if (uniform) {
      // For uniform icon-only, bind width to the same height variable to keep it square
      await bindVariableToProperty(button, 'width', sizeVars.height);
    } else {
      // For non-uniform icon-only, bind padding from variables (same as regular buttons)
      await bindVariableToProperty(button, 'paddingLeft', sizeVars.padding);
      await bindVariableToProperty(button, 'paddingRight', sizeVars.padding);
    }
  } else {
    await bindVariableToProperty(button, 'paddingLeft', sizeVars.padding);
    await bindVariableToProperty(button, 'paddingRight', sizeVars.padding);
  }
  await bindVariableToProperty(button, 'itemSpacing', sizeVars.gap);
  if (!pill) {
    await bindVariableToProperty(button, 'cornerRadius', sizeVars.radius);
  }

  // Get variable names for icons and text
  const textVarName = getButtonColorVarName(style, colorVariant, state, 'text');
  const iconSizeVarName = sizeVars.iconSize;
  console.log(`Button ${style}/${colorVariant}/${state}: Looking for text variable: ${textVarName}`);

  // Icon left
  // For icon-only buttons, always add icon. For regular buttons, respect iconMode.
  if (iconOnly || iconMode === 'start' || iconMode === 'both') {
    // Use specific icon for icon-only buttons, otherwise use left icon
    const iconNodeId = iconOnly ? ICON_NODE_IDS.iconOnly : ICON_NODE_IDS.left;
    const iconLeft = await createIconInstance(iconNodeId, config.iconSize, textVarName, iconSizeVarName);
    iconLeft.name = iconOnly ? 'icon' : 'left icon'; // Lowercase name
    button.appendChild(iconLeft);
  }

  if (!iconOnly) {
    // Text
    const label = figma.createText();
    label.name = 'label'; // Lowercase name
    label.characters = 'Button';

    // Apply text style - this is the primary source for font family, size, etc.
    const styleApplied = await applyTextStyle(label, size);

    // Also try to bind font size variable explicitly
    await bindVariableToProperty(label, 'fontSize', sizeVars.fontSize);

    if (!styleApplied) {
      console.log(`No text style found for size: ${size} - using fallback font settings`);
      label.fontSize = config.fontSize;
      label.fontName = FONT.familyMedium;
      label.letterSpacing = { value: -0.14, unit: 'PIXELS' };
      // Set line-height to match font-size (1:1 ratio)
      label.lineHeight = { value: config.fontSize, unit: 'PIXELS' };
    }

    // Try to bind text color variable
    console.log(`Attempting to bind text variable: ${textVarName}`);
    const textBound = await bindVariableToTextFill(label, textVarName);
    if (!textBound) {
      console.log(`Failed to bind text variable ${textVarName}, using fallback color`);
      label.fills = [{ type: 'SOLID', color: colors.text }];
    } else {
      // Verify the variable is actually bound
      const fills = label.fills;
      if (Array.isArray(fills) && fills.length > 0) {
        const fill = fills[0];
        if (fill.type === 'SOLID' && 'boundVariable' in fill && fill.boundVariable) {
          console.log(`Text variable ${textVarName} successfully bound`);
        } else {
          console.log(`Warning: Text variable ${textVarName} binding may have failed - fill type:`, fill.type);
        }
      }
    }
    button.appendChild(label);
  }

  // Icon right
  if (!iconOnly && (iconMode === 'end' || iconMode === 'both')) {
    const iconRight = await createIconInstance(ICON_NODE_IDS.right, config.iconSize, textVarName, iconSizeVarName);
    iconRight.name = 'right icon';
    button.appendChild(iconRight);
  }

  return button;
}

async function createStyledInput(
  style: InputStyle,
  state: InputState,
  size: InputSizeName,
  startAdornment: boolean,
  endAdornment: boolean
): Promise<ComponentNode> {
  const config = INPUT_SIZES[size];
  const colors = getInputFallbackColors(style, state);

  // Create as component
  const input = figma.createComponent();
  // Name using Property=Value syntax (no adornment props - they're always visible, user toggles them)
  input.name = `style=${style}, state=${state}, size=${size}`;

  input.layoutMode = 'HORIZONTAL';
  input.primaryAxisAlignItems = 'CENTER';
  input.counterAxisAlignItems = 'CENTER';
  input.primaryAxisSizingMode = 'AUTO';
  input.counterAxisSizingMode = 'FIXED';

  // Set fallback padding values (will be overridden by variable binding if successful)
  input.paddingLeft = config.paddingX;
  input.paddingRight = config.paddingX;
  input.itemSpacing = config.gap;

  // Border radius - Input always uses border radius from config (no pill option)
  input.cornerRadius = config.borderRadius;

  // Try to bind background variable
  const bgVarName = getInputColorVarName(style, state, 'bg');
  if (bgVarName) {
    const bgBound = await bindVariableToFill(input, bgVarName);
    if (!bgBound && colors.bg) {
      const alpha = (colors.bg as RGBA).a !== undefined ? (colors.bg as RGBA).a : 1;
      input.fills = [{
        type: 'SOLID',
        color: { r: colors.bg.r, g: colors.bg.g, b: colors.bg.b },
        opacity: alpha
      }];
    }
  } else {
    // No background variable (outline style) - set fallback
    if (colors.bg) {
      const alpha = (colors.bg as RGBA).a !== undefined ? (colors.bg as RGBA).a : 1;
      input.fills = [{
        type: 'SOLID',
        color: { r: colors.bg.r, g: colors.bg.g, b: colors.bg.b },
        opacity: alpha
      }];
    } else {
      input.fills = [];
    }
  }

  // Border - Outline always has border, soft only has border on focus
  const borderVarName = getInputColorVarName(style, state, 'border');
  if (borderVarName) {
    const borderBound = await bindVariableToStroke(input, borderVarName);
    if (!borderBound && colors.border) {
      const alpha = (colors.border as RGBA).a !== undefined ? (colors.border as RGBA).a : 1;
      input.strokes = [{
        type: 'SOLID',
        color: { r: colors.border.r, g: colors.border.g, b: colors.border.b },
        opacity: alpha
      }];
    }
    input.strokeWeight = 1;
  } else {
    // No border for soft default/hover states
    input.strokes = [];
    input.strokeWeight = 0;
  }

  // Bind sizing properties to the input frame
  const sizeVars = INPUT_SIZE_VARS[size];
  await bindVariableToProperty(input, 'height', sizeVars.height);
  await bindVariableToProperty(input, 'paddingLeft', sizeVars.padding);
  await bindVariableToProperty(input, 'paddingRight', sizeVars.padding);
  await bindVariableToProperty(input, 'itemSpacing', sizeVars.gap);
  await bindVariableToProperty(input, 'cornerRadius', sizeVars.radius);

  // Get variable names for icons
  // Icon size uses fontSize (1em in CSS), not iconSize like buttons
  const iconSizeVarName = sizeVars.fontSize;

  // Start adornment (left icon) - always create, visibility controlled by property
  const iconStart = await createIconInstance(INPUT_ICON_NODE_IDS.startAdornment, config.fontSize, 'component/input/text/default', iconSizeVarName);
  iconStart.name = 'startAdornment'; // Lowercase name
  iconStart.visible = startAdornment; // Control visibility through property
  input.appendChild(iconStart);

  // Text input (placeholder text) - always present
  const textInput = figma.createText();
  textInput.name = 'text input'; // Lowercase name
  textInput.characters = 'Enter text...';

  // Apply text style - this is the primary source for font family, size, etc.
  const styleApplied = await applyInputTextStyle(textInput, size);

  // Also try to bind font size variable explicitly
  await bindVariableToProperty(textInput, 'fontSize', sizeVars.fontSize);

  if (!styleApplied) {
    console.log(`No text style found for size: ${size} - using fallback font settings`);
    textInput.fontSize = config.fontSize;
    textInput.fontName = FONT.family;
    textInput.letterSpacing = { value: -0.14, unit: 'PIXELS' };
    // Set line-height to match font-size (1:1 ratio)
    textInput.lineHeight = { value: config.fontSize, unit: 'PIXELS' };
  }

  // Bind placeholder text color variable - use component/input/text/placeholder (no fallback)
  const textBound = await bindVariableToTextFill(textInput, 'component/input/text/placeholder');
  if (!textBound) {
    console.log(`Failed to bind placeholder text variable: component/input/text/placeholder`);
  } else {
    // Verify the variable is actually bound
    const fills = textInput.fills;
    if (Array.isArray(fills) && fills.length > 0) {
      const fill = fills[0];
      if (fill.type === 'SOLID' && 'boundVariable' in fill && fill.boundVariable) {
        console.log(`Placeholder text variable successfully bound`);
      } else {
        console.log(`Warning: Placeholder text variable binding may have failed - fill type:`, fill.type);
      }
    }
  }

  input.appendChild(textInput);

  // End adornment (right icon) - always create, visibility controlled by property
  const iconEnd = await createIconInstance(INPUT_ICON_NODE_IDS.endAdornment, config.fontSize, 'component/input/text/default', iconSizeVarName);
  iconEnd.name = 'endAdornment'; // Lowercase name
  iconEnd.visible = endAdornment; // Control visibility through property
  input.appendChild(iconEnd);

  return input;
}

async function generateInputs(): Promise<void> {
  // Reset variables cache for fresh lookup
  variablesCache = null;

  let y = 0;
  const GAP_BETWEEN_SETS = 200;
  const GAP_WITHIN_SET = 50;

  const inputComponents: ComponentNode[] = [];
  let x = 0;
  let localY = 0;

  // Calculate total components: styles × states × sizes (only one adornment variant: both true)
  const totalComponents = INPUT_STYLES.length * INPUT_STATES.length * INPUT_SIZE_ORDER.length;

  let totalCreatedComponents = 0;

  // For each style
  for (const style of INPUT_STYLES) {
    // For each state
    for (const state of INPUT_STATES) {
      // For each size
      for (const size of INPUT_SIZE_ORDER) {
        // Only one variant: both adornments true (like buttons)
        // User can toggle visibility to false as needed
        const component = await createStyledInput(style, state, size, true, true);
        component.x = x;
        component.y = localY;
        x += component.width + GAP_WITHIN_SET;
        inputComponents.push(component);
        totalCreatedComponents++;

        // Send progress update
        await new Promise(resolve => setTimeout(resolve, 0));
        figma.ui.postMessage({
          type: 'progress-update',
          style: style,
          state: state,
          size: size,
          currentTotal: totalCreatedComponents,
          totalAll: totalComponents
        });
      }
      // New row for each state/style combo within the set
      x = 0;
      localY += 100; // rough vertical spacing for pre-combined items
    }
  }

  // Log component count for debugging
  console.log(`Total Input components to combine: ${inputComponents.length}, expected: ${totalComponents}`);

  // Verify we have the expected number of components
  if (inputComponents.length !== totalComponents) {
    console.warn(`Input component count mismatch! Expected ${totalComponents}, got ${inputComponents.length}`);
    // Log component names to debug
    inputComponents.forEach((comp, idx) => {
      console.log(`  [${idx}] ${comp.name}`);
    });
  }

  // Send progress update before combining variants (this can be slow)
  figma.ui.postMessage({
    type: 'progress-update',
    style: 'combining',
    state: 'variants',
    size: '',
    currentTotal: totalCreatedComponents,
    totalAll: totalComponents
  });

  // Create the component set
  let componentSet: ComponentSetNode;
  try {
    componentSet = figma.combineAsVariants(inputComponents, figma.currentPage);
    componentSet.name = 'input'; // Single component set name

    // Log the number of variants in the set
    console.log(`Input component set created with ${componentSet.children.length} variants`);

    // Position the SET itself
    componentSet.y = y;

    // Send message that generation is complete
    figma.ui.postMessage({
      type: 'inputs-complete',
      currentTotal: totalCreatedComponents,
      totalAll: totalComponents
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error combining Input variants: ${errorMessage}`);
    figma.notify(`Error combining Input variants: ${errorMessage}`, { error: true });
    figma.ui.postMessage({ type: 'inputs-error', message: `Error combining Input variants: ${errorMessage}` });
    throw error;
  }
}

// Icon component node IDs from the Figma library
const ICON_NODE_IDS = {
  left: '6011:127065', // Specific envelope component
  right: '6011:126766', // Specific arrow component
  iconOnly: '6011:126811', // Icon for icon-only buttons
};

async function createIconInstance(
  nodeId: string,
  size: number,
  colorVarName?: string,
  sizeVarName?: string
): Promise<InstanceNode | FrameNode> {
  console.log('createIconInstance called with nodeId:', nodeId, 'size:', size);

  // Try to find the icon component in the document
  const node = await figma.getNodeByIdAsync(nodeId);
  console.log('Found node:', node ? `${node.type} - ${node.name}` : 'null');

  if (node && node.type === 'COMPONENT') {
    // Create an instance of the icon component
    const instance = node.createInstance();
    console.log('Created instance:', instance.name, 'size:', instance.width, 'x', instance.height);

    // Try to bind size variables, fallback to manual resize
    if (sizeVarName) {
      const widthBound = await bindVariableToProperty(instance, 'width', sizeVarName);
      const heightBound = await bindVariableToProperty(instance, 'height', sizeVarName);
      if (!widthBound || !heightBound) {
        instance.resize(size, size);
      }
    } else {
      instance.resize(size, size);
    }

    // Try to bind color variable to the icon
    if (colorVarName) {
      console.log(`Attempting to bind icon color variable: ${colorVarName}`);
      await bindColorToInstance(instance, colorVarName);
    }

    return instance;
  }

  // Maybe it's an instance we need to get the main component from
  if (node && node.type === 'INSTANCE') {
    const mainComponent = await node.getMainComponentAsync();
    if (mainComponent) {
      const instance = mainComponent.createInstance();

      if (sizeVarName) {
        const widthBound = await bindVariableToProperty(instance, 'width', sizeVarName);
        const heightBound = await bindVariableToProperty(instance, 'height', sizeVarName);
        if (!widthBound || !heightBound) {
          instance.resize(size, size);
        }
      } else {
        instance.resize(size, size);
      }

      // Try to bind color variable to the icon
      if (colorVarName) {
        await bindColorToInstance(instance, colorVarName);
      }

      console.log('Created instance from main component:', instance.name);
      return instance;
    }
  }

  console.log('Fallback: creating placeholder. Node type was:', node?.type || 'not found');
  // Fallback: create a simple placeholder if component not found
  return createIconPlaceholder(size, { r: 0.5, g: 0.5, b: 0.5 });
}


function createIconPlaceholder(size: number, color: RGB): FrameNode {
  // Create a simple mail-like icon placeholder (envelope shape)
  const icon = figma.createFrame();
  icon.name = 'icon';
  icon.resize(size, size);
  icon.fills = [];

  // Create envelope rectangle
  const envelope = figma.createRectangle();
  envelope.resize(size * 0.75, size * 0.55);
  envelope.x = size * 0.125;
  envelope.y = size * 0.225;
  envelope.cornerRadius = size * 0.08;
  envelope.fills = [];
  envelope.strokes = [{ type: 'SOLID', color: color }];
  envelope.strokeWeight = size * 0.08;

  icon.appendChild(envelope);
  return icon;
}

function createArrowIcon(size: number, color: RGB): FrameNode {
  // Create a simple right arrow icon
  const icon = figma.createFrame();
  icon.name = 'arrow';
  icon.resize(size, size);
  icon.fills = [];

  // Create arrow line
  const line = figma.createLine();
  line.resize(size * 0.5, 0);
  line.x = size * 0.25;
  line.y = size / 2;
  line.strokes = [{ type: 'SOLID', color: color }];
  line.strokeWeight = size * 0.1;
  line.strokeCap = 'ROUND';

  icon.appendChild(line);

  // Create arrowhead (two short lines)
  const head1 = figma.createLine();
  head1.resize(size * 0.2, 0);
  head1.rotation = -45;
  head1.x = size * 0.65;
  head1.y = size * 0.35;
  head1.strokes = [{ type: 'SOLID', color: color }];
  head1.strokeWeight = size * 0.1;
  head1.strokeCap = 'ROUND';

  const head2 = figma.createLine();
  head2.resize(size * 0.2, 0);
  head2.rotation = 45;
  head2.x = size * 0.65;
  head2.y = size * 0.65;
  head2.strokes = [{ type: 'SOLID', color: color }];
  head2.strokeWeight = size * 0.1;
  head2.strokeCap = 'ROUND';

  icon.appendChild(head1);
  icon.appendChild(head2);

  return icon;
}

// ============================================================================
// Icon Generation Functions
// ============================================================================

/**
 * Transform PascalCase to kebab-case
 * Example: ArrowBottomLeftSm -> arrow-bottom-left-sm
 * Example: AspectRatio34 -> aspect-ratio-34
 */
function pascalToKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // Lowercase letter before uppercase letter
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')  // Uppercase letter before uppercase+lowercase
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')  // Letter before number
    .replace(/([0-9])([a-zA-Z])/g, '$1-$2')  // Number before letter
    .toLowerCase();
}

/**
 * Generate human-readable description for an icon based on its name
 * Does not include the icon name itself - only functional description
 */
function generateIconDescription(iconName: string): string {
  const name = iconName.toLowerCase();

  // Helper function to check if name includes any of the patterns
  const includesAny = (patterns: string[]): boolean => patterns.some(p => name.includes(p));

  // Navigation
  if (includesAny(['arrow', 'chevron', 'caret', 'back', 'forward', 'next', 'previous'])) {
    if (includesAny(['left'])) return 'Arrow pointing left';
    if (includesAny(['right'])) return 'Arrow pointing right';
    if (includesAny(['up'])) return 'Arrow pointing up';
    if (includesAny(['down'])) return 'Arrow pointing down';
    return 'Navigation arrow';
  }
  if (includesAny(['home'])) return 'Home page';
  if (includesAny(['globe', 'world', 'earth'])) return 'Globe or world';

  // Actions
  if (includesAny(['add', 'plus', 'create', 'new'])) {
    if (includesAny(['member', 'user'])) return 'Add user or member';
    if (includesAny(['source'])) return 'Add source';
    return 'Add or create';
  }
  if (includesAny(['delete', 'remove', 'minus', 'clear', 'trash'])) {
    if (includesAny(['account'])) return 'Delete account';
    return 'Delete or remove';
  }
  if (includesAny(['edit', 'pencil', 'modify', 'change', 'write'])) return 'Edit or modify';
  if (includesAny(['copy', 'duplicate', 'clone'])) return 'Copy or duplicate';
  if (includesAny(['download', 'save', 'export'])) return 'Download or save';
  if (includesAny(['upload', 'import'])) return 'Upload or import';
  if (includesAny(['search', 'magnify', 'find', 'telescope'])) return 'Search or find';
  if (includesAny(['eye', 'view', 'visible', 'hidden', 'show', 'hide'])) {
    if (includesAny(['off', 'closed'])) return 'Hide or view hidden';
    return 'View or show';
  }
  if (includesAny(['filter'])) return 'Filter';
  if (includesAny(['logout', 'exit'])) return 'Logout or exit';

  // Communication
  if (includesAny(['chat', 'message', 'messaging'])) return 'Chat or messaging';
  if (includesAny(['mail', 'email'])) return 'Email or mail';
  if (includesAny(['bell', 'notification'])) return 'Notification';
  if (includesAny(['comment', 'forum'])) return 'Comment or forum';

  // Media
  if (includesAny(['play'])) return 'Play';
  if (includesAny(['pause'])) return 'Pause';
  if (includesAny(['stop'])) return 'Stop';
  if (includesAny(['video'])) return 'Video';
  if (includesAny(['image', 'picture', 'photo', 'camera'])) return 'Image or photo';
  if (includesAny(['caption'])) return 'Caption';
  if (includesAny(['mic', 'microphone', 'voice', 'speak', 'speech'])) {
    if (includesAny(['off', 'mute'])) return 'Microphone muted';
    return 'Microphone or voice';
  }
  if (includesAny(['sound', 'audio', 'music'])) return 'Sound or audio';

  // Files
  if (includesAny(['folder'])) return 'Folder';
  if (includesAny(['file', 'document'])) return 'File or document';
  if (includesAny(['notebook', 'notepad'])) return 'Notebook';
  if (includesAny(['archive'])) return 'Archive';
  if (includesAny(['clipboard'])) return 'Clipboard';

  // Users
  if (includesAny(['avatar', 'profile'])) return 'User avatar or profile';
  if (includesAny(['group', 'people'])) return 'Group of users';
  if (includesAny(['user', 'member', 'person'])) return 'User or member';

  // Settings
  if (includesAny(['settings', 'config', 'gear', 'preferences', 'options', 'customize'])) {
    return 'Settings or configuration';
  }

  // Status
  if (includesAny(['check', 'success', 'complete', 'done'])) return 'Success or completed';
  if (includesAny(['error', 'warning', 'alert', 'exclamation'])) return 'Error or warning';
  if (includesAny(['info', 'help', 'question'])) return 'Information or help';

  // AI & Automation
  if (includesAny(['agent', 'assistant'])) return 'AI agent or assistant';
  if (includesAny(['sparkle', 'bolt', 'flash', 'inspiration'])) return 'AI or magic feature';
  if (includesAny(['gpt', 'sora', 'brain', 'automation', 'bot'])) return 'AI or automation';

  // Analytics
  if (includesAny(['chart', 'graph', 'analytics', 'bar'])) return 'Analytics or chart';
  if (includesAny(['data', 'statistics', 'metrics'])) return 'Data or statistics';

  // Interface
  if (includesAny(['menu', 'hamburger'])) return 'Menu';
  if (includesAny(['collapse', 'expand'])) return 'Collapse or expand';
  if (includesAny(['link', 'chain', 'external'])) return 'Link';
  if (includesAny(['code', 'function', 'variable', 'script'])) return 'Code or development';
  if (includesAny(['grid', 'layout', 'table'])) return 'Grid or layout';
  if (includesAny(['history'])) return 'History';
  if (includesAny(['lightmode', 'darkmode', 'moon', 'sun', 'colortheme', 'systemmode'])) {
    return 'Theme or mode';
  }
  if (includesAny(['cursor', 'desktop', 'mobile'])) return 'Device or cursor';

  // Symbols
  if (includesAny(['heart'])) return 'Favorite or like';
  if (includesAny(['star'])) return 'Star or featured';
  if (includesAny(['bookmark', 'pin'])) return 'Bookmark or pin';
  if (includesAny(['flag', 'tag', 'badge', 'wreath'])) return 'Symbol or marker';

  // Time
  if (includesAny(['clock', 'time'])) return 'Clock or time';
  if (includesAny(['calendar', 'date'])) return 'Calendar or date';

  // Security
  if (includesAny(['lock', 'key'])) return 'Lock or security';
  if (includesAny(['shield', 'protection'])) return 'Security shield';
  if (includesAny(['secure', 'private'])) return 'Security or privacy';

  // Default - return empty string (name will be in tags only)
  return '';
}

/**
 * Generate search tags from icon name
 * Includes only synonyms (words from icon name are excluded - they're already in the name)
 * Example: XCrossed -> "close, delete, remove, cancel, exit" (without "x" and "crossed")
 */
function generateSearchTags(iconName: string): string {
  const words = iconName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 0);

  // Don't include words from the icon name - only synonyms
  const tags = new Set<string>();

  // Add synonyms for common words (additional search terms only)
  words.forEach(word => {
    switch (word) {
      // Close/Cancel
      case 'x':
        tags.add('close');
        tags.add('delete');
        tags.add('remove');
        tags.add('cancel');
        tags.add('exit');
        tags.add('dismiss');
        break;
      case 'crossed':
      case 'cross':
        tags.add('close');
        tags.add('delete');
        tags.add('remove');
        tags.add('disabled');
        break;

      // Navigation
      case 'arrow':
        tags.add('direction');
        tags.add('navigation');
        tags.add('pointer');
        break;
      case 'chevron':
        tags.add('arrow');
        tags.add('expand');
        tags.add('collapse');
        tags.add('caret');
        break;
      case 'caret':
        tags.add('chevron');
        tags.add('dropdown');
        tags.add('expand');
        break;
      case 'down':
        tags.add('bottom');
        tags.add('dropdown');
        tags.add('below');
        break;
      case 'up':
        tags.add('top');
        tags.add('above');
        tags.add('upward');
        break;
      case 'left':
        tags.add('back');
        tags.add('previous');
        tags.add('west');
        break;
      case 'right':
        tags.add('forward');
        tags.add('next');
        tags.add('east');
        break;
      case 'home':
        tags.add('house');
        tags.add('main');
        tags.add('start');
        break;
      case 'globe':
      case 'world':
      case 'earth':
        tags.add('international');
        tags.add('web');
        tags.add('internet');
        tags.add('language');
        break;

      // Actions - Add/Create
      case 'add':
        tags.add('plus');
        tags.add('create');
        tags.add('new');
        tags.add('insert');
        break;
      case 'plus':
        tags.add('add');
        tags.add('create');
        tags.add('new');
        break;
      case 'create':
      case 'new':
        tags.add('add');
        tags.add('plus');
        break;

      // Actions - Remove/Delete
      case 'remove':
      case 'delete':
        tags.add('minus');
        tags.add('trash');
        tags.add('clear');
        tags.add('erase');
        break;
      case 'trash':
        tags.add('delete');
        tags.add('bin');
        tags.add('garbage');
        tags.add('remove');
        break;
      case 'minus':
        tags.add('remove');
        tags.add('subtract');
        tags.add('decrease');
        break;

      // Actions - Edit
      case 'edit':
        tags.add('modify');
        tags.add('pencil');
        tags.add('change');
        tags.add('update');
        tags.add('write');
        break;
      case 'pencil':
        tags.add('edit');
        tags.add('write');
        tags.add('draw');
        break;
      case 'copy':
        tags.add('duplicate');
        tags.add('clone');
        tags.add('clipboard');
        break;
      case 'paste':
        tags.add('clipboard');
        tags.add('insert');
        break;
      case 'cut':
        tags.add('scissors');
        tags.add('trim');
        break;

      // Actions - Transfer
      case 'save':
        tags.add('store');
        tags.add('download');
        tags.add('disk');
        tags.add('floppy');
        break;
      case 'saved':
        tags.add('bookmark');
        tags.add('favorite');
        tags.add('favourite');
        tags.add('store');
        break;
      case 'upload':
        tags.add('import');
        tags.add('send');
        tags.add('publish');
        break;
      case 'download':
        tags.add('export');
        tags.add('receive');
        tags.add('get');
        break;
      case 'share':
        tags.add('send');
        tags.add('forward');
        tags.add('social');
        break;
      case 'send':
        tags.add('share');
        tags.add('submit');
        tags.add('arrow');
        break;

      // Actions - Search/View
      case 'search':
        tags.add('find');
        tags.add('magnify');
        tags.add('lookup');
        tags.add('glass');
        break;
      case 'magnify':
      case 'zoom':
        tags.add('search');
        tags.add('glass');
        tags.add('enlarge');
        break;
      case 'eye':
        tags.add('view');
        tags.add('visible');
        tags.add('watch');
        tags.add('see');
        tags.add('preview');
        break;
      case 'view':
        tags.add('eye');
        tags.add('visible');
        tags.add('show');
        break;
      case 'hide':
      case 'hidden':
        tags.add('invisible');
        tags.add('conceal');
        tags.add('off');
        break;
      case 'filter':
        tags.add('sort');
        tags.add('funnel');
        tags.add('refine');
        break;

      // Actions - Undo/Redo
      case 'undo':
        tags.add('revert');
        tags.add('back');
        tags.add('restore');
        break;
      case 'redo':
        tags.add('repeat');
        tags.add('forward');
        break;
      case 'refresh':
        tags.add('reload');
        tags.add('sync');
        tags.add('update');
        tags.add('rotate');
        break;

      // Users
      case 'member':
      case 'user':
        tags.add('person');
        tags.add('people');
        tags.add('account');
        tags.add('profile');
        break;
      case 'people':
      case 'members':
      case 'users':
        tags.add('group');
        tags.add('team');
        tags.add('persons');
        break;
      case 'avatar':
        tags.add('user');
        tags.add('profile');
        tags.add('photo');
        break;

      // Settings
      case 'settings':
        tags.add('config');
        tags.add('gear');
        tags.add('preferences');
        tags.add('options');
        tags.add('cog');
        break;
      case 'gear':
      case 'cog':
        tags.add('settings');
        tags.add('config');
        tags.add('options');
        break;

      // Communication
      case 'chat':
      case 'message':
        tags.add('bubble');
        tags.add('comment');
        tags.add('talk');
        tags.add('conversation');
        break;
      case 'mail':
      case 'email':
        tags.add('envelope');
        tags.add('letter');
        tags.add('inbox');
        break;
      case 'bell':
        tags.add('notification');
        tags.add('alert');
        tags.add('ring');
        break;
      case 'phone':
        tags.add('call');
        tags.add('telephone');
        tags.add('mobile');
        tags.add('device');
        break;

      // Media - Video
      case 'video':
        tags.add('movie');
        tags.add('film');
        tags.add('camera');
        tags.add('record');
        break;
      case 'play':
        tags.add('start');
        tags.add('triangle');
        tags.add('media');
        tags.add('run');
        break;
      case 'pause':
        tags.add('hold');
        tags.add('stop');
        tags.add('wait');
        break;
      case 'stop':
        tags.add('end');
        tags.add('square');
        tags.add('halt');
        break;
      case 'skip':
        tags.add('next');
        tags.add('forward');
        break;
      case 'rewind':
        tags.add('backward');
        tags.add('previous');
        break;

      // Media - Audio
      case 'mic':
      case 'microphone':
        tags.add('voice');
        tags.add('audio');
        tags.add('record');
        tags.add('speak');
        break;
      case 'sound':
      case 'audio':
        tags.add('volume');
        tags.add('speaker');
        tags.add('music');
        break;
      case 'mute':
        tags.add('silent');
        tags.add('off');
        tags.add('quiet');
        break;

      // Media - Image
      case 'image':
      case 'picture':
      case 'photo':
        tags.add('gallery');
        tags.add('media');
        tags.add('snapshot');
        break;
      case 'camera':
        tags.add('photo');
        tags.add('capture');
        tags.add('snapshot');
        break;

      // Files
      case 'file':
        tags.add('document');
        tags.add('page');
        tags.add('paper');
        break;
      case 'folder':
        tags.add('directory');
        tags.add('collection');
        tags.add('organize');
        break;
      case 'document':
        tags.add('file');
        tags.add('page');
        tags.add('text');
        break;
      case 'clipboard':
        tags.add('paste');
        tags.add('copy');
        tags.add('board');
        break;

      // Interface
      case 'menu':
        tags.add('hamburger');
        tags.add('navigation');
        tags.add('list');
        tags.add('bars');
        break;
      case 'hamburger':
        tags.add('menu');
        tags.add('bars');
        tags.add('navigation');
        break;
      case 'sidebar':
        tags.add('panel');
        tags.add('drawer');
        tags.add('navigation');
        break;
      case 'expand':
        tags.add('enlarge');
        tags.add('maximize');
        tags.add('fullscreen');
        tags.add('open');
        break;
      case 'collapse':
        tags.add('minimize');
        tags.add('shrink');
        tags.add('close');
        break;
      case 'more':
      case 'dots':
        tags.add('menu');
        tags.add('options');
        tags.add('ellipsis');
        tags.add('overflow');
        break;
      case 'grid':
        tags.add('layout');
        tags.add('tiles');
        tags.add('gallery');
        break;
      case 'list':
        tags.add('bullets');
        tags.add('items');
        tags.add('rows');
        break;
      case 'table':
        tags.add('grid');
        tags.add('data');
        tags.add('spreadsheet');
        break;

      // Status
      case 'check':
      case 'checkmark':
        tags.add('done');
        tags.add('complete');
        tags.add('success');
        tags.add('ok');
        tags.add('tick');
        break;
      case 'success':
        tags.add('check');
        tags.add('done');
        tags.add('complete');
        break;
      case 'error':
        tags.add('fail');
        tags.add('wrong');
        tags.add('problem');
        break;
      case 'warning':
      case 'alert':
        tags.add('caution');
        tags.add('attention');
        tags.add('exclamation');
        break;
      case 'info':
        tags.add('information');
        tags.add('about');
        tags.add('help');
        break;
      case 'help':
      case 'question':
        tags.add('support');
        tags.add('faq');
        tags.add('ask');
        break;
      case 'loading':
        tags.add('spinner');
        tags.add('progress');
        tags.add('wait');
        break;

      // Security
      case 'lock':
        tags.add('secure');
        tags.add('private');
        tags.add('password');
        tags.add('closed');
        break;
      case 'unlock':
        tags.add('open');
        tags.add('access');
        tags.add('unsecure');
        break;
      case 'key':
        tags.add('password');
        tags.add('access');
        tags.add('security');
        tags.add('auth');
        break;
      case 'shield':
        tags.add('security');
        tags.add('protect');
        tags.add('safe');
        break;

      // Time
      case 'clock':
        tags.add('time');
        tags.add('hour');
        tags.add('schedule');
        tags.add('watch');
        break;
      case 'calendar':
        tags.add('date');
        tags.add('schedule');
        tags.add('event');
        tags.add('day');
        break;
      case 'history':
        tags.add('past');
        tags.add('recent');
        tags.add('log');
        tags.add('activity');
        break;

      // Symbols
      case 'heart':
        tags.add('love');
        tags.add('like');
        tags.add('favorite');
        tags.add('favourite');
        break;
      case 'star':
        tags.add('favorite');
        tags.add('rating');
        tags.add('important');
        tags.add('featured');
        break;
      case 'bookmark':
        tags.add('save');
        tags.add('favorite');
        tags.add('mark');
        break;
      case 'pin':
        tags.add('location');
        tags.add('marker');
        tags.add('attach');
        tags.add('fix');
        break;
      case 'flag':
        tags.add('report');
        tags.add('mark');
        tags.add('important');
        break;
      case 'tag':
        tags.add('label');
        tags.add('category');
        tags.add('mark');
        break;

      // Link
      case 'link':
        tags.add('chain');
        tags.add('connect');
        tags.add('url');
        tags.add('hyperlink');
        break;
      case 'external':
        tags.add('outside');
        tags.add('new window');
        tags.add('open');
        break;

      // Code
      case 'code':
        tags.add('programming');
        tags.add('developer');
        tags.add('brackets');
        tags.add('script');
        break;
      case 'terminal':
        tags.add('console');
        tags.add('command');
        tags.add('cli');
        tags.add('shell');
        break;
      case 'api':
        tags.add('integration');
        tags.add('connect');
        tags.add('developer');
        break;

      // AI
      case 'ai':
        tags.add('artificial');
        tags.add('intelligence');
        tags.add('smart');
        tags.add('machine');
        break;
      case 'sparkle':
      case 'sparkles':
        tags.add('magic');
        tags.add('ai');
        tags.add('generate');
        tags.add('stars');
        break;
      case 'bolt':
      case 'lightning':
        tags.add('fast');
        tags.add('quick');
        tags.add('power');
        tags.add('flash');
        break;
      case 'brain':
        tags.add('thinking');
        tags.add('intelligence');
        tags.add('mind');
        tags.add('smart');
        break;

      // Format
      case 'bold':
        tags.add('strong');
        tags.add('format');
        tags.add('text');
        break;
      case 'italic':
        tags.add('slant');
        tags.add('format');
        tags.add('text');
        break;
      case 'underline':
        tags.add('format');
        tags.add('text');
        break;
      case 'align':
        tags.add('format');
        tags.add('text');
        tags.add('justify');
        break;

      // Aspect/Dimensions
      case 'aspect':
        tags.add('ratio');
        tags.add('size');
        tags.add('dimensions');
        tags.add('resize');
        break;
      case 'ratio':
        tags.add('aspect');
        tags.add('proportion');
        tags.add('size');
        break;
      case 'resize':
        tags.add('scale');
        tags.add('size');
        tags.add('dimensions');
        break;
      case 'crop':
        tags.add('cut');
        tags.add('trim');
        tags.add('image');
        break;
      case 'rotate':
        tags.add('turn');
        tags.add('spin');
        tags.add('orientation');
        break;
      case 'flip':
        tags.add('mirror');
        tags.add('reflect');
        tags.add('horizontal');
        tags.add('vertical');
        break;

      // Brightness/Contrast
      case 'brightness':
        tags.add('light');
        tags.add('dark');
        tags.add('adjust');
        tags.add('sun');
        break;
      case 'contrast':
        tags.add('adjust');
        tags.add('light');
        tags.add('dark');
        break;
      case 'sun':
        tags.add('bright');
        tags.add('light');
        tags.add('day');
        tags.add('mode');
        break;
      case 'moon':
        tags.add('dark');
        tags.add('night');
        tags.add('mode');
        break;

      // Layers
      case 'layer':
      case 'layers':
        tags.add('stack');
        tags.add('overlap');
        tags.add('depth');
        break;
      case 'bring':
      case 'front':
        tags.add('layer');
        tags.add('forward');
        tags.add('above');
        break;
      case 'back':
        tags.add('layer');
        tags.add('behind');
        tags.add('below');
        break;
      case 'stack':
        tags.add('layers');
        tags.add('pile');
        tags.add('group');
        break;

      // Text
      case 'text':
        tags.add('type');
        tags.add('font');
        tags.add('write');
        break;
      case 'font':
        tags.add('text');
        tags.add('type');
        tags.add('letter');
        break;
      case 'quote':
        tags.add('text');
        tags.add('cite');
        tags.add('speech');
        break;

      // Shapes
      case 'circle':
        tags.add('shape');
        tags.add('round');
        tags.add('oval');
        break;
      case 'square':
        tags.add('shape');
        tags.add('box');
        tags.add('rectangle');
        break;
      case 'rectangle':
        tags.add('shape');
        tags.add('box');
        tags.add('square');
        break;
      case 'triangle':
        tags.add('shape');
        tags.add('arrow');
        break;
      case 'polygon':
        tags.add('shape');
        tags.add('multi');
        break;

      // Controls
      case 'slider':
        tags.add('range');
        tags.add('control');
        tags.add('adjust');
        break;
      case 'toggle':
        tags.add('switch');
        tags.add('on');
        tags.add('off');
        break;
      case 'checkbox':
        tags.add('check');
        tags.add('tick');
        tags.add('select');
        break;
      case 'radio':
        tags.add('select');
        tags.add('option');
        tags.add('choice');
        break;
      case 'dropdown':
        tags.add('select');
        tags.add('menu');
        tags.add('list');
        tags.add('caret');
        break;
      case 'button':
        tags.add('click');
        tags.add('action');
        tags.add('control');
        break;
      case 'input':
        tags.add('field');
        tags.add('form');
        tags.add('text');
        break;

      // Devices
      case 'desktop':
        tags.add('computer');
        tags.add('monitor');
        tags.add('screen');
        break;
      case 'laptop':
        tags.add('computer');
        tags.add('notebook');
        tags.add('device');
        break;
      case 'mobile':
        tags.add('phone');
        tags.add('device');
        tags.add('smartphone');
        break;
      case 'tablet':
        tags.add('ipad');
        tags.add('device');
        tags.add('screen');
        break;
      case 'watch':
        tags.add('time');
        tags.add('wearable');
        tags.add('device');
        break;
      case 'tv':
        tags.add('television');
        tags.add('screen');
        tags.add('display');
        break;

      // Location
      case 'location':
        tags.add('pin');
        tags.add('map');
        tags.add('place');
        tags.add('gps');
        break;
      case 'map':
        tags.add('location');
        tags.add('directions');
        tags.add('navigate');
        break;
      case 'compass':
        tags.add('direction');
        tags.add('navigation');
        tags.add('north');
        break;

      // Money/Commerce
      case 'money':
        tags.add('cash');
        tags.add('payment');
        tags.add('dollar');
        break;
      case 'dollar':
      case 'currency':
        tags.add('money');
        tags.add('payment');
        tags.add('price');
        break;
      case 'cart':
        tags.add('shopping');
        tags.add('buy');
        tags.add('basket');
        break;
      case 'bag':
        tags.add('shopping');
        tags.add('buy');
        tags.add('store');
        break;
      case 'credit':
      case 'card':
        tags.add('payment');
        tags.add('money');
        tags.add('bank');
        break;

      // Weather
      case 'cloud':
        tags.add('weather');
        tags.add('storage');
        tags.add('sky');
        break;
      case 'rain':
        tags.add('weather');
        tags.add('water');
        tags.add('drops');
        break;
      case 'snow':
        tags.add('weather');
        tags.add('cold');
        tags.add('winter');
        break;

      // Misc common icons
      case 'wifi':
        tags.add('network');
        tags.add('internet');
        tags.add('wireless');
        tags.add('signal');
        break;
      case 'bluetooth':
        tags.add('wireless');
        tags.add('connect');
        tags.add('device');
        break;
      case 'battery':
        tags.add('power');
        tags.add('charge');
        tags.add('energy');
        break;
      case 'power':
        tags.add('on');
        tags.add('off');
        tags.add('shut');
        break;
      case 'plug':
        tags.add('power');
        tags.add('connect');
        tags.add('electricity');
        break;
      case 'print':
      case 'printer':
        tags.add('paper');
        tags.add('output');
        tags.add('document');
        break;
      case 'scan':
      case 'scanner':
        tags.add('document');
        tags.add('qr');
        tags.add('barcode');
        break;
      case 'chart':
      case 'graph':
        tags.add('data');
        tags.add('analytics');
        tags.add('statistics');
        break;
      case 'dashboard':
        tags.add('panel');
        tags.add('metrics');
        tags.add('overview');
        break;
      case 'widget':
        tags.add('component');
        tags.add('module');
        tags.add('element');
        break;
      case 'window':
        tags.add('app');
        tags.add('panel');
        tags.add('frame');
        break;
      case 'tab':
        tags.add('window');
        tags.add('browser');
        tags.add('panel');
        break;
      case 'split':
        tags.add('divide');
        tags.add('separate');
        tags.add('two');
        break;
      case 'merge':
        tags.add('combine');
        tags.add('join');
        tags.add('unite');
        break;
      case 'cut':
        tags.add('scissors');
        tags.add('remove');
        tags.add('clip');
        break;
      case 'attach':
        tags.add('clip');
        tags.add('paperclip');
        tags.add('file');
        break;
      case 'inbox':
        tags.add('mail');
        tags.add('messages');
        tags.add('receive');
        break;
      case 'outbox':
        tags.add('mail');
        tags.add('send');
        tags.add('sent');
        break;
      case 'archive':
        tags.add('storage');
        tags.add('save');
        tags.add('backup');
        break;
      case 'trash':
        tags.add('delete');
        tags.add('remove');
        tags.add('bin');
        tags.add('garbage');
        break;
      case 'recycle':
        tags.add('restore');
        tags.add('trash');
        tags.add('recover');
        break;
      case 'drag':
        tags.add('move');
        tags.add('handle');
        tags.add('grip');
        break;
      case 'handle':
        tags.add('drag');
        tags.add('move');
        tags.add('grip');
        break;
      case 'open':
        tags.add('launch');
        tags.add('start');
        tags.add('expand');
        break;
      case 'close':
        tags.add('x');
        tags.add('exit');
        tags.add('dismiss');
        break;
      case 'enter':
        tags.add('return');
        tags.add('submit');
        tags.add('login');
        break;
      case 'login':
        tags.add('signin');
        tags.add('enter');
        tags.add('access');
        break;
      case 'logout':
        tags.add('signout');
        tags.add('exit');
        tags.add('leave');
        break;
      case 'profile':
        tags.add('user');
        tags.add('account');
        tags.add('avatar');
        break;
      case 'account':
        tags.add('user');
        tags.add('profile');
        tags.add('person');
        break;
      case 'sort':
        tags.add('order');
        tags.add('arrange');
        tags.add('filter');
        break;
      case 'swap':
        tags.add('exchange');
        tags.add('switch');
        tags.add('replace');
        break;
      case 'random':
        tags.add('shuffle');
        tags.add('mix');
        tags.add('dice');
        break;
      case 'shuffle':
        tags.add('random');
        tags.add('mix');
        tags.add('reorder');
        break;
      case 'loop':
        tags.add('repeat');
        tags.add('cycle');
        tags.add('infinite');
        break;
      case 'repeat':
        tags.add('loop');
        tags.add('cycle');
        tags.add('again');
        break;
      case 'object':
        tags.add('element');
        tags.add('item');
        tags.add('component');
        break;
      case 'agent':
        tags.add('ai');
        tags.add('bot');
        tags.add('assistant');
        break;
      case 'assistant':
        tags.add('ai');
        tags.add('help');
        tags.add('agent');
        break;
      case 'bot':
        tags.add('robot');
        tags.add('ai');
        tags.add('automation');
        break;
      case 'automation':
        tags.add('auto');
        tags.add('robot');
        tags.add('workflow');
        break;
      case 'sora':
        tags.add('ai');
        tags.add('video');
        tags.add('generate');
        break;
      case 'gpt':
        tags.add('ai');
        tags.add('chat');
        tags.add('language');
        break;
      case 'chatgpt':
        tags.add('ai');
        tags.add('chat');
        tags.add('gpt');
        break;
      case 'wrench':
        tags.add('tool');
        tags.add('settings');
        tags.add('repair');
        tags.add('fix');
        break;
      case 'hammer':
        tags.add('tool');
        tags.add('build');
        tags.add('construct');
        break;
      case 'tool':
      case 'tools':
        tags.add('wrench');
        tags.add('settings');
        tags.add('utility');
        break;
      case 'magic':
        tags.add('wand');
        tags.add('sparkle');
        tags.add('auto');
        break;
      case 'wand':
        tags.add('magic');
        tags.add('sparkle');
        tags.add('auto');
        break;
      case 'box':
        tags.add('cube');
        tags.add('package');
        tags.add('container');
        break;
      case 'cube':
        tags.add('3d');
        tags.add('box');
        tags.add('shape');
        break;
      case 'package':
        tags.add('box');
        tags.add('delivery');
        tags.add('ship');
        break;
      case 'gift':
        tags.add('present');
        tags.add('box');
        tags.add('reward');
        break;
      case 'rocket':
        tags.add('launch');
        tags.add('fast');
        tags.add('start');
        tags.add('deploy');
        break;
      case 'target':
        tags.add('goal');
        tags.add('aim');
        tags.add('focus');
        break;
      case 'trophy':
        tags.add('award');
        tags.add('win');
        tags.add('achievement');
        break;
      case 'medal':
        tags.add('award');
        tags.add('win');
        tags.add('achievement');
        break;
      case 'crown':
        tags.add('king');
        tags.add('premium');
        tags.add('top');
        break;
      case 'verified':
        tags.add('check');
        tags.add('approved');
        tags.add('confirmed');
        break;
      case 'approve':
      case 'approved':
        tags.add('check');
        tags.add('verified');
        tags.add('confirm');
        break;
      case 'reject':
      case 'rejected':
        tags.add('x');
        tags.add('decline');
        tags.add('deny');
        break;
      case 'pending':
        tags.add('wait');
        tags.add('processing');
        tags.add('clock');
        break;

      // Analytics & Data
      case 'analytics':
        tags.add('data');
        tags.add('chart');
        tags.add('graph');
        tags.add('statistics');
        tags.add('metrics');
        break;
      case 'analyze':
      case 'analysis':
        tags.add('data');
        tags.add('examine');
        tags.add('study');
        tags.add('review');
        break;
      case 'data':
        tags.add('information');
        tags.add('stats');
        tags.add('metrics');
        tags.add('analytics');
        break;

      // Apps & Platform
      case 'app':
      case 'apps':
        tags.add('application');
        tags.add('program');
        tags.add('software');
        tags.add('platform');
        break;
      case 'array':
        tags.add('list');
        tags.add('collection');
        tags.add('data');
        tags.add('structure');
        break;
      case 'atom':
        tags.add('science');
        tags.add('chemistry');
        tags.add('molecule');
        tags.add('particle');
        break;

      // Badges & Labels
      case 'badge':
        tags.add('label');
        tags.add('tag');
        tags.add('mark');
        tags.add('award');
        break;
      case 'batch':
        tags.add('group');
        tags.add('collection');
        tags.add('set');
        tags.add('multiple');
        break;

      // Media & Effects
      case 'blend':
        tags.add('mix');
        tags.add('merge');
        tags.add('combine');
        tags.add('overlay');
        break;
      case 'boolean':
        tags.add('logic');
        tags.add('true');
        tags.add('false');
        tags.add('condition');
        break;
      case 'branch':
        tags.add('git');
        tags.add('version');
        tags.add('tree');
        tags.add('split');
        break;
      case 'bug':
        tags.add('error');
        tags.add('issue');
        tags.add('problem');
        tags.add('debug');
        break;
      case 'business':
        tags.add('company');
        tags.add('corporate');
        tags.add('office');
        tags.add('work');
        break;

      // Objects & Containers
      case 'cabinet':
        tags.add('storage');
        tags.add('furniture');
        tags.add('drawer');
        tags.add('organize');
        break;
      case 'card':
        tags.add('payment');
        tags.add('credit');
        tags.add('debit');
        tags.add('bank');
        break;
      case 'category':
        tags.add('group');
        tags.add('classify');
        tags.add('organize');
        tags.add('type');
        break;
      case 'certificate':
        tags.add('award');
        tags.add('document');
        tags.add('diploma');
        tags.add('credential');
        break;
      case 'compose':
        tags.add('write');
        tags.add('create');
        tags.add('edit');
        tags.add('draft');
        break;
      case 'connector':
        tags.add('connect');
        tags.add('link');
        tags.add('join');
        tags.add('integration');
        break;
      case 'cursor':
        tags.add('pointer');
        tags.add('mouse');
        tags.add('click');
        tags.add('select');
        break;
      case 'custom':
      case 'customize':
        tags.add('settings');
        tags.add('personalize');
        tags.add('configure');
        tags.add('adjust');
        break;
      case 'dark':
      case 'darkmode':
        tags.add('night');
        tags.add('theme');
        tags.add('mode');
        tags.add('black');
        break;

      // Document & Files
      case 'document':
        tags.add('file');
        tags.add('paper');
        tags.add('page');
        tags.add('text');
        break;

      // Interface Elements
      case 'device':
        tags.add('hardware');
        tags.add('machine');
        tags.add('gadget');
        tags.add('tool');
        break;
      case 'error':
        tags.add('fail');
        tags.add('wrong');
        tags.add('problem');
        tags.add('issue');
        break;
      case 'expand':
        tags.add('enlarge');
        tags.add('maximize');
        tags.add('fullscreen');
        tags.add('open');
        break;
      case 'external':
        tags.add('outside');
        tags.add('new window');
        tags.add('open');
        tags.add('link');
        break;

      // File Types
      case 'file':
        tags.add('document');
        tags.add('page');
        tags.add('paper');
        tags.add('data');
        break;
      case 'filter':
        tags.add('sort');
        tags.add('funnel');
        tags.add('refine');
        tags.add('search');
        break;
      case 'flag':
        tags.add('report');
        tags.add('mark');
        tags.add('important');
        tags.add('alert');
        break;
      case 'flash':
        tags.add('lightning');
        tags.add('bolt');
        tags.add('fast');
        tags.add('speed');
        break;
      case 'flask':
        tags.add('science');
        tags.add('chemistry');
        tags.add('experiment');
        tags.add('lab');
        break;
      case 'folder':
        tags.add('directory');
        tags.add('collection');
        tags.add('organize');
        tags.add('storage');
        break;
      case 'function':
        tags.add('code');
        tags.add('programming');
        tags.add('method');
        tags.add('script');
        break;

      // Layout & Structure
      case 'grid':
        tags.add('layout');
        tags.add('tiles');
        tags.add('gallery');
        tags.add('table');
        break;
      case 'group':
        tags.add('team');
        tags.add('people');
        tags.add('collection');
        tags.add('multiple');
        break;
      case 'hand':
        tags.add('gesture');
        tags.add('pointer');
        tags.add('cursor');
        tags.add('touch');
        break;
      case 'health':
        tags.add('medical');
        tags.add('wellness');
        tags.add('care');
        tags.add('hospital');
        break;
      case 'history':
        tags.add('past');
        tags.add('recent');
        tags.add('log');
        tags.add('activity');
        break;
      case 'home':
        tags.add('house');
        tags.add('main');
        tags.add('start');
        tags.add('dashboard');
        break;
      case 'image':
      case 'picture':
        tags.add('photo');
        tags.add('gallery');
        tags.add('media');
        tags.add('visual');
        break;
      case 'info':
        tags.add('information');
        tags.add('about');
        tags.add('help');
        tags.add('details');
        break;
      case 'invoice':
        tags.add('bill');
        tags.add('payment');
        tags.add('document');
        tags.add('receipt');
        break;
      case 'keyboard':
        tags.add('type');
        tags.add('input');
        tags.add('keys');
        tags.add('text');
        break;
      case 'language':
        tags.add('translate');
        tags.add('locale');
        tags.add('translation');
        tags.add('globe');
        break;
      case 'layout':
        tags.add('design');
        tags.add('arrange');
        tags.add('structure');
        tags.add('grid');
        break;
      case 'light':
      case 'lightmode':
        tags.add('bright');
        tags.add('day');
        tags.add('theme');
        tags.add('mode');
        break;
      case 'list':
        tags.add('items');
        tags.add('rows');
        tags.add('bullets');
        tags.add('collection');
        break;
      case 'lock':
        tags.add('secure');
        tags.add('private');
        tags.add('password');
        tags.add('protection');
        break;
      case 'map':
        tags.add('location');
        tags.add('navigation');
        tags.add('geography');
        tags.add('directions');
        break;
      case 'marker':
        tags.add('pin');
        tags.add('tag');
        tags.add('note');
        tags.add('highlight');
        break;
      case 'media':
        tags.add('content');
        tags.add('video');
        tags.add('audio');
        tags.add('image');
        break;
      case 'member':
      case 'user':
        tags.add('person');
        tags.add('people');
        tags.add('account');
        tags.add('profile');
        break;
      case 'menu':
        tags.add('navigation');
        tags.add('list');
        tags.add('options');
        tags.add('hamburger');
        break;
      case 'message':
        tags.add('chat');
        tags.add('text');
        tags.add('communication');
        tags.add('bubble');
        break;
      case 'mode':
        tags.add('theme');
        tags.add('setting');
        tags.add('state');
        tags.add('view');
        break;
      case 'music':
        tags.add('audio');
        tags.add('sound');
        tags.add('song');
        tags.add('playlist');
        break;
      case 'node':
        tags.add('point');
        tags.add('connection');
        tags.add('network');
        tags.add('dot');
        break;
      case 'notebook':
      case 'notepad':
        tags.add('note');
        tags.add('write');
        tags.add('document');
        tags.add('journal');
        break;
      case 'note':
        tags.add('notebook');
        tags.add('memo');
        tags.add('comment');
        tags.add('write');
        break;
      case 'order':
        tags.add('sort');
        tags.add('arrange');
        tags.add('sequence');
        tags.add('list');
        break;
      case 'page':
        tags.add('document');
        tags.add('file');
        tags.add('paper');
        tags.add('sheet');
        break;
      case 'panel':
        tags.add('sidebar');
        tags.add('window');
        tags.add('section');
        tags.add('area');
        break;
      case 'password':
        tags.add('security');
        tags.add('lock');
        tags.add('key');
        tags.add('auth');
        break;
      case 'pause':
        tags.add('stop');
        tags.add('hold');
        tags.add('wait');
        tags.add('break');
        break;
      case 'phone':
        tags.add('call');
        tags.add('mobile');
        tags.add('telephone');
        tags.add('device');
        break;
      case 'pin':
        tags.add('location');
        tags.add('marker');
        tags.add('attach');
        tags.add('fix');
        break;
      case 'plan':
        tags.add('schedule');
        tags.add('calendar');
        tags.add('strategy');
        tags.add('project');
        break;
      case 'play':
        tags.add('start');
        tags.add('media');
        tags.add('video');
        tags.add('triangle');
        break;
      case 'plus':
        tags.add('add');
        tags.add('create');
        tags.add('new');
        tags.add('insert');
        break;
      case 'profile':
        tags.add('user');
        tags.add('account');
        tags.add('avatar');
        tags.add('person');
        break;
      case 'pull':
        tags.add('git');
        tags.add('request');
        tags.add('update');
        tags.add('sync');
        break;
      case 'question':
        tags.add('help');
        tags.add('ask');
        tags.add('support');
        tags.add('faq');
        break;
      case 'quick':
        tags.add('fast');
        tags.add('speed');
        tags.add('instant');
        tags.add('rapid');
        break;
      case 'quote':
        tags.add('text');
        tags.add('cite');
        tags.add('speech');
        tags.add('reference');
        break;
      case 'record':
        tags.add('video');
        tags.add('audio');
        tags.add('capture');
        tags.add('save');
        break;
      case 'refresh':
        tags.add('reload');
        tags.add('sync');
        tags.add('update');
        tags.add('restart');
        break;
      case 'regenerate':
        tags.add('refresh');
        tags.add('recreate');
        tags.add('new');
        tags.add('again');
        break;
      case 'remove':
      case 'delete':
        tags.add('trash');
        tags.add('minus');
        tags.add('clear');
        tags.add('erase');
        break;
      case 'reply':
        tags.add('respond');
        tags.add('answer');
        tags.add('message');
        tags.add('return');
        break;
      case 'report':
        tags.add('flag');
        tags.add('issue');
        tags.add('document');
        tags.add('alert');
        break;
      case 'reset':
        tags.add('restart');
        tags.add('clear');
        tags.add('default');
        tags.add('revert');
        break;
      case 'restore':
        tags.add('undo');
        tags.add('recover');
        tags.add('backup');
        tags.add('return');
        break;
      case 'robot':
        tags.add('ai');
        tags.add('bot');
        tags.add('automation');
        tags.add('machine');
        break;
      case 'scale':
        tags.add('size');
        tags.add('resize');
        tags.add('measure');
        tags.add('weight');
        break;
      case 'screen':
        tags.add('display');
        tags.add('monitor');
        tags.add('window');
        tags.add('view');
        break;
      case 'select':
        tags.add('choose');
        tags.add('pick');
        tags.add('option');
        tags.add('check');
        break;
      case 'send':
        tags.add('share');
        tags.add('submit');
        tags.add('arrow');
        tags.add('forward');
        break;
      case 'setting':
      case 'settings':
        tags.add('config');
        tags.add('preferences');
        tags.add('options');
        tags.add('gear');
        break;
      case 'share':
        tags.add('send');
        tags.add('forward');
        tags.add('social');
        tags.add('export');
        break;
      case 'shield':
        tags.add('security');
        tags.add('protection');
        tags.add('safe');
        tags.add('guard');
        break;
      case 'shop':
      case 'shopping':
        tags.add('store');
        tags.add('buy');
        tags.add('cart');
        tags.add('purchase');
        break;
      case 'shortcut':
        tags.add('key');
        tags.add('keyboard');
        tags.add('fast');
        tags.add('quick');
        break;
      case 'sidebar':
        tags.add('panel');
        tags.add('navigation');
        tags.add('menu');
        tags.add('drawer');
        break;
      case 'simple':
        tags.add('basic');
        tags.add('easy');
        tags.add('minimal');
        tags.add('plain');
        break;
      case 'skip':
        tags.add('next');
        tags.add('forward');
        tags.add('jump');
        tags.add('ignore');
        break;
      case 'sleep':
        tags.add('pause');
        tags.add('rest');
        tags.add('idle');
        tags.add('suspend');
        break;
      case 'sound':
      case 'audio':
        tags.add('volume');
        tags.add('speaker');
        tags.add('music');
        tags.add('noise');
        break;
      case 'sparkle':
        tags.add('magic');
        tags.add('shine');
        tags.add('star');
        tags.add('glow');
        break;
      case 'speed':
        tags.add('fast');
        tags.add('quick');
        tags.add('velocity');
        tags.add('rapid');
        break;
      case 'square':
        tags.add('shape');
        tags.add('box');
        tags.add('rectangle');
        tags.add('frame');
        break;
      case 'stack':
        tags.add('layers');
        tags.add('pile');
        tags.add('group');
        tags.add('collection');
        break;
      case 'star':
        tags.add('favorite');
        tags.add('rating');
        tags.add('important');
        tags.add('featured');
        break;
      case 'status':
        tags.add('state');
        tags.add('condition');
        tags.add('info');
        tags.add('indicator');
        break;
      case 'stop':
        tags.add('end');
        tags.add('halt');
        tags.add('square');
        tags.add('cancel');
        break;
      case 'story':
        tags.add('narrative');
        tags.add('tale');
        tags.add('history');
        tags.add('content');
        break;
      case 'studio':
        tags.add('workspace');
        tags.add('edit');
        tags.add('create');
        tags.add('production');
        break;
      case 'suit':
      case 'suitcase':
        tags.add('travel');
        tags.add('bag');
        tags.add('luggage');
        tags.add('case');
        break;
      case 'sun':
        tags.add('bright');
        tags.add('light');
        tags.add('day');
        tags.add('theme');
        break;
      case 'system':
        tags.add('computer');
        tags.add('os');
        tags.add('platform');
        tags.add('settings');
        break;
      case 'table':
        tags.add('grid');
        tags.add('data');
        tags.add('spreadsheet');
        tags.add('rows');
        break;
      case 'tag':
        tags.add('label');
        tags.add('category');
        tags.add('mark');
        tags.add('badge');
        break;
      case 'task':
        tags.add('todo');
        tags.add('job');
        tags.add('work');
        tags.add('item');
        break;
      case 'text':
        tags.add('type');
        tags.add('write');
        tags.add('font');
        tags.add('content');
        break;
      case 'theme':
        tags.add('style');
        tags.add('appearance');
        tags.add('color');
        tags.add('mode');
        break;
      case 'thumb':
        tags.add('like');
        tags.add('rate');
        tags.add('vote');
        tags.add('feedback');
        break;
      case 'thumbnail':
        tags.add('preview');
        tags.add('image');
        tags.add('small');
        tags.add('mini');
        break;
      case 'timer':
        tags.add('clock');
        tags.add('time');
        tags.add('countdown');
        tags.add('stopwatch');
        break;
      case 'tool':
      case 'tools':
        tags.add('utility');
        tags.add('equipment');
        tags.add('wrench');
        tags.add('settings');
        break;
      case 'translate':
        tags.add('language');
        tags.add('translation');
        tags.add('convert');
        tags.add('localize');
        break;
      case 'trend':
      case 'trending':
        tags.add('popular');
        tags.add('up');
        tags.add('chart');
        tags.add('growth');
        break;
      case 'trophy':
        tags.add('award');
        tags.add('win');
        tags.add('achievement');
        tags.add('prize');
        break;
      case 'tuning':
        tags.add('adjust');
        tags.add('fine');
        tags.add('settings');
        tags.add('optimize');
        break;
      case 'unarchive':
        tags.add('restore');
        tags.add('recover');
        tags.add('unpack');
        tags.add('extract');
        break;
      case 'undo':
        tags.add('revert');
        tags.add('back');
        tags.add('restore');
        tags.add('cancel');
        break;
      case 'unlink':
        tags.add('disconnect');
        tags.add('remove');
        tags.add('break');
        tags.add('detach');
        break;
      case 'unpin':
        tags.add('detach');
        tags.add('unfix');
        tags.add('remove');
        tags.add('release');
        break;
      case 'upgrade':
        tags.add('update');
        tags.add('improve');
        tags.add('enhance');
        tags.add('better');
        break;
      case 'upscale':
        tags.add('enlarge');
        tags.add('increase');
        tags.add('grow');
        tags.add('expand');
        break;
      case 'user':
        tags.add('person');
        tags.add('people');
        tags.add('account');
        tags.add('profile');
        break;
      case 'variation':
        tags.add('version');
        tags.add('variant');
        tags.add('option');
        tags.add('alternative');
        break;
      case 'version':
        tags.add('release');
        tags.add('update');
        tags.add('iteration');
        tags.add('variation');
        break;
      case 'video':
        tags.add('movie');
        tags.add('film');
        tags.add('camera');
        tags.add('media');
        break;
      case 'voice':
        tags.add('audio');
        tags.add('sound');
        tags.add('speech');
        tags.add('mic');
        break;
      case 'warning':
        tags.add('alert');
        tags.add('caution');
        tags.add('danger');
        tags.add('attention');
        break;
      case 'website':
        tags.add('web');
        tags.add('site');
        tags.add('internet');
        tags.add('page');
        break;
      case 'widget':
        tags.add('component');
        tags.add('module');
        tags.add('element');
        tags.add('app');
        break;
      case 'work':
        tags.add('job');
        tags.add('task');
        tags.add('business');
        tags.add('labor');
        break;
      case 'write':
        tags.add('edit');
        tags.add('text');
        tags.add('pencil');
        tags.add('create');
        break;

      // Size variants (just remove from output, don't add synonyms)
      case 'sm':
      case 'md':
      case 'lg':
      case 'xl':
      case 'xxl':
      case 'xs':
      case '2xs':
      case '3xs':
      case '2xl':
      case '3xl':
        break;

      // Numbers (common in icon names like AspectRatio34)
      case '16':
      case '9':
      case '4':
      case '3':
      case '1':
      case '34':
      case '169':
      case '43':
      case '11':
      case '21':
        tags.add('ratio');
        tags.add('size');
        break;

      // OpenAI/AI-specific icons
      case 'gizmo':
      case 'gizmos':
        tags.add('tool');
        tags.add('widget');
        tags.add('feature');
        tags.add('plugin');
        break;
      case 'mcp':
        tags.add('protocol');
        tags.add('connection');
        tags.add('api');
        tags.add('model');
        break;
      case 'operator':
        tags.add('admin');
        tags.add('manage');
        tags.add('control');
        tags.add('agent');
        break;
      case 'playground':
        tags.add('test');
        tags.add('experiment');
        tags.add('sandbox');
        tags.add('try');
        break;
      case 'prompt':
        tags.add('input');
        tags.add('text');
        tags.add('question');
        tags.add('message');
        break;
      case 'memory':
        tags.add('remember');
        tags.add('save');
        tags.add('store');
        tags.add('history');
        break;
      case 'internal':
        tags.add('knowledge');
        tags.add('data');
        tags.add('private');
        tags.add('inside');
        break;
      case 'sources':
        tags.add('input');
        tags.add('data');
        tags.add('add');
        tags.add('import');
        break;
      case 'products':
        tags.add('items');
        tags.add('catalog');
        tags.add('services');
        tags.add('offerings');
        break;
      case 'explore':
        tags.add('discover');
        tags.add('browse');
        tags.add('find');
        tags.add('search');
        break;

      // Video/Media icons  
      case 'storyboard':
        tags.add('video');
        tags.add('plan');
        tags.add('sequence');
        tags.add('frames');
        break;
      case 'caption':
      case 'captions':
        tags.add('subtitle');
        tags.add('text');
        tags.add('video');
        tags.add('accessibility');
        break;
      case 'resolution':
        tags.add('quality');
        tags.add('size');
        tags.add('video');
        tags.add('pixels');
        break;
      case 'rewind':
        tags.add('backward');
        tags.add('back');
        tags.add('previous');
        tags.add('replay');
        break;
      case 'forward':
        tags.add('next');
        tags.add('skip');
        tags.add('advance');
        tags.add('ahead');
        break;

      // Activities/Objects
      case 'snorkle':
        tags.add('swim');
        tags.add('diving');
        tags.add('underwater');
        tags.add('ocean');
        break;
      case 'dumbbell':
      case 'kettlebell':
        tags.add('fitness');
        tags.add('gym');
        tags.add('exercise');
        tags.add('workout');
        break;
      case 'lotus':
        tags.add('meditation');
        tags.add('yoga');
        tags.add('calm');
        tags.add('wellness');
        break;
      case 'paw':
        tags.add('pet');
        tags.add('animal');
        tags.add('dog');
        tags.add('cat');
        break;
      case 'dining':
        tags.add('food');
        tags.add('restaurant');
        tags.add('eat');
        tags.add('meal');
        break;
      case 'plane':
        tags.add('travel');
        tags.add('flight');
        tags.add('airplane');
        tags.add('trip');
        break;
      case 'graduation':
        tags.add('education');
        tags.add('school');
        tags.add('cap');
        tags.add('degree');
        break;
      case 'education':
        tags.add('school');
        tags.add('learning');
        tags.add('study');
        tags.add('teach');
        break;
      case 'stethoscope':
        tags.add('medical');
        tags.add('doctor');
        tags.add('health');
        tags.add('hospital');
        break;
      case 'glasses':
        tags.add('eyewear');
        tags.add('vision');
        tags.add('reading');
        tags.add('spectacles');
        break;
      case 'telescope':
        tags.add('look');
        tags.add('view');
        tags.add('see');
        tags.add('observe');
        break;

      // Text/Content
      case 'spelling':
        tags.add('check');
        tags.add('grammar');
        tags.add('text');
        tags.add('correct');
        break;
      case 'speak':
        tags.add('voice');
        tags.add('talk');
        tags.add('audio');
        tags.add('speech');
        break;
      case 'speech':
        tags.add('text');
        tags.add('voice');
        tags.add('talk');
        tags.add('convert');
        break;
      case 'reading':
        tags.add('level');
        tags.add('text');
        tags.add('difficulty');
        tags.add('comprehension');
        break;
      case 'pasted':
        tags.add('clipboard');
        tags.add('paste');
        tags.add('copy');
        tags.add('text');
        break;
      case 'autocomplete':
        tags.add('suggest');
        tags.add('complete');
        tags.add('predict');
        tags.add('text');
        break;
      case 'followup':
        tags.add('continue');
        tags.add('next');
        tags.add('response');
        tags.add('question');
        break;
      case 'suggest':
      case 'suggested':
        tags.add('recommend');
        tags.add('hint');
        tags.add('propose');
        tags.add('auto');
        break;
      case 'inspiration':
        tags.add('idea');
        tags.add('creative');
        tags.add('spark');
        tags.add('lightbulb');
        break;
      case 'longer':
        tags.add('extend');
        tags.add('more');
        tags.add('expand');
        tags.add('text');
        break;
      case 'shorter':
        tags.add('reduce');
        tags.add('less');
        tags.add('shrink');
        tags.add('text');
        break;

      // Additional icons
      case 'batches':
        tags.add('group');
        tags.add('bulk');
        tags.add('multiple');
        tags.add('queue');
        break;
      case 'commit':
        tags.add('git');
        tags.add('save');
        tags.add('version');
        tags.add('code');
        break;
      case 'compare':
        tags.add('diff');
        tags.add('contrast');
        tags.add('match');
        tags.add('side');
        break;
      case 'latency':
        tags.add('speed');
        tags.add('delay');
        tags.add('time');
        tags.add('performance');
        break;
      case 'connect':
        tags.add('link');
        tags.add('join');
        tags.add('plug');
        tags.add('integration');
        break;
      case 'permission':
        tags.add('access');
        tags.add('allow');
        tags.add('security');
        tags.add('role');
        break;
      case 'subscription':
        tags.add('plan');
        tags.add('payment');
        tags.add('recurring');
        tags.add('membership');
        break;
      case 'credits':
        tags.add('tokens');
        tags.add('balance');
        tags.add('usage');
        tags.add('billing');
        break;
      case 'paid':
        tags.add('payment');
        tags.add('money');
        tags.add('purchased');
        tags.add('premium');
        break;
      case 'billing':
      case 'bills':
        tags.add('payment');
        tags.add('invoice');
        tags.add('money');
        tags.add('finance');
        break;
      case 'identity':
        tags.add('person');
        tags.add('id');
        tags.add('profile');
        tags.add('auth');
        break;
      case 'privacy':
        tags.add('security');
        tags.add('private');
        tags.add('data');
        tags.add('protection');
        break;
      case 'terms':
        tags.add('legal');
        tags.add('policy');
        tags.add('agreement');
        tags.add('document');
        break;
      case 'parent':
        tags.add('control');
        tags.add('family');
        tags.add('restrict');
        tags.add('child');
        break;
      case 'controls':
        tags.add('settings');
        tags.add('options');
        tags.add('manage');
        tags.add('config');
        break;
      case 'haptic':
        tags.add('vibration');
        tags.add('touch');
        tags.add('feedback');
        tags.add('tactile');
        break;
      case 'blending':
        tags.add('curve');
        tags.add('mix');
        tags.add('smooth');
        tags.add('transition');
        break;
      case 'confetti':
        tags.add('celebrate');
        tags.add('party');
        tags.add('success');
        tags.add('joy');
        break;
      case 'emoji':
        tags.add('emoticon');
        tags.add('face');
        tags.add('reaction');
        tags.add('expression');
        break;
      case 'frozen':
        tags.add('ice');
        tags.add('cold');
        tags.add('pause');
        tags.add('stop');
        break;
      case 'snowflake':
        tags.add('winter');
        tags.add('cold');
        tags.add('snow');
        tags.add('freeze');
        break;
      case 'whisk':
        tags.add('cook');
        tags.add('kitchen');
        tags.add('mix');
        tags.add('bake');
        break;
      case 'scissor':
        tags.add('cut');
        tags.add('trim');
        tags.add('clip');
        tags.add('edit');
        break;
      case 'wreath':
        tags.add('award');
        tags.add('decoration');
        tags.add('celebration');
        tags.add('achievement');
        break;
      case 'diamond':
      case 'pro':
        tags.add('premium');
        tags.add('upgrade');
        tags.add('exclusive');
        tags.add('vip');
        break;
      case 'remix':
        tags.add('edit');
        tags.add('modify');
        tags.add('variation');
        tags.add('change');
        break;
      case 'popcorn':
        tags.add('movie');
        tags.add('cinema');
        tags.add('watch');
        tags.add('snack');
        break;
      case 'director':
        tags.add('video');
        tags.add('film');
        tags.add('create');
        tags.add('control');
        break;
      case 'clapping':
        tags.add('applause');
        tags.add('video');
        tags.add('film');
        tags.add('action');
        break;
      case 'dice':
        tags.add('random');
        tags.add('game');
        tags.add('chance');
        tags.add('shuffle');
        break;
      case 'interactiv':
        tags.add('click');
        tags.add('engage');
        tags.add('action');
        tags.add('dynamic');
        break;
      case 'signal':
        tags.add('wifi');
        tags.add('network');
        tags.add('connection');
        tags.add('bars');
        break;
      case 'exclamation':
        tags.add('warning');
        tags.add('alert');
        tags.add('attention');
        tags.add('important');
        break;
      case 'preset':
        tags.add('template');
        tags.add('default');
        tags.add('saved');
        tags.add('config');
        break;
      case 'dock':
        tags.add('bar');
        tags.add('taskbar');
        tags.add('launcher');
        tags.add('apps');
        break;
      case 'macbook':
        tags.add('laptop');
        tags.add('apple');
        tags.add('computer');
        tags.add('device');
        break;
      case 'menubar':
        tags.add('navigation');
        tags.add('menu');
        tags.add('toolbar');
        tags.add('header');
        break;
      case 'floating':
        tags.add('hover');
        tags.add('overlay');
        tags.add('popup');
        tags.add('panel');
        break;
      case 'pop':
        tags.add('window');
        tags.add('popup');
        tags.add('modal');
        tags.add('dialog');
        break;
      case 'pip':
        tags.add('picture');
        tags.add('video');
        tags.add('overlay');
        tags.add('mini');
        break;
      case 'minimize':
        tags.add('reduce');
        tags.add('shrink');
        tags.add('small');
        tags.add('collapse');
        break;
      case 'collapse':
        tags.add('minimize');
        tags.add('shrink');
        tags.add('close');
        tags.add('hide');
        break;
      case 'double':
        tags.add('two');
        tags.add('pair');
        tags.add('dual');
        tags.add('multiple');
        break;
      case 'circle':
        tags.add('round');
        tags.add('shape');
        tags.add('dot');
        tags.add('ring');
        break;
      case 'dashed':
        tags.add('dotted');
        tags.add('border');
        tags.add('outline');
        tags.add('line');
        break;
      case 'filled':
        tags.add('solid');
        tags.add('full');
        tags.add('complete');
        tags.add('active');
        break;
      case 'outline':
        tags.add('border');
        tags.add('stroke');
        tags.add('line');
        tags.add('empty');
        break;
      case 'alt':
        tags.add('alternative');
        tags.add('variant');
        tags.add('option');
        tags.add('different');
        break;
      case 'off':
        tags.add('disabled');
        tags.add('inactive');
        tags.add('mute');
        tags.add('hide');
        break;
      case 'on':
        tags.add('active');
        tags.add('enabled');
        tags.add('visible');
        tags.add('show');
        break;

      // More missing icons
      case 'clip':
        tags.add('attach');
        tags.add('paperclip');
        tags.add('file');
        tags.add('attachment');
        break;
      case 'paperclip':
        tags.add('attach');
        tags.add('clip');
        tags.add('file');
        tags.add('document');
        break;
      case 'attach':
        tags.add('clip');
        tags.add('paperclip');
        tags.add('file');
        tags.add('upload');
        break;
      case 'bolt':
        tags.add('lightning');
        tags.add('fast');
        tags.add('power');
        tags.add('electric');
        break;
      case 'brain':
        tags.add('mind');
        tags.add('think');
        tags.add('ai');
        tags.add('intelligence');
        break;
      case 'balancing':
        tags.add('scale');
        tags.add('weight');
        tags.add('compare');
        tags.add('equal');
        break;
      case 'at':
        tags.add('email');
        tags.add('mention');
        tags.add('address');
        tags.add('sign');
        break;
      case 'sign':
        tags.add('at');
        tags.add('symbol');
        tags.add('mark');
        tags.add('character');
        break;
      case 'pulse':
        tags.add('heartbeat');
        tags.add('health');
        tags.add('monitor');
        tags.add('activity');
        break;
      case 'headphones':
        tags.add('audio');
        tags.add('music');
        tags.add('listen');
        tags.add('earphones');
        break;
      case 'lightbulb':
        tags.add('idea');
        tags.add('light');
        tags.add('bright');
        tags.add('insight');
        break;
      case 'key':
        tags.add('password');
        tags.add('access');
        tags.add('security');
        tags.add('unlock');
        break;
      case 'api':
        tags.add('integration');
        tags.add('code');
        tags.add('developer');
        tags.add('connect');
        break;
      case 'terminal':
        tags.add('console');
        tags.add('command');
        tags.add('shell');
        tags.add('code');
        break;
      case 'enum':
        tags.add('type');
        tags.add('list');
        tags.add('options');
        tags.add('values');
        break;
      case 'string':
        tags.add('text');
        tags.add('type');
        tags.add('data');
        tags.add('variable');
        break;
      case 'number':
        tags.add('digit');
        tags.add('count');
        tags.add('integer');
        tags.add('value');
        break;
      case 'news':
      case 'newspaper':
        tags.add('article');
        tags.add('read');
        tags.add('media');
        tags.add('press');
        break;
      case 'plant':
        tags.add('nature');
        tags.add('grow');
        tags.add('green');
        tags.add('leaf');
        break;
      case 'desk':
        tags.add('office');
        tags.add('work');
        tags.add('table');
        tags.add('workspace');
        break;
      case 'stuff':
        tags.add('items');
        tags.add('things');
        tags.add('tools');
        tags.add('misc');
        break;
      case 'skill':
      case 'skills':
        tags.add('ability');
        tags.add('capability');
        tags.add('talent');
        tags.add('feature');
        break;
      case 'local':
        tags.add('nearby');
        tags.add('location');
        tags.add('services');
        tags.add('area');
        break;
      case 'services':
        tags.add('features');
        tags.add('offerings');
        tags.add('tools');
        tags.add('help');
        break;
      case 'travel':
        tags.add('trip');
        tags.add('journey');
        tags.add('vacation');
        tags.add('transport');
        break;
      case 'events':
        tags.add('calendar');
        tags.add('schedule');
        tags.add('occasion');
        tags.add('meeting');
        break;
      case 'bone':
        tags.add('t-bone');
        tags.add('raw');
        tags.add('meat');
        tags.add('food');
        break;
      case 'raw':
        tags.add('uncooked');
        tags.add('original');
        tags.add('source');
        tags.add('natural');
        break;
      case 'background':
        tags.add('wallpaper');
        tags.add('behind');
        tags.add('layer');
        tags.add('canvas');
        break;
      case 'conversation':
        tags.add('chat');
        tags.add('talk');
        tags.add('dialog');
        tags.add('discuss');
        break;
      case 'triple':
        tags.add('three');
        tags.add('multiple');
        tags.add('dots');
        tags.add('more');
        break;
      case 'horizontal':
        tags.add('landscape');
        tags.add('wide');
        tags.add('row');
        tags.add('left-right');
        break;
      case 'vertical':
        tags.add('portrait');
        tags.add('tall');
        tags.add('column');
        tags.add('up-down');
        break;
      case 'rotate':
        tags.add('turn');
        tags.add('spin');
        tags.add('ccw');
        tags.add('cw');
        break;
      case 'ccw':
        tags.add('counterclockwise');
        tags.add('left');
        tags.add('rotate');
        tags.add('undo');
        break;
      case 'cw':
        tags.add('clockwise');
        tags.add('right');
        tags.add('rotate');
        tags.add('redo');
        break;
      case 'today':
        tags.add('now');
        tags.add('current');
        tags.add('date');
        tags.add('calendar');
        break;
      case 'cc':
        tags.add('closed');
        tags.add('captions');
        tags.add('subtitle');
        tags.add('accessibility');
        break;
      case 'jump':
        tags.add('go');
        tags.add('skip');
        tags.add('navigate');
        tags.add('move');
        break;
      case 'curved':
        tags.add('arc');
        tags.add('bend');
        tags.add('round');
        tags.add('smooth');
        break;
      case 'bottom':
        tags.add('down');
        tags.add('below');
        tags.add('end');
        tags.add('lower');
        break;
      case 'top':
        tags.add('up');
        tags.add('above');
        tags.add('start');
        tags.add('upper');
        break;
      case 'position':
        tags.add('location');
        tags.add('place');
        tags.add('spot');
        tags.add('point');
        break;
      case 'watermark':
        tags.add('logo');
        tags.add('brand');
        tags.add('overlay');
        tags.add('mark');
        break;
      case 'waving':
        tags.add('hello');
        tags.add('wave');
        tags.add('hi');
        tags.add('greeting');
        break;
      case 'peace':
        tags.add('victory');
        tags.add('v');
        tags.add('two');
        tags.add('gesture');
        break;
      case 'raised':
        tags.add('up');
        tags.add('stop');
        tags.add('hand');
        tags.add('gesture');
        break;
      case 'front':
        tags.add('forward');
        tags.add('face');
        tags.add('ahead');
        tags.add('view');
        break;
      case 'back':
        tags.add('behind');
        tags.add('rear');
        tags.add('previous');
        tags.add('return');
        break;
      case 'missed':
        tags.add('lost');
        tags.add('call');
        tags.add('failed');
        tags.add('unanswered');
        break;
      case 'ring':
        tags.add('call');
        tags.add('phone');
        tags.add('alert');
        tags.add('notification');
        break;
      case 'waves':
        tags.add('sound');
        tags.add('audio');
        tags.add('signal');
        tags.add('vibration');
        break;
      case 'featured':
        tags.add('highlight');
        tags.add('star');
        tags.add('special');
        tags.add('promoted');
        break;
      case 'wide':
        tags.add('landscape');
        tags.add('horizontal');
        tags.add('broad');
        tags.add('panorama');
        break;
      case 'narrow':
        tags.add('thin');
        tags.add('slim');
        tags.add('small');
        tags.add('compact');
        break;
      case 'stuffed':
        tags.add('full');
        tags.add('filled');
        tags.add('packed');
        tags.add('folder');
        break;
      case 'shared':
        tags.add('public');
        tags.add('team');
        tags.add('collaborate');
        tags.add('access');
        break;
      case 'unshare':
        tags.add('private');
        tags.add('remove');
        tags.add('revoke');
        tags.add('access');
        break;
      case 'blank':
        tags.add('empty');
        tags.add('new');
        tags.add('clean');
        tags.add('clear');
        break;
      case 'spreadsheet':
        tags.add('excel');
        tags.add('table');
        tags.add('data');
        tags.add('cells');
        break;
      case 'presentation':
        tags.add('slides');
        tags.add('powerpoint');
        tags.add('deck');
        tags.add('show');
        break;
      case 'zip':
        tags.add('compress');
        tags.add('archive');
        tags.add('package');
        tags.add('folder');
        break;
      case 'audio':
        tags.add('sound');
        tags.add('music');
        tags.add('mp3');
        tags.add('voice');
        break;
      case '3':
      case 'd':
      case '3d':
        tags.add('three');
        tags.add('dimensional');
        tags.add('model');
        tags.add('space');
        break;
      case 'draft':
        tags.add('wip');
        tags.add('incomplete');
        tags.add('pending');
        tags.add('edit');
        break;
      case 'merged':
        tags.add('combined');
        tags.add('joined');
        tags.add('git');
        tags.add('pull');
        break;
      case 'closed':
        tags.add('done');
        tags.add('finished');
        tags.add('complete');
        tags.add('resolved');
        break;
      case 'request':
        tags.add('ask');
        tags.add('pull');
        tags.add('submit');
        tags.add('propose');
        break;


      // Fallback: if word is not recognized, skip it
      // (we don't add words from icon name to tags)
      default:
        break;
    }
  });

  // Return tags as comma-separated string
  // If no tags were generated (no matching cases), return empty string
  // This is acceptable - not all icons need tags if they're not in the switch
  return Array.from(tags).join(', ');
}


/**
 * Collect all vector nodes from a node tree recursively
 * Returns both the vectors and their parent paths for proper handling
 */
function collectVectorNodes(node: SceneNode): (VectorNode | BooleanOperationNode)[] {
  const vectors: (VectorNode | BooleanOperationNode)[] = [];

  if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    vectors.push(node as VectorNode | BooleanOperationNode);
  } else if ('children' in node) {
    for (const child of node.children) {
      vectors.push(...collectVectorNodes(child));
    }
  }

  return vectors;
}


/**
 * Flatten component structure - merge same-style vectors using Figma's flatten API
 * 
 * SAFETY RULES:
 * - Only flatten if all vectors have the same fill color and opacity = 1.0
 * - SKIP flattening if component contains BOOLEAN_OPERATION nodes (they create complex geometry)
 * - SKIP flattening if any vector has transparency
 */
async function flattenComponent(component: ComponentNode): Promise<void> {
  const children = [...component.children];

  if (children.length === 0) {
    return; // Nothing to flatten
  }

  // Collect all vectors AND boolean operations recursively
  const allVectors: VectorNode[] = [];
  let hasBooleanOperation = false;

  function extractNodes(node: SceneNode) {
    if (node.type === 'BOOLEAN_OPERATION') {
      hasBooleanOperation = true; // Mark that we found a boolean operation
    } else if (node.type === 'VECTOR') {
      allVectors.push(node as VectorNode);
    }

    if ('children' in node) {
      node.children.forEach(child => extractNodes(child));
    }
  }

  children.forEach(child => extractNodes(child));

  // If there are boolean operations, DON'T flatten - these create complex geometry
  // that would be broken by flattening (e.g., hollow shapes, cutouts)
  if (hasBooleanOperation) {
    // Only cleanup unnecessary nesting
    cleanupUnnecessaryNesting(component);
    return;
  }

  if (allVectors.length === 0) {
    return; // No vectors found
  }

  // Check if any vector has transparency (opacity < 1.0)
  const hasTransparency = allVectors.some(vector => {
    const nodeOpacity = 'opacity' in vector && typeof vector.opacity === 'number' ? vector.opacity : 1;
    if (nodeOpacity < 0.999) {
      return true;
    }

    if ('fills' in vector && Array.isArray(vector.fills)) {
      for (const fill of vector.fills) {
        if (fill.type === 'SOLID' && 'opacity' in fill && typeof fill.opacity === 'number') {
          if (fill.opacity < 0.999) {
            return true;
          }
        }
      }
    }
    return false;
  });

  if (hasTransparency) {
    return; // Don't touch icons with transparent layers
  }

  // Check if all vectors have the same style (color and opacity)
  const canFlatten = !hasDifferentStyles(allVectors) && allVectors.length > 1;

  if (canFlatten) {
    try {
      // Clone vectors to component level
      const vectorsToFlatten: SceneNode[] = [];
      for (const vector of allVectors) {
        if (vector.parent) {
          const clone = vector.clone();
          component.appendChild(clone);
          vectorsToFlatten.push(clone);
        }
      }

      // Remove original children
      children.forEach(child => {
        try {
          child.remove();
        } catch (error) {
          console.warn(`Could not remove child:`, error);
        }
      });

      // Flatten all vectors into one
      if (vectorsToFlatten.length > 1) {
        const flattened = figma.flatten(vectorsToFlatten);
        flattened.name = 'Vector';
      } else if (vectorsToFlatten.length === 1) {
        vectorsToFlatten[0].name = 'Vector';
      }
    } catch (error) {
      console.warn(`Could not flatten vectors:`, error);
    }
  }
}

/**
 * Check if vectors have different colors or opacities
 */
function hasDifferentStyles(vectors: VectorNode[]): boolean {
  if (vectors.length <= 1) {
    return false;
  }

  const styles = vectors.map(vector => {
    let fills: readonly Paint[] = [];
    if ('fills' in vector && Array.isArray(vector.fills)) {
      fills = vector.fills;
    }
    const opacity = 'opacity' in vector && typeof vector.opacity === 'number' ? vector.opacity : 1;

    let color: string | null = null;
    if (fills.length > 0 && fills[0].type === 'SOLID') {
      const solidFill = fills[0] as SolidPaint;
      color = `${solidFill.color.r},${solidFill.color.g},${solidFill.color.b}`;
    }

    return { color, opacity };
  });

  const firstStyle = styles[0];
  const allSame = styles.every(style =>
    style.color === firstStyle.color &&
    Math.abs(style.opacity - firstStyle.opacity) < 0.001
  );

  return !allSame;
}

/**
 * Remove unnecessary wrapper groups that contain only a single child.
 */
function cleanupUnnecessaryNesting(parent: ChildrenMixin & BaseNode): void {
  const children = [...parent.children];

  for (const child of children) {
    if ('children' in child && child.type !== 'COMPONENT' && child.type !== 'INSTANCE') {
      cleanupUnnecessaryNesting(child as ChildrenMixin & BaseNode);
    }

    if (child.type === 'GROUP' && child.children.length === 1) {
      try {
        const innerChild = child.children[0];
        const index = parent.children.indexOf(child);
        if (index !== -1 && 'insertChild' in parent) {
          (parent as ChildrenMixin).insertChild(index, innerChild);
          child.remove();
        }
      } catch (error) {
        console.warn(`Could not unwrap group:`, error);
      }
    }

    if (child.type === 'GROUP' && child.children.length === 0) {
      try {
        child.remove();
      } catch (error) {
        console.warn(`Could not remove empty group:`, error);
      }
    }
  }
}

/**
 * Determine icon category from name
 * Professional icon designer style categories (like Material Icons, Heroicons)
 */
function getIconCategory(iconName: string): string {
  const name = iconName.toLowerCase();

  // Navigation - arrows, directions, menu, navigation controls
  if (name.includes('arrow') || name.includes('chevron') || name.includes('caret') ||
    name.includes('direction') || name.includes('navigate') || name.includes('compass') ||
    name.includes('home') || name.includes('menu') || name.includes('hamburger') ||
    name.includes('sidebar') || name.includes('collapse') || name.includes('expand') ||
    name.includes('open-left') || name.includes('open-right') || name.includes('double-chevron') ||
    name.includes('back') || name.includes('forward') || name.includes('next') || name.includes('previous') ||
    name.includes('up') || name.includes('down') || name.includes('left') || name.includes('right') ||
    name.includes('globe') || name.includes('earth') || name.includes('world') || name.includes('map') ||
    name.includes('location') || name.includes('pin') || name.includes('gps')) {
    return 'Navigation';
  }

  // Action - editing, manipulation, operations
  if (name.includes('add') || name.includes('plus') || name.includes('create') || name.includes('new') ||
    name.includes('delete') || name.includes('remove') || name.includes('minus') || name.includes('trash') ||
    name.includes('edit') || name.includes('pencil') || name.includes('write') || name.includes('compose') ||
    name.includes('copy') || name.includes('duplicate') || name.includes('paste') || name.includes('cut') ||
    name.includes('undo') || name.includes('redo') || name.includes('rotate') || name.includes('refresh') ||
    name.includes('reload') || name.includes('regenerate') || name.includes('sync') ||
    name.includes('download') || name.includes('upload') || name.includes('export') || name.includes('import') ||
    name.includes('share') || name.includes('send') || name.includes('reply') ||
    name.includes('search') || name.includes('find') || name.includes('filter') || name.includes('sort') ||
    name.includes('save') || name.includes('close') || name.startsWith('x-') || name === 'x' ||
    name.includes('check') || name.includes('select') || name.includes('unpin') ||
    name.includes('login') || name.includes('logout') || name.includes('enter') || name.includes('exit') ||
    name.includes('link') || name.includes('unlink') || name.includes('attach') || name.includes('clip')) {
    return 'Action';
  }

  // Content - files, documents, media, text
  if (name.includes('file') || name.includes('folder') || name.includes('document') ||
    name.includes('page') || name.includes('book') || name.includes('notebook') || name.includes('note') ||
    name.includes('archive') || name.includes('zip') || name.includes('storage') ||
    name.includes('clipboard') || name.includes('sticky') ||
    name.includes('image') || name.includes('picture') || name.includes('photo') || name.includes('gallery') ||
    name.includes('video') || name.includes('camera') || name.includes('film') ||
    name.includes('music') || name.includes('audio') || name.includes('sound') ||
    name.includes('mic') || name.includes('voice') || name.includes('speaker') || name.includes('headphone') ||
    name.includes('play') || name.includes('pause') || name.includes('stop') || name.includes('record') ||
    name.includes('rewind') || name.includes('skip') || name.includes('loop') ||
    name.includes('caption') || name.includes('subtitle') || name.includes('resolution') || name.includes('storyboard') ||
    name.includes('text') || name.includes('font') || name.includes('quote') ||
    name.includes('chart') || name.includes('graph') || name.includes('analytics') || name.includes('data') ||
    name.includes('table') || name.includes('grid') || name.includes('list') ||
    name.includes('code') || name.includes('terminal') || name.includes('function') || name.includes('api') ||
    name.includes('branch') || name.includes('commit') || name.includes('pull') || name.includes('merge')) {
    return 'Content';
  }

  // Communication - messaging, notifications, social
  if (name.includes('chat') || name.includes('message') || name.includes('conversation') ||
    name.includes('comment') || name.includes('bubble') || name.includes('speech') ||
    name.includes('mail') || name.includes('email') || name.includes('inbox') ||
    name.includes('bell') || name.includes('notification') ||
    name.includes('phone') || name.includes('call') || name.includes('contact') ||
    name.includes('forum') || name.includes('messaging')) {
    return 'Communication';
  }

  // Social - users, people, groups
  if (name.includes('user') || name.includes('member') || name.includes('person') ||
    name.includes('people') || name.includes('group') || name.includes('avatar') ||
    name.includes('profile') || name.includes('account') || name.includes('identity') ||
    name.includes('hand') || name.includes('robot') || name.includes('agent') ||
    name.includes('heart') || name.includes('like') || name.includes('favorite') ||
    name.includes('star') || name.includes('bookmark') || name.includes('saved') ||
    name.includes('thumb') || name.includes('emoji') || name.includes('reaction')) {
    return 'Social';
  }

  // Hardware - devices, screens, physical objects
  if (name.includes('desktop') || name.includes('laptop') || name.includes('computer') ||
    name.includes('mobile') || name.includes('phone') || name.includes('tablet') ||
    name.includes('device') || name.includes('screen') || name.includes('monitor') ||
    name.includes('keyboard') || name.includes('mouse') || name.includes('cursor') || name.includes('pointer') ||
    name.includes('printer') || name.includes('scanner') ||
    name.includes('wifi') || name.includes('bluetooth') || name.includes('signal') ||
    name.includes('battery') || name.includes('power') || name.includes('plug') ||
    name.includes('camera') || name.includes('mic') || name.includes('speaker') ||
    name.includes('usb') || name.includes('cable') || name.includes('connect')) {
    return 'Hardware';
  }

  // Toggle - visibility, settings, on/off states
  if (name.includes('eye') || name.includes('visible') || name.includes('hide') || name.includes('view') ||
    name.includes('toggle') || name.includes('switch') || name.includes('on') || name.includes('off') ||
    name.includes('settings') || name.includes('config') || name.includes('gear') || name.includes('cog') ||
    name.includes('slider') || name.includes('adjust') || name.includes('tune') ||
    name.includes('dark') || name.includes('light') || name.includes('moon') || name.includes('sun') || name.includes('theme') ||
    name.includes('lock') || name.includes('unlock') || name.includes('secure') || name.includes('key') ||
    name.includes('dots') || name.includes('more') || name.includes('options') ||
    name.includes('minimize') || name.includes('maximize') || name.includes('fullscreen') ||
    name.includes('layout') || name.includes('aspect') || name.includes('resize') ||
    name.includes('dock') || name.includes('window') || name.includes('popup') || name.includes('modal')) {
    return 'Toggle';
  }

  // Alert - status, warnings, info
  if (name.includes('warning') || name.includes('error') || name.includes('danger') ||
    name.includes('alert') || name.includes('exclamation') ||
    name.includes('info') || name.includes('help') || name.includes('question') ||
    name.includes('success') || name.includes('complete') || name.includes('done') ||
    name.includes('flag') || name.includes('report') ||
    name.includes('shield') || name.includes('protect') || name.includes('security') ||
    name.includes('clock') || name.includes('time') || name.includes('calendar') || name.includes('timer') ||
    name.includes('sparkle') || name.includes('bolt') || name.includes('flash') || name.includes('lightning') ||
    name.includes('brain') || name.includes('lightbulb') || name.includes('idea') || name.includes('inspiration') ||
    name.includes('gpt') || name.includes('ai') || name.includes('magic') || name.includes('sora') ||
    name.includes('diamond') || name.includes('pro') || name.includes('premium') || name.includes('crown') ||
    name.includes('trophy') || name.includes('award') || name.includes('medal') || name.includes('wreath') ||
    name.includes('tag') || name.includes('badge') || name.includes('label') ||
    name.includes('dollar') || name.includes('credit') || name.includes('payment') || name.includes('money') ||
    name.includes('building') || name.includes('office') || name.includes('work') ||
    name.includes('circle') || name.includes('square') || name.includes('shape') || name.includes('dot')) {
    return 'Alert';
  }

  // Other - anything else
  return 'Other';
}

/**
 * Extract base name from icon name for similarity grouping
 * Examples:
 *   'PlusCircleFilled' -> 'Plus'
 *   'ChevronDownLg' -> 'Chevron'
 *   'ArrowUpRight' -> 'Arrow'
 *   'PlayCircleFilled' -> 'Play'
 *   'MagnifyingGlassSearch' -> 'Magnifying'
 */
function getIconBaseName(iconName: string): string {
  // Split into words by camelCase/PascalCase boundaries
  const words = iconName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .filter(w => w.length > 0);

  if (words.length === 0) return iconName;

  // Size/style suffixes to ignore when determining base name
  const suffixes = new Set([
    'sm', 'md', 'lg', 'xl', 'xs', 'xxl', '2xs', '3xs', '2xl', '3xl',
    'small', 'medium', 'large',
    'filled', 'outline', 'dashed', 'bold', 'light', 'regular',
    'alt', 'alt2', 'alt3',
    'circle', 'square',
    'on', 'off',
    '12px', '14px', '16px', '18px', '20px', '24px',
    'add', 'attach', 'copy', 'crossed', 'close',
    'left', 'right', 'up', 'down', 'top', 'bottom',
    'vector'
  ]);

  // Find the first significant word (base name)
  let baseName = words[0].toLowerCase();

  // If first word is very short, try combining with second word
  if (baseName.length <= 2 && words.length > 1) {
    baseName = (words[0] + words[1]).toLowerCase();
  }

  // For common prefixes, keep them as-is
  const commonPrefixes: { [key: string]: string } = {
    'arrow': 'Arrow',
    'chevron': 'Chevron',
    'caret': 'Caret',
    'plus': 'Plus',
    'minus': 'Minus',
    'check': 'Check',
    'x': 'X',
    'play': 'Play',
    'pause': 'Pause',
    'stop': 'Stop',
    'search': 'Search',
    'magnifying': 'Search',
    'edit': 'Edit',
    'file': 'File',
    'folder': 'Folder',
    'user': 'User',
    'member': 'Member',
    'heart': 'Heart',
    'star': 'Star',
    'bell': 'Bell',
    'notification': 'Bell',
    'lock': 'Lock',
    'eye': 'Eye',
    'mic': 'Mic',
    'microphone': 'Mic',
    'voice': 'Voice',
    'video': 'Video',
    'image': 'Image',
    'camera': 'Camera',
    'calendar': 'Calendar',
    'clock': 'Clock',
    'settings': 'Settings',
    'gear': 'Settings',
    'cog': 'Settings',
    'home': 'Home',
    'mail': 'Mail',
    'email': 'Mail',
    'chat': 'Chat',
    'message': 'Message',
    'copy': 'Copy',
    'clipboard': 'Clipboard',
    'download': 'Download',
    'upload': 'Upload',
    'share': 'Share',
    'link': 'Link',
    'trash': 'Trash',
    'delete': 'Delete',
    'remove': 'Remove',
    'expand': 'Expand',
    'collapse': 'Collapse',
    'sidebar': 'Sidebar',
    'menu': 'Menu',
    'hamburger': 'Menu',
    'dots': 'Dots',
    'more': 'More',
    'info': 'Info',
    'help': 'Help',
    'question': 'Question',
    'warning': 'Warning',
    'error': 'Error',
    'thumb': 'Thumb',
    'sparkle': 'Sparkle',
    'sparkles': 'Sparkle',
    'globe': 'Globe',
    'world': 'Globe',
    'loop': 'Loop',
    'refresh': 'Refresh',
    'reload': 'Reload',
    'square': 'Square',
    'circle': 'Circle',
    'document': 'Document',
    'page': 'Page',
    'book': 'Book',
    'variation': 'Variation',
    'aspect': 'Aspect',
    'thumbnail': 'Thumbnail',
    'lightbulb': 'Lightbulb',
    'shield': 'Shield',
    'key': 'Key',
    'pin': 'Pin',
    'map': 'Map',
    'chart': 'Chart',
    'graph': 'Graph',
    'bar': 'Bar',
    'phone': 'Phone',
    'mobile': 'Mobile',
    'desktop': 'Desktop',
    'terminal': 'Terminal',
    'code': 'Code',
    'openai': 'OpenAI',
    'back': 'Back',
    'forward': 'Forward',
    'skip': 'Skip',
    'rewind': 'Rewind',
    'paper': 'Paper',
    'notepad': 'Notepad',
    'notebook': 'Notebook'
  };

  if (commonPrefixes[baseName]) {
    return commonPrefixes[baseName];
  }

  // Otherwise, return first word with proper capitalization
  return words[0];
}

/**
 * Update selected icon components: flatten layers and add search tags
 * Components remain in place and keep their original names
 */
async function updateIconComponents(): Promise<number> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('Please select at least one component icon to update');
  }

  // Filter only ComponentNode
  const components = selection.filter(
    node => node.type === 'COMPONENT'
  ) as ComponentNode[];

  if (components.length === 0) {
    const nonComponentTypes = selection
      .filter(node => node.type !== 'COMPONENT')
      .map(node => node.type)
      .filter((type, index, arr) => arr.indexOf(type) === index); // unique

    throw new Error(
      `No components selected. Please select component icons. ` +
      `Found: ${nonComponentTypes.join(', ')}`
    );
  }

  let successCount = 0;
  const errors: string[] = [];

  for (const component of components) {
    try {
      // Save original name for tag generation
      const originalName = component.name;

      // Flatten all layers inside the component (only if no transparency and same colors)
      await flattenComponent(component);

      // Generate tags for search
      const tags = generateSearchTags(originalName);

      // Update component description only (do not rename component)
      component.description = tags;

      successCount++;
    } catch (error) {
      const errorMsg = `Failed to update component "${component.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg, error);
      errors.push(errorMsg);
    }
  }

  if (errors.length > 0 && successCount === 0) {
    // All failed
    throw new Error(`All components failed to update:\n${errors.join('\n')}`);
  }

  if (errors.length > 0) {
    // Some succeeded, some failed
    figma.notify(
      `Updated ${successCount} component(s). ${errors.length} failed:\n${errors.join('; ')}`,
      { timeout: 5000 }
    );
  }

  return successCount;
}

/**
 * Group selected icon components by category
 * Creates autolayout frames for each category and organizes icons into them
 */
async function groupIconsByCategory(): Promise<number> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('Please select icon components to group');
  }

  // Filter only ComponentNode
  const components = selection.filter(
    node => node.type === 'COMPONENT'
  ) as ComponentNode[];

  if (components.length === 0) {
    throw new Error('No components selected. Please select component icons.');
  }

  // Group components by category
  const categories: Map<string, ComponentNode[]> = new Map();

  for (const component of components) {
    const category = getIconCategory(component.name);
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(component);
  }

  // Sort categories alphabetically
  const sortedCategories = Array.from(categories.keys()).sort();

  // Find parent frame or use current page
  const parent = components[0].parent || figma.currentPage;

  // Calculate starting position (top-left of selection)
  let startX = Math.min(...components.map(c => c.x));
  let startY = Math.min(...components.map(c => c.y));

  // Create autolayout frame for each category
  let currentY = startY;
  let totalIcons = 0;

  for (const categoryName of sortedCategories) {
    const categoryIcons = categories.get(categoryName)!;

    // Sort icons within category alphabetically
    categoryIcons.sort((a, b) => a.name.localeCompare(b.name));

    // Create category frame with autolayout
    const categoryFrame = figma.createFrame();
    categoryFrame.name = categoryName;
    categoryFrame.layoutMode = 'HORIZONTAL';
    categoryFrame.layoutWrap = 'WRAP';
    categoryFrame.primaryAxisSizingMode = 'FIXED';
    categoryFrame.counterAxisSizingMode = 'AUTO';
    categoryFrame.resize(800, 100); // Fixed width, auto height
    categoryFrame.itemSpacing = 8;
    categoryFrame.counterAxisSpacing = 8;
    categoryFrame.paddingTop = 8;
    categoryFrame.paddingBottom = 8;
    categoryFrame.paddingLeft = 8;
    categoryFrame.paddingRight = 8;
    categoryFrame.fills = []; // Transparent background
    categoryFrame.x = startX;
    categoryFrame.y = currentY;

    // Add to parent
    if (parent && 'appendChild' in parent) {
      parent.appendChild(categoryFrame);
    }

    // Move icons into category frame
    for (const icon of categoryIcons) {
      categoryFrame.appendChild(icon);
      totalIcons++;
    }

    // Update Y position for next category
    currentY += categoryFrame.height + 40; // 40px gap between categories
  }

  return totalIcons;
}

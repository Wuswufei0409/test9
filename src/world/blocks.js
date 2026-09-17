// Block registry. Pure data. Texture names are resolved by the render layer
// from a procedural atlas.

export const Block = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  BEDROCK: 4,
  SAND: 5,
  WATER: 6,
  LOG: 7,
  LEAVES: 8,
  SNOW: 9, // snowy grass block (biome visual)
  SNOW_BLOCK: 10,
  GRAVEL: 11,
  SANDSTONE: 12,
  ICE: 13,
  COBBLESTONE: 14,
  PLANK: 15,
};

// Each block: { id, name, tex: {top, side, bottom}, opaque }
export const BLOCKS = {
  0: { id: 0, name: 'air', opaque: false },
  1: { id: 1, name: 'grass', tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, opaque: true },
  2: { id: 2, name: 'dirt', tex: { top: 'dirt', side: 'dirt', bottom: 'dirt' }, opaque: true },
  3: { id: 3, name: 'stone', tex: { top: 'stone', side: 'stone', bottom: 'stone' }, opaque: true },
  4: { id: 4, name: 'bedrock', tex: { top: 'bedrock', side: 'bedrock', bottom: 'bedrock' }, opaque: true },
  5: { id: 5, name: 'sand', tex: { top: 'sand', side: 'sand', bottom: 'sand' }, opaque: true },
  6: { id: 6, name: 'water', tex: { top: 'water', side: 'water', bottom: 'water' }, opaque: false, liquid: true },
  7: { id: 7, name: 'log', tex: { top: 'log_top', side: 'log_side', bottom: 'log_top' }, opaque: true },
  8: { id: 8, name: 'leaves', tex: { top: 'leaves', side: 'leaves', bottom: 'leaves' }, opaque: false, foliage: true },
  9: { id: 9, name: 'snowy_grass', tex: { top: 'snow', side: 'snow_grass_side', bottom: 'dirt' }, opaque: true },
  10: { id: 10, name: 'snow_block', tex: { top: 'snow', side: 'snow', bottom: 'snow' }, opaque: true },
  11: { id: 11, name: 'gravel', tex: { top: 'gravel', side: 'gravel', bottom: 'gravel' }, opaque: true },
  12: { id: 12, name: 'sandstone', tex: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' }, opaque: true },
  13: { id: 13, name: 'ice', tex: { top: 'ice', side: 'ice', bottom: 'ice' }, opaque: false, translucent: true },
  14: { id: 14, name: 'cobblestone', tex: { top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone' }, opaque: true },
  15: { id: 15, name: 'planks', tex: { top: 'plank', side: 'plank', bottom: 'plank' }, opaque: true },
};

export function blockById(id) {
  return BLOCKS[id] || BLOCKS[0];
}

export function isSolid(id) {
  const b = BLOCKS[id];
  return b && (b.opaque === true || id === Block.LEAVES);
}

// Does a block occlude an adjacent face? Opaque blocks occlude. Water/leave
// are non-occluding (transparent) so faces behind them still render.
export function occludes(id) {
  const b = BLOCKS[id];
  if (!b) return false;
  return b.opaque === true;
}

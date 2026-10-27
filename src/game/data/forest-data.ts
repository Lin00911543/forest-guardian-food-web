export type SpeciesId = 'plants' | 'insects' | 'rabbits' | 'birds' | 'raptors';

export type PopulationState = Record<SpeciesId, number>;

export interface SpeciesDefinition {
  id: SpeciesId;
  name: string;
  icon: string;
  color: number;
  colorCss: string;
  safeMin: number;
  safeMax: number;
}

export interface FoodWebEdge {
  food: SpeciesId;
  eater: SpeciesId;
}

export interface ActionCardDefinition {
  id: string;
  name: string;
  description: string;
  target: SpeciesId;
  amount: number;
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  target: SpeciesId;
  amount: number;
}

export const MAX_POPULATION = 10;
export const INITIAL_POPULATION: PopulationState = {
  plants: 6,
  insects: 4,
  rabbits: 4,
  birds: 3,
  raptors: 2,
};

export const SPECIES: SpeciesDefinition[] = [
  { id: 'plants', name: '植物', icon: 'species-plants', color: 0x39804b, colorCss: '#39804b', safeMin: 2, safeMax: 8 },
  { id: 'insects', name: '昆蟲', icon: 'species-insects', color: 0xe3a333, colorCss: '#e3a333', safeMin: 2, safeMax: 8 },
  { id: 'rabbits', name: '兔子', icon: 'species-rabbits', color: 0xb97c54, colorCss: '#b97c54', safeMin: 2, safeMax: 8 },
  { id: 'birds', name: '小型鳥類', icon: 'species-birds', color: 0x4d83ba, colorCss: '#4d83ba', safeMin: 2, safeMax: 8 },
  { id: 'raptors', name: '猛禽', icon: 'species-raptors', color: 0x855bb0, colorCss: '#855bb0', safeMin: 2, safeMax: 8 },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((species) => [species.id, species])) as Record<SpeciesId, SpeciesDefinition>;

export const FOOD_WEB: FoodWebEdge[] = [
  { food: 'plants', eater: 'insects' },
  { food: 'plants', eater: 'rabbits' },
  { food: 'insects', eater: 'birds' },
  { food: 'rabbits', eater: 'raptors' },
  { food: 'birds', eater: 'raptors' },
];

export const ACTION_CARDS: ActionCardDefinition[] = [
  { id: 'forest-restoration', name: '森林復育', description: '補植樹木，植物 +2', target: 'plants', amount: 2 },
  { id: 'insect-habitat', name: '昆蟲棲地', description: '保留枯木與花草，昆蟲 +2', target: 'insects', amount: 2 },
  { id: 'rabbit-shelter', name: '兔類庇護', description: '增加躲藏處，兔子 +2', target: 'rabbits', amount: 2 },
  { id: 'bird-nesting', name: '林鳥築巢', description: '保護樹洞巢位，小型鳥類 +2', target: 'birds', amount: 2 },
  { id: 'raptor-perch', name: '猛禽棲架', description: '設置安全棲架，猛禽 +2', target: 'raptors', amount: 2 },
  { id: 'shrub-restoration', name: '灌木補植', description: '補回林下植被，植物 +1', target: 'plants', amount: 1 },
  { id: 'remove-snares', name: '移除捕獸陷阱', description: '巡護巢區，小型鳥類 +1', target: 'birds', amount: 1 },
];

export const EVENTS: EventDefinition[] = [
  { id: 'dry-spell', name: '短暫乾旱', description: '缺水讓植物減少 2 格。', target: 'plants', amount: -2 },
  { id: 'warm-spring', name: '溫暖春天', description: '昆蟲活動增加 1 格。', target: 'insects', amount: 1 },
  { id: 'strong-wind', name: '強風吹襲', description: '部分鳥類離開棲地，減少 1 格。', target: 'birds', amount: -1 },
  { id: 'rabbit-boom', name: '兔子繁殖季', description: '兔子數量增加 2 格。', target: 'rabbits', amount: 2 },
  { id: 'cold-snap', name: '寒流來襲', description: '猛禽較難覓食，減少 1 格。', target: 'raptors', amount: -1 },
];

export const MISSION = {
  title: '守住森林的綠意',
  description: '五回合後，讓植物至少有 6 格，並讓五種生物都留在安全範圍。',
  targetPlants: 6,
};

export function isPopulationSafe(population: PopulationState): boolean {
  return SPECIES.every((species) => population[species.id] >= species.safeMin && population[species.id] <= species.safeMax);
}

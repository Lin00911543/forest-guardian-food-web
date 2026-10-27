import {
  ACTION_CARDS,
  INITIAL_POPULATION,
  MAX_POPULATION,
  MISSION,
  SPECIES,
  SPECIES_BY_ID,
  type ActionCardDefinition,
  type EventDefinition,
  type PopulationState,
  type SpeciesId,
  isPopulationSafe,
} from '../data/forest-data';

export interface RoundRecord {
  turn: number;
  eventId: string;
  cardId: string;
  before: PopulationState;
  eventDelta: PopulationState;
  actionDelta: PopulationState;
  afterDirect: PopulationState;
  cascadeDelta: PopulationState;
  after: PopulationState;
}

export interface RunRecord {
  strategy: 'A' | 'B';
  cards: string[];
  initial: PopulationState;
  turns: RoundRecord[];
  final: PopulationState;
  success: boolean;
  reachedZero: boolean;
}

function emptyPopulation(): PopulationState {
  return { plants: 0, insects: 0, rabbits: 0, birds: 0, raptors: 0 };
}

function copyPopulation(population: PopulationState): PopulationState {
  return { ...population };
}

function clampPopulation(value: number): number {
  return Math.max(0, Math.min(MAX_POPULATION, value));
}

function applySingleChange(population: PopulationState, target: SpeciesId, amount: number): PopulationState {
  const next = copyPopulation(population);
  next[target] = clampPopulation(next[target] + amount);
  return next;
}

function difference(before: PopulationState, after: PopulationState): PopulationState {
  return Object.fromEntries(SPECIES.map((species) => [species.id, after[species.id] - before[species.id]])) as PopulationState;
}

export function createRun(strategy: 'A' | 'B', cards: string[]): RunRecord {
  return {
    strategy,
    cards: [...cards],
    initial: copyPopulation(INITIAL_POPULATION),
    turns: [],
    final: copyPopulation(INITIAL_POPULATION),
    success: false,
    reachedZero: false,
  };
}

export function resolveRound(
  before: PopulationState,
  event: EventDefinition,
  card: ActionCardDefinition,
  turn: number,
): RoundRecord {
  const afterEvent = applySingleChange(before, event.target, event.amount);
  const eventDelta = difference(before, afterEvent);
  const afterAction = applySingleChange(afterEvent, card.target, card.amount);
  const actionDelta = difference(afterEvent, afterAction);

  // All food-web responses use the same post-event/post-card snapshot.
  // This keeps each turn deterministic and lets the learner inspect one link at a time.
  const response = emptyPopulation();
  if (afterAction.insects >= 6 || afterAction.rabbits >= 6) response.plants -= 1;
  else if (afterAction.insects <= 2 && afterAction.rabbits <= 2) response.plants += 1;

  if (afterAction.plants >= 7) response.insects += 1;
  else if (afterAction.plants <= 3) response.insects -= 1;

  if (afterAction.plants >= 7) response.rabbits += 1;
  else if (afterAction.plants <= 3) response.rabbits -= 1;

  if (afterAction.insects >= 6) response.birds += 1;
  else if (afterAction.insects <= 2) response.birds -= 1;

  if (afterAction.rabbits + afterAction.birds >= 10) response.raptors += 1;
  else if (afterAction.rabbits + afterAction.birds <= 4) response.raptors -= 1;

  const after = copyPopulation(afterAction);
  for (const species of SPECIES) after[species.id] = clampPopulation(afterAction[species.id] + response[species.id]);
  const cascadeDelta = difference(afterAction, after);

  return {
    turn,
    eventId: event.id,
    cardId: card.id,
    before: copyPopulation(before),
    eventDelta,
    actionDelta,
    afterDirect: copyPopulation(afterAction),
    cascadeDelta,
    after,
  };
}

export function completeRun(run: RunRecord): RunRecord {
  const final = run.turns.at(-1)?.after ?? run.initial;
  const reachedZero = SPECIES.some((species) => final[species.id] === 0);
  const success = !reachedZero && final.plants >= MISSION.targetPlants && isPopulationSafe(final);
  return { ...run, final: copyPopulation(final), reachedZero, success };
}

export function getActionCard(cardId: string): ActionCardDefinition {
  const card = ACTION_CARDS.find((entry) => entry.id === cardId);
  if (!card) throw new Error(`Unknown action card: ${cardId}`);
  return card;
}

export function getSpeciesName(speciesId: SpeciesId): string {
  return SPECIES_BY_ID[speciesId].name;
}

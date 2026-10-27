import Phaser from 'phaser';
import {
  ACTION_CARDS,
  EVENTS,
  FOOD_WEB,
  MISSION,
  MAX_POPULATION,
  SPECIES,
  SPECIES_BY_ID,
  type ActionCardDefinition,
  type PopulationState,
  type SpeciesId,
} from '../data/forest-data';
import {
  completeRun,
  createRun,
  getActionCard,
  resolveRound,
  type RoundRecord,
  type RunRecord,
} from '../systems/ecosystem-simulation';

const WIDTH = 1440;
const HEIGHT = 900;
const RUN_STORAGE_KEY = 'forest-guardian-first-run-v1';
const ASSET_BASE = import.meta.env.BASE_URL;

const COLORS = {
  forest: 0x17382c,
  forestLight: 0x315b41,
  paper: 0xf4eedc,
  paperDark: 0xe5dcc3,
  ink: 0x23382d,
  muted: 0x657365,
  line: 0xb8c1a9,
  safe: 0x9fc78b,
  danger: 0xd36a55,
  gold: 0xf0c36a,
  white: 0xfffdf6,
};

interface LearningOption {
  text: string;
  correct: boolean;
}

export class ForestScene extends Phaser.Scene {
  private selectedCardIds: string[] = [];
  private currentRun: RunRecord | null = null;
  private firstRun: RunRecord | null = null;
  private secondRun: RunRecord | null = null;
  private lastRoundSummary = '';
  private answeredComparison = false;
  private answerFeedback = '';
  private textMeasureContext: CanvasRenderingContext2D | null = null;

  constructor() {
    super('ForestScene');
  }

  preload(): void {
    this.load.image('grass-base', `${ASSET_BASE}assets/images/backgrounds/grass-base.png`);
    this.load.image('grass-texture', `${ASSET_BASE}assets/images/backgrounds/grass-texture.png`);
    this.load.image('forest-bush', `${ASSET_BASE}assets/images/tilesets/forest-bush.png`);
    this.load.image('tree-pine', `${ASSET_BASE}assets/images/tilesets/tree-pine.png`);
    this.load.image('species-plants', `${ASSET_BASE}assets/images/characters/plant-canopy.png`);
    this.load.image('species-insects', `${ASSET_BASE}assets/images/characters/insect-bee.png`);
    this.load.image('species-rabbits', `${ASSET_BASE}assets/images/characters/mammal-rabbit.png`);
    this.load.image('species-birds', `${ASSET_BASE}assets/images/characters/bird-crow.png`);
    this.load.image('species-raptors', `${ASSET_BASE}assets/images/characters/raptor-hawk.png`);
  }

  create(): void {
    this.textMeasureContext = document.createElement('canvas').getContext('2d');
    [
      'grass-base',
      'grass-texture',
      'forest-bush',
      'tree-pine',
      'species-plants',
      'species-insects',
      'species-rabbits',
      'species-birds',
      'species-raptors',
    ].forEach((key) => this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST));
    this.readSavedRun();
    this.renderIntro();
  }

  private readSavedRun(): void {
    try {
      const raw = window.localStorage.getItem(RUN_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as RunRecord | { firstRun?: RunRecord | null; secondRun?: RunRecord | null };
      if ('strategy' in saved) this.firstRun = saved;
      else {
        this.firstRun = saved.firstRun ?? null;
        this.secondRun = saved.secondRun ?? null;
      }
    } catch {
      this.firstRun = null;
      this.secondRun = null;
    }
  }

  private saveRuns(): void {
    if (!this.firstRun) return;
    try {
      window.localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify({ firstRun: this.firstRun, secondRun: this.secondRun }));
    } catch {
      // The current page can still complete both runs when storage is unavailable.
    }
  }

  private clearPage(): void {
    this.children.removeAll(true);
    this.drawShell();
  }

  private drawShell(): void {
    this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.forest).setOrigin(0, 0);
    this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'grass-base').setAlpha(0.07);
    this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'grass-texture').setAlpha(0.25);
    this.add.rectangle(20, 20, WIDTH - 40, HEIGHT - 40, COLORS.paper).setStrokeStyle(5, COLORS.forestLight).setOrigin(0, 0);

    for (let x = 74; x < WIDTH - 70; x += 52) {
      this.add.image(x, 43, 'forest-bush').setScale(2.1).setAlpha(0.3);
      this.add.image(x + 24, HEIGHT - 44, 'grass-texture').setScale(1.8).setAlpha(0.36);
    }
    this.add.image(55, 58, 'tree-pine').setScale(2.6).setAlpha(0.62);
    this.add.image(WIDTH - 55, 58, 'tree-pine').setScale(2.6).setFlipX(true).setAlpha(0.62);
  }

  private addText(
    x: number,
    y: number,
    text: string,
    fontSize = 24,
    color = '#23382d',
    options: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    const wrapWidth = options.wordWrap?.width;
    const wrappedText = wrapWidth ? this.wrapCjkText(text, wrapWidth, fontSize, options.fontStyle) : text;
    return this.add.text(x, y, wrappedText, {
      fontFamily: 'Huninn, sans-serif',
      fontSize: `${fontSize}px`,
      color,
      lineSpacing: 5,
      ...options,
    });
  }

  private wrapCjkText(text: string, maxWidth: number, fontSize: number, fontStyle?: string): string {
    const context = this.textMeasureContext;
    if (!context) return text;
    context.font = `${fontStyle === 'bold' ? 'bold ' : ''}${fontSize}px Huninn, sans-serif`;

    const wrappedParagraphs = text.split('\n').map((paragraph) => {
      if (!paragraph) return '';
      const lines: string[] = [];
      let line = '';
      for (const character of Array.from(paragraph)) {
        const candidate = line + character;
        if (line && context.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = character;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
      return lines.join('\n');
    });
    return wrappedParagraphs.join('\n');
  }

  private addPanel(x: number, y: number, width: number, height: number, fill = COLORS.white, stroke = COLORS.line): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(x, y, width, height, fill).setStrokeStyle(3, stroke);
  }

  private addButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void,
    variant: 'primary' | 'secondary' | 'muted' = 'primary',
    fontSize = 22,
  ): void {
    const colors = variant === 'primary'
      ? { fill: COLORS.forestLight, hover: 0x426f50, stroke: COLORS.forest, text: '#fffdf6' }
      : variant === 'secondary'
        ? { fill: 0xe7bd67, hover: 0xf0cc81, stroke: 0x8a6528, text: '#2e3c2d' }
        : { fill: 0xd7d8c8, hover: 0xe5e6d8, stroke: 0x909885, text: '#596454' };
    const rect = this.add.rectangle(x, y, width, height, colors.fill).setStrokeStyle(3, colors.stroke);
    const text = this.addText(x, y, label, fontSize, colors.text, {
      align: 'center',
      wordWrap: { width: width - 26 },
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(colors.hover));
    rect.on('pointerout', () => rect.setFillStyle(colors.fill));
    rect.on('pointerdown', action);
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', action);
  }

  private addHeader(title: string, subtitle: string, step?: string): void {
    this.addText(92, 76, title, 36, '#1d432f', { fontStyle: 'bold' });
    this.addText(94, 121, subtitle, 21, '#485848', { wordWrap: { width: 1000 } });
    if (step) {
      this.add.rectangle(WIDTH - 145, 91, 190, 44, 0xdfe9d3).setStrokeStyle(2, 0x7b9b69);
      this.addText(WIDTH - 145, 91, step, 20, '#315b41', { align: 'center' }).setOrigin(0.5);
    }
  }

  private renderIntro(): void {
    this.clearPage();
    this.addHeader('森林守護隊', '食物網行動卡｜國小中年級策略任務');

    this.addPanel(720, 530, 1250, 680, COLORS.white, 0x99aa8c);
    this.addText(720, 247, '一種生物改變，森林也會跟著改變。', 31, '#315b41', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.addText(720, 296, MISSION.description, 24, '#304536', { align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5);

    this.drawIntroFoodWeb();
    this.addText(720, 562, '植物供昆蟲與兔子取食；林鳥吃昆蟲；猛禽捕食兔子與林鳥。', 22, '#465747', {
      align: 'center',
      wordWrap: { width: 1030 },
    }).setOrigin(0.5);

    this.addPanel(720, 660, 1040, 134, 0xf1f5e8, 0xd0dac4);
    this.addText(720, 615, '遊戲方式', 24, '#315b41', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.addText(720, 670, '從 7 張保育行動卡選 5 張並安排順序。每回合先遇到固定事件，再用 1 張卡；完成後用相同事件重玩，讀圖比較兩種策略。', 22, '#394d3b', {
      align: 'center',
      wordWrap: { width: 970 },
    }).setOrigin(0.5);
    this.addText(720, 748, '族群以 0–10 的相對數量表示；箭頭由食物指向取食者。這是用來練習推理的簡化模型。', 20, '#4e5d4c', {
      align: 'center',
      wordWrap: { width: 1100 },
    }).setOrigin(0.5);

    let label = '開始策略 A';
    let action = () => this.startDraft();
    if (this.firstRun && !this.secondRun) {
      label = '繼續：開始策略 B';
      action = () => this.startDraft();
    } else if (this.firstRun && this.secondRun) {
      label = '查看上次策略比較';
      action = () => this.renderComparison();
    }
    this.addButton(720, 808, 330, 58, label, action, 'primary', 23);
    this.addText(720, 858, '點擊按鈕進入遊戲；每局約 5–10 分鐘。', 18, '#4c5b4a', { align: 'center' }).setOrigin(0.5);
  }

  private startNewComparison(): void {
    this.firstRun = null;
    this.secondRun = null;
    this.currentRun = null;
    this.answeredComparison = false;
    this.answerFeedback = '';
    try {
      window.localStorage.removeItem(RUN_STORAGE_KEY);
    } catch {
      // Starting a new comparison does not depend on local storage.
    }
    this.startDraft();
  }

  private startDraft(): void {
    this.selectedCardIds = [];
    this.renderDraft();
  }

  private renderDraft(): void {
    this.clearPage();
    const strategy = this.firstRun ? '策略 B' : '策略 A';
    this.addHeader('安排你的保育策略', `請先比較七張行動卡，再依使用順序點選五張。${strategy} 會沿用相同的初始族群與事件。`, strategy);

    const startX = 165;
    const cardWidth = 270;
    const gapX = 28;
    const centers = [0, 1, 2, 3, 4, 5, 6].map((index) => ({
      x: startX + (index % 4) * (cardWidth + gapX),
      y: index < 4 ? 278 : 444,
    }));

    ACTION_CARDS.forEach((card, index) => {
      const { x, y } = centers[index];
      const order = this.selectedCardIds.indexOf(card.id);
      this.drawActionCard(card, x, y, cardWidth, 138, order >= 0 ? order + 1 : null, () => this.toggleCard(card.id));
    });

    this.addPanel(720, 627, 1090, 88, 0xf0f4e7, 0xc6d3bb);
    const orderText = this.selectedCardIds.length
      ? `使用順序：${this.selectedCardIds.map((id, index) => `${index + 1}. ${getActionCard(id).name}`).join('　→　')}`
      : '選卡方式：依序點選五張卡，點已選卡可取消；卡片上的數字就是出牌順序。';
    this.addText(720, 628, `已選 ${this.selectedCardIds.length} / 5 張`, 21, '#315b41', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.addText(720, 660, orderText, 19, '#435545', {
      align: 'center',
      wordWrap: { width: 1010 },
    }).setOrigin(0.5);

    const ready = this.selectedCardIds.length === 5;
    this.addButton(720, 786, 300, 60, ready ? '開始五回合任務' : '請選滿五張卡', () => this.beginRun(), ready ? 'primary' : 'muted', 22);
    this.addButton(230, 786, 190, 50, '回到任務說明', () => this.renderIntro(), 'secondary', 18);
    if (!ready) {
      const disabledHint = this.addText(720, 837, '每回合使用一張，五回合內不重複。', 18, '#4e5d4c', { align: 'center' }).setOrigin(0.5);
      disabledHint.setAlpha(0.9);
    }
  }

  private toggleCard(cardId: string): void {
    const existingIndex = this.selectedCardIds.indexOf(cardId);
    if (existingIndex >= 0) this.selectedCardIds.splice(existingIndex, 1);
    else if (this.selectedCardIds.length < 5) this.selectedCardIds.push(cardId);
    this.renderDraft();
  }

  private drawActionCard(
    card: ActionCardDefinition,
    x: number,
    y: number,
    width: number,
    height: number,
    order: number | null,
    action: () => void,
    enabled = true,
    compact = false,
  ): void {
    const active = order !== null;
    const fill = active ? 0xe4edda : COLORS.white;
    const stroke = active ? 0x64835a : 0xc6cbb9;
    const rect = this.add.rectangle(x, y, width, height, fill).setStrokeStyle(active ? 4 : 2, stroke);
    this.add.image(x - width / 2 + (compact ? 28 : 42), y - (compact ? 6 : 16), SPECIES_BY_ID[card.target].icon)
      .setScale(compact ? 2.4 : 3.2);
    const title = this.addText(x - width / 2 + (compact ? 55 : 78), y - (compact ? 26 : 41), card.name, compact ? 20 : 22, '#263f2d', {
      fontStyle: 'bold',
      wordWrap: { width: width - (compact ? 66 : 92) },
    });
    const description = this.addText(x - width / 2 + (compact ? 55 : 78), y + (compact ? 1 : 0), card.description, compact ? 18 : 20, '#465747', {
      wordWrap: { width: width - (compact ? 68 : 94) },
    });
    if (order !== null) {
      this.add.rectangle(x + width / 2 - 17, y - height / 2 + 17, 32, 32, COLORS.gold).setStrokeStyle(2, 0x8a6528);
      this.addText(x + width / 2 - 17, y - height / 2 + 17, `${order}`, 20, '#3c432f', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    }

    if (!enabled) {
      if (!compact) {
        rect.setAlpha(0.48);
        title.setAlpha(0.55);
        description.setAlpha(0.55);
      }
      return;
    }
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(active ? 0xeaf1e1 : 0xf7f5eb));
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', action);
  }

  private beginRun(): void {
    if (this.selectedCardIds.length !== 5) return;
    const strategy = this.firstRun ? 'B' : 'A';
    this.currentRun = createRun(strategy, this.selectedCardIds);
    this.lastRoundSummary = '';
    this.renderPlay();
  }

  private renderPlay(): void {
    if (!this.currentRun) return;
    this.clearPage();

    const completedRounds = this.currentRun.turns.length;
    const turn = completedRounds + 1;
    const event = EVENTS[completedRounds];
    const card = completedRounds < 5 ? getActionCard(this.currentRun.cards[completedRounds]) : null;
    const strategy = `策略 ${this.currentRun.strategy}`;
    this.addHeader(`${strategy}｜森林保育任務`, '先讀取環境事件，再施行已排好順序的保育行動；下方圖示是本關簡化的食物網。', `回合 ${Math.min(turn, 5)} / 5`);

    this.addPanel(720, 187, 1280, 86, 0xeaf1df, 0xb7c7a9);
    if (completedRounds < 5 && event && card) {
      this.addText(115, 158, `環境事件 ${turn}`, 18, '#394d3b', { fontStyle: 'bold' });
      this.addText(260, 171, event.name, 25, '#315b41', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.addText(470, 171, event.description, 20, '#394d3b', { wordWrap: { width: 390 } }).setOrigin(0, 0.5);
      this.addText(890, 155, '本回合預計使用', 18, '#394d3b', { fontStyle: 'bold' });
      this.addText(890, 181, `${turn}. ${card.name}｜${card.description}`, 20, '#263f2d', {
        wordWrap: { width: 460 },
      });
    }
    if (this.lastRoundSummary) {
      this.addText(720, 232, this.lastRoundSummary, 18, '#344a38', {
        align: 'center',
        wordWrap: { width: 1180 },
      }).setOrigin(0.5);
    } else {
      this.addText(720, 232, '卡牌與事件先直接影響目標物種，再由食物網關係推演可能的連鎖變化。', 18, '#4b5b4b', { align: 'center', wordWrap: { width: 1180 } }).setOrigin(0.5);
    }

    this.drawFoodWeb(this.currentRun.final);
    this.drawHand();

    if (completedRounds < 5 && card) {
      const label = this.lastRoundSummary ? '查看變化後，進入下一回合' : `執行事件與第 ${turn} 張行動卡`;
      this.addButton(720, 849, 380, 46, label, () => {
        if (this.lastRoundSummary) {
          this.lastRoundSummary = '';
          this.renderPlay();
        } else {
          this.applyCurrentRound();
        }
      }, 'primary', 20);
    }
  }

  private drawFoodWeb(population: PopulationState): void {
    const positions: Record<SpeciesId, { x: number; y: number }> = {
      plants: { x: 155, y: 405 },
      insects: { x: 485, y: 355 },
      rabbits: { x: 485, y: 580 },
      birds: { x: 825, y: 355 },
      raptors: { x: 1185, y: 475 },
    };
    const graphics = this.add.graphics();
    graphics.lineStyle(5, 0x79906d, 0.9);
    const cardW = 218;
    const lines: Array<[number, number, number, number]> = [
      [positions.plants.x + cardW / 2, positions.plants.y, positions.insects.x - cardW / 2, positions.insects.y],
      [positions.plants.x + 68, positions.plants.y + 72, positions.rabbits.x - 102, positions.rabbits.y - 68],
      [positions.insects.x + cardW / 2, positions.insects.y, positions.birds.x - cardW / 2, positions.birds.y],
      [positions.birds.x + cardW / 2, positions.birds.y + 45, positions.raptors.x - 109, positions.raptors.y - 58],
      [positions.rabbits.x + cardW / 2, positions.rabbits.y - 12, positions.raptors.x - 109, positions.raptors.y + 50],
    ];
    for (const [x1, y1, x2, y2] of lines) this.drawArrow(graphics, x1, y1, x2, y2);

    SPECIES.forEach((species) => this.drawSpeciesNode(species.id, population[species.id], positions[species.id].x, positions[species.id].y));
    this.addText(720, 685, '箭頭方向：食物 → 取食者', 18, '#4b5b4b', { align: 'center' }).setOrigin(0.5);
  }

  private drawIntroFoodWeb(): void {
    const points: Record<SpeciesId, { x: number; y: number }> = {
      plants: { x: 290, y: 395 },
      insects: { x: 590, y: 345 },
      rabbits: { x: 590, y: 490 },
      birds: { x: 880, y: 345 },
      raptors: { x: 1172, y: 415 },
    };
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x79906d, 0.95);
    this.drawArrow(graphics, 322, 385, 558, 340);
    this.drawArrow(graphics, 322, 405, 558, 475);
    this.drawArrow(graphics, 622, 345, 848, 345);
    this.drawArrow(graphics, 912, 364, 1140, 400);
    this.drawArrow(graphics, 622, 486, 1140, 440);

    SPECIES.forEach((species) => {
      const point = points[species.id];
      this.add.image(point.x, point.y, species.icon).setScale(4);
      this.addText(point.x, point.y + 42, species.name, 21, '#263f2d', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    });
  }

  private drawArrow(graphics: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    graphics.lineBetween(x1, y1, x2, y2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 14;
    const spread = 0.58;
    graphics.lineBetween(x2, y2, x2 - head * Math.cos(angle - spread), y2 - head * Math.sin(angle - spread));
    graphics.lineBetween(x2, y2, x2 - head * Math.cos(angle + spread), y2 - head * Math.sin(angle + spread));
  }

  private drawSpeciesNode(speciesId: SpeciesId, value: number, x: number, y: number): void {
    const species = SPECIES_BY_ID[speciesId];
    const width = 218;
    const height = 180;
    this.add.rectangle(x, y, width, height, 0xfffdf6).setStrokeStyle(3, species.color);
    this.addText(x, y - 65, species.name, 22, '#263f2d', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.image(x, y - 15, species.icon).setScale(3.2);
    this.addText(x, y + 28, `${value} / ${MAX_POPULATION}`, 21, '#344a38', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.drawPopulationBar(x, y + 55, 164, 14, value, species.safeMin, species.safeMax, species.color);
    const inSafeRange = value >= species.safeMin && value <= species.safeMax;
    const status = value < species.safeMin
      ? '低於安全範圍'
      : value > species.safeMax
        ? '高於安全範圍'
        : `安全 ${species.safeMin}–${species.safeMax}`;
    this.addText(x, y + 78, status, 18, inSafeRange ? '#435845' : '#a13f32', { align: 'center', fontStyle: inSafeRange ? 'normal' : 'bold' }).setOrigin(0.5);
  }

  private drawPopulationBar(x: number, y: number, width: number, height: number, value: number, safeMin: number, safeMax: number, color: number): void {
    this.add.rectangle(x, y, width, height, 0xd9d9ce).setStrokeStyle(1, 0x8d9688);
    const safeWidth = width * (safeMax - safeMin) / MAX_POPULATION;
    const safeCenter = x - width / 2 + width * (safeMin + safeMax) / (MAX_POPULATION * 2);
    this.add.rectangle(safeCenter, y, safeWidth, height - 2, COLORS.safe);
    const markerX = x - width / 2 + width * value / MAX_POPULATION;
    this.add.rectangle(markerX, y, 8, height + 8, color).setStrokeStyle(1, 0x283c2e);
  }

  private drawHand(): void {
    if (!this.currentRun) return;
    const completed = this.currentRun.turns.length;
    this.addText(720, 714, '你的出牌順序', 20, '#394d3b', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    const centers = [155, 437.5, 720, 1002.5, 1285];
    this.currentRun.cards.forEach((cardId, index) => {
      const card = getActionCard(cardId);
      this.drawActionCard(card, centers[index], 772, 258, 94, index + 1, () => undefined, index === completed, true);
      if (index < completed) {
        this.add.rectangle(centers[index], 772, 258, 94, 0x425144, 0.12);
      }
      if (index === completed && completed < 5) {
        this.add.rectangle(centers[index], 772, 258, 94).setStrokeStyle(4, 0xa47c2e);
      }
    });
  }

  private applyCurrentRound(): void {
    if (!this.currentRun) return;
    const index = this.currentRun.turns.length;
    if (index >= 5) return;
    const event = EVENTS[index];
    const card = getActionCard(this.currentRun.cards[index]);
    const round = resolveRound(this.currentRun.final, event, card, index + 1);
    this.currentRun.turns.push(round);
    this.currentRun.final = { ...round.after };
    this.lastRoundSummary = this.formatRoundSummary(round, event.name, card.name);

    const reachedZero = SPECIES.some((species) => round.after[species.id] === 0);
    if (reachedZero || this.currentRun.turns.length === 5) {
      this.currentRun = completeRun(this.currentRun);
      this.finishRun();
      return;
    }
    this.renderPlay();
  }

  private formatRoundSummary(round: RoundRecord, eventName: string, cardName: string): string {
    const event = this.formatDelta(round.eventDelta);
    const card = this.formatDelta(round.actionDelta);
    const cascade = this.formatDelta(round.cascadeDelta);
    const reason = this.describeCascade(round);
    return `本回合結算｜${eventName}：${event}；${cardName}：${card}；食物網推演：${cascade}。原因：${reason}。`;
  }

  private formatDelta(delta: PopulationState): string {
    const changed = SPECIES.filter((species) => delta[species.id] !== 0)
      .map((species) => `${species.name} ${delta[species.id] > 0 ? '+' : '−'}${Math.abs(delta[species.id])}`);
    return changed.length ? changed.join('、') : '沒有改變';
  }

  private finishRun(): void {
    if (!this.currentRun) return;
    if (this.currentRun.strategy === 'A') {
      this.firstRun = this.currentRun;
      this.saveRuns();
    } else {
      this.secondRun = this.currentRun;
      this.saveRuns();
    }
    this.renderResult();
  }

  private renderResult(): void {
    if (!this.currentRun) return;
    this.clearPage();
    const run = this.currentRun;
    const strategyName = `策略 ${run.strategy}`;
    this.addHeader(`${strategyName}｜任務結果`, '看看最後的族群數量，再決定是否用另一種卡牌順序重玩。', strategyName);

    const status = run.success ? '任務成功！森林族群都在安全範圍內。' : run.reachedZero ? '有物種降到 0，保育區需要重新規劃。' : '任務尚未完成；你可以換一種選卡或順序再試。';
    this.addPanel(720, 265, 1050, 116, run.success ? 0xe4efdc : 0xf4e3d9, run.success ? 0x79a16b : 0xd48a72);
    this.addText(720, 240, status, 25, run.success ? '#315b41' : '#8b4c3d', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.addText(720, 284, `${MISSION.title}：植物至少 ${MISSION.targetPlants} 格，五種生物都需在安全範圍 2–8。`, 18, '#4f604f', { align: 'center' }).setOrigin(0.5);
    this.addText(720, 318, `本次出牌：${run.cards.map((cardId, index) => `${index + 1}. ${getActionCard(cardId).name}`).join('　→　')}`, 17, '#4f604f', {
      align: 'center',
      wordWrap: { width: 970 },
    }).setOrigin(0.5);
    this.addText(720, 360, this.lastRoundSummary, 15, '#52624f', {
      align: 'center',
      wordWrap: { width: 1200 },
    }).setOrigin(0.5);

    SPECIES.forEach((species, index) => {
      const x = 188 + index * 266;
      this.addPanel(x, 488, 220, 180, COLORS.white, species.color);
      this.add.image(x, 421, species.icon).setScale(3.1);
      this.addText(x, 459, species.name, 21, '#263f2d', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
      this.addText(x, 493, `${run.final[species.id]} 格`, 25, '#2d4433', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
      const inSafe = run.final[species.id] >= species.safeMin && run.final[species.id] <= species.safeMax;
      this.addText(x, 524, inSafe ? '在安全範圍' : '超出安全範圍', 17, inSafe ? '#3e6b38' : '#a13f32', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
      this.drawPopulationBar(x, 555, 150, 13, run.final[species.id], species.safeMin, species.safeMax, species.color);
    });

    const nextAction = run.strategy === 'A'
      ? () => this.startDraft()
      : () => this.renderComparison();
    const nextLabel = run.strategy === 'A' ? '用第二種策略再玩一次' : '比較兩次策略並解釋';
    this.addButton(720, 747, 360, 60, nextLabel, nextAction, 'primary', 21);
    this.addButton(240, 747, 185, 52, '查看食物網說明', () => this.renderIntro(), 'secondary', 17);
    this.addText(720, 812, '第二次會重設為相同初始數量與事件順序；請嘗試不同的選卡或出牌時機。', 19, '#465747', { align: 'center', wordWrap: { width: 1050 } }).setOrigin(0.5);
  }

  private renderComparison(): void {
    if (!this.firstRun || !this.secondRun) {
      this.renderIntro();
      return;
    }
    this.clearPage();
    this.addHeader('策略比較｜用圖表說明理由', '兩次使用相同的起始族群和事件；觀察卡牌策略造成的差異，再看食物網箭頭。', '學習回顧');

    this.drawPopulationGraph(365, 327, 620, 310, this.firstRun);
    this.drawPopulationGraph(1075, 327, 620, 310, this.secondRun);
    this.drawLegend(720, 530);

    this.addPanel(720, 710, 1280, 220, 0xf8f6ed, 0xc9ceb9);
    this.addText(720, 630, '想一想：哪個說法同時參考了圖表資料和食物網關係？', 23, '#315b41', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    const options = this.buildLearningOptions(this.firstRun, this.secondRun);
    const optionCenters = [280, 720, 1160];
    options.forEach((option, index) => {
      const y = 710;
      const rect = this.add.rectangle(optionCenters[index], y, 405, 132, 0xfffdf6).setStrokeStyle(2, 0xb8c1a9);
      const optionText = this.addText(optionCenters[index], y, `${String.fromCharCode(65 + index)}. ${option.text}`, 18, '#344a38', {
        align: 'center',
        wordWrap: { width: 365 },
      }).setOrigin(0.5);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(0xf0f4e7));
      rect.on('pointerout', () => rect.setFillStyle(0xfffdf6));
      rect.on('pointerdown', () => this.answerComparison(option.correct));
      optionText.setInteractive({ useHandCursor: true });
      optionText.on('pointerdown', () => this.answerComparison(option.correct));
    });

    if (this.answerFeedback) {
      this.addText(720, 797, this.answerFeedback, 19, this.answeredComparison ? '#32643b' : '#854731', { align: 'center' }).setOrigin(0.5);
      if (this.answeredComparison) {
        this.addButton(720, 844, 300, 48, '再比較一組策略', () => this.startNewComparison(), 'secondary', 18);
      }
    }
  }

  private drawPopulationGraph(x: number, y: number, width: number, height: number, run: RunRecord): void {
    this.addPanel(x, y, width, height, COLORS.white, 0xc1c8b5);
    this.addText(x, y - height / 2 + 29, `策略 ${run.strategy}`, 24, '#315b41', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5);

    const left = x - width / 2 + 58;
    const right = x + width / 2 - 22;
    const top = y - height / 2 + 60;
    const bottom = y + height / 2 - 44;
    const plotHeight = bottom - top;
    const plotWidth = right - left;

    const safeTop = bottom - plotHeight * 8 / MAX_POPULATION;
    const safeBottom = bottom - plotHeight * 2 / MAX_POPULATION;
    this.add.rectangle((left + right) / 2, (safeTop + safeBottom) / 2, plotWidth, safeBottom - safeTop, 0xddebd3, 0.65);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0xd6d9ce, 1);
    for (const value of [0, 2, 4, 6, 8, 10]) {
      const rowY = bottom - plotHeight * value / MAX_POPULATION;
      grid.lineBetween(left, rowY, right, rowY);
      this.addText(left - 24, rowY, `${value}`, 16, '#435545', { align: 'right' }).setOrigin(1, 0.5);
    }
    for (let turn = 0; turn <= 5; turn += 1) {
      const colX = left + plotWidth * turn / 5;
      grid.lineBetween(colX, top, colX, bottom);
      this.addText(colX, bottom + 14, `${turn}`, 16, '#435545', { align: 'center' }).setOrigin(0.5);
    }
    grid.lineStyle(2, 0x6b7868, 1);
    grid.lineBetween(left, top, left, bottom);
    grid.lineBetween(left, bottom, right, bottom);

    for (const species of SPECIES) {
      const values = [run.initial[species.id], ...run.turns.map((turn) => turn.after[species.id])];
      const points = values.map((value, turn) => ({
        x: left + plotWidth * turn / 5,
        y: bottom - plotHeight * value / MAX_POPULATION,
      }));
      const line = this.add.graphics();
      line.lineStyle(3, species.color, 1);
      for (let index = 0; index < points.length - 1; index += 1) {
        line.lineBetween(points[index].x, points[index].y, points[index + 1].x, points[index + 1].y);
      }
      points.forEach((point) => {
        const marker = this.add.circle(point.x, point.y, 4, species.color).setStrokeStyle(1, COLORS.white);
        marker.setDepth(1);
      });
    }

    this.addText(x - width / 2 + 20, y - height / 2 + 70, '族群', 16, '#435545').setOrigin(0.5).setAngle(-90);
    this.addText(x, y + height / 2 - 16, '回合', 16, '#435545', { align: 'center' }).setOrigin(0.5);
  }

  private drawLegend(x: number, y: number): void {
    const totalWidth = 850;
    const start = x - totalWidth / 2;
    const itemWidth = totalWidth / SPECIES.length;
    SPECIES.forEach((species, index) => {
      const itemX = start + itemWidth * index;
      this.add.rectangle(itemX + 18, y, 24, 5, species.color);
      this.addText(itemX + 37, y, species.name, 18, '#344a38').setOrigin(0, 0.5);
    });
    this.add.rectangle(1160, y + 22, 18, 12, 0xddebd3);
    this.addText(1177, y + 22, '安全範圍 2–8', 16, '#465747').setOrigin(0, 0.5);
  }

  private buildLearningOptions(first: RunRecord, second: RunRecord): LearningOption[] {
    let best: { turn: number; food: SpeciesId; eater: SpeciesId; strategy: 'A' | 'B'; foodGap: number; eaterGap: number; score: number } | null = null;
    for (let turn = 1; turn <= Math.min(first.turns.length, second.turns.length); turn += 1) {
      for (const edge of FOOD_WEB) {
        const firstTurn = first.turns[turn - 1].after;
        const secondTurn = second.turns[turn - 1].after;
        const foodGap = firstTurn[edge.food] - secondTurn[edge.food];
        const eaterGap = firstTurn[edge.eater] - secondTurn[edge.eater];
        if (foodGap === 0 || eaterGap === 0 || Math.sign(foodGap) !== Math.sign(eaterGap)) continue;
        const score = Math.abs(foodGap) + Math.abs(eaterGap);
        if (!best || score > best.score) {
          best = {
            turn,
            food: edge.food,
            eater: edge.eater,
            strategy: foodGap > 0 ? 'A' : 'B',
            foodGap: Math.abs(foodGap),
            eaterGap: Math.abs(eaterGap),
            score,
          };
        }
      }
    }

    const correct = best
      ? `第 ${best.turn} 回合，策略 ${best.strategy} 的${SPECIES_BY_ID[best.food].name}多 ${best.foodGap} 格，${SPECIES_BY_ID[best.eater].name}也多 ${best.eaterGap} 格；圖上的食物網顯示${SPECIES_BY_ID[best.eater].name}會取食${SPECIES_BY_ID[best.food].name}，可以用食物來源關係一起解讀。`
      : this.makeFallbackExplanation(first, second);
    const reversedEdge = FOOD_WEB[0];
    const options: LearningOption[] = [
      { text: correct, correct: true },
      { text: '兩次事件順序不一樣，所以族群變化不同；卡牌選擇不會影響結果。', correct: false },
      { text: `箭頭代表取食者被食物吃掉，因此${SPECIES_BY_ID[reversedEdge.food].name}會吃${SPECIES_BY_ID[reversedEdge.eater].name}。`, correct: false },
    ];
    const choiceHash = [...first.cards, ...second.cards].reduce(
      (sum, id) => sum + [...id].reduce((value, char) => value + char.charCodeAt(0), 0),
      0,
    );
    const answerIndex = choiceHash % options.length;
    return [options[answerIndex], options[(answerIndex + 1) % options.length], options[(answerIndex + 2) % options.length]];
  }

  private makeFallbackExplanation(first: RunRecord, second: RunRecord): string {
    let bestSpecies = SPECIES[0];
    let bestTurn = 1;
    let bestDiff = 0;
    for (const species of SPECIES) {
      for (let turn = 1; turn <= Math.min(first.turns.length, second.turns.length); turn += 1) {
        const diff = Math.abs(first.turns[turn - 1].after[species.id] - second.turns[turn - 1].after[species.id]);
        if (diff > bestDiff) {
          bestDiff = diff;
          bestSpecies = species;
          bestTurn = turn;
        }
      }
    }
    if (bestDiff === 0) return '兩次結果相同；圖表顯示只改變卡牌順序未造成族群差異，接著可以選擇不同的卡牌再比較。';
    const higher = first.turns[bestTurn - 1].after[bestSpecies.id] > second.turns[bestTurn - 1].after[bestSpecies.id] ? 'A' : 'B';
    const neighbor = FOOD_WEB.find((edge) => edge.food === bestSpecies.id || edge.eater === bestSpecies.id);
    const relation = neighbor
      ? `${SPECIES_BY_ID[neighbor.eater].name}會取食${SPECIES_BY_ID[neighbor.food].name}`
      : '不同生物間可能出現連鎖變化';
    return `第 ${bestTurn} 回合，策略 ${higher} 的${bestSpecies.name}較多 ${bestDiff} 格；先看這回合的事件與行動卡直接改變了誰，再用食物網中的「${relation}」關係尋找可能的連鎖影響。`;
  }

  private answerComparison(correct: boolean): void {
    if (this.answeredComparison) return;
    this.answeredComparison = correct;
    this.answerFeedback = correct
      ? '答對了！你根據兩次圖表資料，並用「食物 → 取食者」的關係解讀變化。'
      : '再觀察一次：兩次事件順序相同；箭頭由食物指向取食者。';
    this.renderComparison();
  }

  private describeCascade(round: RoundRecord): string {
    const causes: string[] = [];
    const state = round.afterDirect;
    const delta = round.cascadeDelta;

    if (delta.plants < 0) {
      const feeders = [
        ...(state.insects >= 6 ? ['昆蟲'] : []),
        ...(state.rabbits >= 6 ? ['兔子'] : []),
      ];
      if (feeders.length) causes.push(`${feeders.join('與')}較多，植物受取食`);
    } else if (delta.plants > 0) {
      causes.push('昆蟲和兔子都較少，植物有機會恢復');
    }
    if (delta.insects > 0) causes.push('植物充足，昆蟲食物較多');
    else if (delta.insects < 0) causes.push('植物偏少，昆蟲食物不足');
    if (delta.rabbits > 0) causes.push('植物充足，兔子食物較多');
    else if (delta.rabbits < 0) causes.push('植物偏少，兔子食物不足');
    if (delta.birds > 0) causes.push('昆蟲較多，林鳥食物較多');
    else if (delta.birds < 0) causes.push('昆蟲偏少，林鳥食物不足');
    if (delta.raptors > 0) causes.push('兔子和林鳥提供較多食物給猛禽');
    else if (delta.raptors < 0) causes.push('兔子和林鳥都偏少，猛禽食物不足');
    return causes.length ? causes.join('；') : '這些族群數量尚未跨過本關的推演門檻';
  }
}

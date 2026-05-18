export interface ChoiceOption {
  text: string;
  hint: string;
}

export interface Attributes {
  appearance: number;
  intelligence: number;
  constitution: number;
  wealth: number;
  happiness: number;
}

export interface PlayerState {
  player_id: string;
  name: string;
  gender: string;
  age: number;
  stage: string;
  attributes: Attributes;
  talents: string[];
  traits: string[];
  history: string[];
  flags: Record<string, any>;
  game_over: boolean;
}

export interface StartGameRequest {
  name: string;
  gender?: string;
  talents?: string[];
  attributes?: Partial<Attributes>;
}

export interface StartGameResponse {
  game_id: string;
  scene_description: string;
  state: PlayerState;
}

export interface ActionRequest {
  input: string;
}

export interface AttributeChanges {
  appearance: number;
  intelligence: number;
  constitution: number;
  wealth: number;
  happiness: number;
}

export interface ScoreDetail {
  strategy: number;
  logic: number;
  social: number;
  role_consistency: number;
  total: number;
  comments: string;
}

export interface ActionResponse {
  narrative: string;
  scene_title: string;
  scene_description: string;
  choices: ChoiceOption[];
  attribute_changes: AttributeChanges;
  score: ScoreDetail;
  new_age: number;
  state: PlayerState;
  summary?: GameSummary;
}

export interface GameSummary {
  short_comment: string;
  life_summary: string;
  personality_analysis: string;
}

export interface Message {
  id: string;
  type: 'system' | 'player' | 'choice';
  content: string;
  choices?: ChoiceOption[];
  attributeChanges?: AttributeChanges;
  score?: ScoreDetail;
  sceneTitle?: string;
  timestamp: Date;
}

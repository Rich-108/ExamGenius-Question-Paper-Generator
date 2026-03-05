export enum Difficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard"
}

export interface Subject {
  id: number;
  name: string;
}

export interface Question {
  id: number;
  subject_id: number;
  subject_name?: string;
  chapter: string;
  content: string;
  marks: number;
  difficulty: Difficulty;
}

export interface Paper {
  id: number;
  subject_id: number;
  subject_name: string;
  title: string;
  created_at: string;
  total_marks: number;
  difficulty_profile: string; // JSON string
  questions?: Question[];
}

export interface DifficultyProfile {
  Easy: number;
  Medium: number;
  Hard: number;
}

export interface DifficultyTemplate extends DifficultyProfile {
  id: number;
  name: string;
}

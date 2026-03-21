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

export interface AIPaperTemplate {
  id?: number;
  name: string;
  course_name_code?: string;
  date_duration?: string;
  test_type?: string;
  syllabus_text?: string;
  model_paper_text?: string;
  created_at?: string;
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

export interface AIPaper {
  id?: number;
  course_name_code: string;
  date_duration: string;
  test_type: string;
  content: string;
  model_paper_text?: string;
  is_draft?: boolean;
  created_at?: string;
}

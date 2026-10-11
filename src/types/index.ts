export type Gender = "male" | "female" | "secret";
export type GenderPreference = "male" | "female" | "any";
export type ParticipantStatus =
  | "waiting"
  | "paused"
  | "matching"
  | "matched"
  | "confirmed"
  | "playing"
  | "completed";

export interface Room {
  id: string;
  code: string;
  theme: string;
  status: "active" | "ended";
  capacity: number;
  host_token: string;
  created_at: string;
  expires_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  nickname: string;
  avatar: string;
  gender: Gender;
  gender_preference: GenderPreference;
  tags: string[];
  photo_path: string | null;
  photo_uploaded: boolean;
  status: ParticipantStatus;
  match_id: string | null;
  answers: QuizAnswers | null;
  ai_profile: Record<string, unknown> | null;
  created_at: string;
}

export interface QuizAnswers {
  q1?: string;
  q2?: string;
  q3?: string[];
  q4?: string[];
  q5?: string[];
  q6?: string;
  q7?: string;
  q8?: string[];
  q8Other?: string;
  q9?: string;
  q10?: string;
}

export interface Match {
  id: string;
  room_id: string;
  participant_a: string;
  participant_b: string;
  status: "pending" | "confirmed" | "rejected" | "completed";
  score: number;
  reason: string;
  anchor: string;
  icebreaker: string;
  confirmed_a: boolean;
  confirmed_b: boolean;
  created_at: string;
}

export interface Game {
  id: string;
  match_id: string;
  type: string;
  status: "active" | "completed";
  questions: string[];
  answers: Record<string, string>;
  review: string | null;
  card: Record<string, unknown> | null;
}

export interface RoomState {
  room: Room;
  participants: Participant[];
  matches: Match[];
}

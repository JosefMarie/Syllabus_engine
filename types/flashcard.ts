export type FlashcardMastery = "new" | "learning" | "mastered";

export interface CourseFlashcard {
  id: string;
  syllabusId: string;
  courseCode: string;
  topicTitle: string;
  frontPrompt: string; // Question or concept
  backAnswer: string; // Explanation or code example
  tags?: string[];
}

export interface StudentFlashcardProgress {
  cardId: string;
  studentUid: string;
  mastery: FlashcardMastery;
  reviewCount: number;
  lastReviewedAt: string;
}

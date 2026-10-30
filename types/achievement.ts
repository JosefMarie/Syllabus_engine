export type BadgeRarity = "bronze" | "silver" | "gold" | "diamond";

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  xpReward: number;
}

export interface StudentAchievementRecord {
  badgeId: string;
  studentUid: string;
  earnedAt: string;
}

export const ACADEMY_BADGES: AchievementBadge[] = [
  {
    id: "first_step",
    title: "First Step Into Code",
    description: "Mark your first subtopic complete on any course syllabus.",
    icon: "🚀",
    rarity: "bronze",
    xpReward: 25
  },
  {
    id: "syllabus_finisher",
    title: "Master Scholar",
    description: "Reach 100% completion on all subtopics of an accredited syllabus.",
    icon: "📚",
    rarity: "gold",
    xpReward: 150
  },
  {
    id: "code_warrior",
    title: "Arena Gladiator",
    description: "Successfully solve your first weekly algorithm puzzle in the Coding Arena.",
    icon: "⚔️",
    rarity: "bronze",
    xpReward: 50
  },
  {
    id: "arena_grandmaster",
    title: "Algorithm Grandmaster",
    description: "Conquer 3 or more coding challenges with 100% test cases passed.",
    icon: "👑",
    rarity: "diamond",
    xpReward: 200
  },
  {
    id: "exam_ace",
    title: "Perfect Score Ace",
    description: "Achieve a flawless 100% score on any course examination.",
    icon: "🎯",
    rarity: "silver",
    xpReward: 100
  },
  {
    id: "assignment_hero",
    title: "Project Practitioner",
    description: "Submit 3 or more graded coursework assignments.",
    icon: "📝",
    rarity: "silver",
    xpReward: 75
  },
  {
    id: "campus_innovator",
    title: "Campus Innovator",
    description: "Submit a constructive proposal to the Student Suggestion Box.",
    icon: "💡",
    rarity: "bronze",
    xpReward: 30
  },
  {
    id: "laser_focus",
    title: "Undivided Attention",
    description: "Maintain a clean record with 0 inattention strikes across your academic semester.",
    icon: "🛡️",
    rarity: "gold",
    xpReward: 120
  }
];

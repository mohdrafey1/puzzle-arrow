import { UserStats } from "./storage";

export interface Achievement {
    id: string;
    title: string;
    description: string;
    arrowReward: number;
    requiredStat: keyof UserStats;
    requiredValue: number;
}

export const ACHIEVEMENTS: Achievement[] = [
    // Campaign Levels
    {
        id: "campaign_10",
        title: "Journey Begins",
        description: "Complete 10 Campaign Levels",
        arrowReward: 100,
        requiredStat: "levelsCompleted",
        requiredValue: 10,
    },
    {
        id: "campaign_50",
        title: "Puzzle Solver",
        description: "Complete 50 Campaign Levels",
        arrowReward: 500,
        requiredStat: "levelsCompleted",
        requiredValue: 50,
    },
    {
        id: "campaign_100",
        title: "Pathfinder Master",
        description: "Complete 100 Campaign Levels",
        arrowReward: 1000,
        requiredStat: "levelsCompleted",
        requiredValue: 100,
    },
    {
        id: "campaign_200",
        title: "Grandmaster",
        description: "Complete 200 Campaign Levels",
        arrowReward: 2000,
        requiredStat: "levelsCompleted",
        requiredValue: 200,
    },
    {
        id: "campaign_300",
        title: "Legendary Solver",
        description: "Complete 300 Campaign Levels",
        arrowReward: 3000,
        requiredStat: "levelsCompleted",
        requiredValue: 300,
    },
    {
        id: "campaign_400",
        title: "Mythic Genius",
        description: "Complete 400 Campaign Levels",
        arrowReward: 4000,
        requiredStat: "levelsCompleted",
        requiredValue: 400,
    },
    {
        id: "campaign_500",
        title: "Puzzle God",
        description: "Complete 500 Campaign Levels",
        arrowReward: 5000,
        requiredStat: "levelsCompleted",
        requiredValue: 500,
    },

    // Community Levels
    {
        id: "community_10",
        title: "Community Explorer",
        description: "Beat 10 Community Levels",
        arrowReward: 150,
        requiredStat: "communityLevelsBeaten",
        requiredValue: 10,
    },
    {
        id: "community_50",
        title: "Community Master",
        description: "Beat 50 Community Levels",
        arrowReward: 500,
        requiredStat: "communityLevelsBeaten",
        requiredValue: 50,
    },
    {
        id: "community_100",
        title: "Community Legend",
        description: "Beat 100 Community Levels",
        arrowReward: 1200,
        requiredStat: "communityLevelsBeaten",
        requiredValue: 100,
    },

    // Created Levels
    {
        id: "create_1",
        title: "Architect",
        description: "Create Your First Level",
        arrowReward: 150,
        requiredStat: "levelsCreated",
        requiredValue: 1,
    },
    {
        id: "create_10",
        title: "Level Designer",
        description: "Create 10 Levels",
        arrowReward: 500,
        requiredStat: "levelsCreated",
        requiredValue: 10,
    },
    {
        id: "create_50",
        title: "Master Builder",
        description: "Create 50 Levels",
        arrowReward: 2000,
        requiredStat: "levelsCreated",
        requiredValue: 50,
    },
];

/**
 * Compares current stats against all achievements, filters out those already unlocked,
 * and identifies which properties have reached the threshold.
 */
export function checkNewAchievements(
    stats: UserStats,
    unlockedIds: string[],
): Achievement[] {
    return ACHIEVEMENTS.filter((ach) => {
        // Skip if already unlocked
        if (unlockedIds.includes(ach.id)) return false;

        // Use custom array sizing if the required dimension is the ID payload map.
        if (ach.requiredStat === "completedCommunityLevelIds") {
            return stats.completedCommunityLevelIds.length >= ach.requiredValue;
        }

        return (stats[ach.requiredStat] as number) >= ach.requiredValue;
    });
}

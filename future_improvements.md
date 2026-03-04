# Future Improvements

## Leaderboard Scaling

Currently, the leaderboard fetches the entire `leaderboard` node from Firebase Realtime Database and sorts it locally on the user's device. This works perfectly for hundreds of users, but will consume too much bandwidth and slow down the app if the player base grows to thousands of users.

To future-proof the leaderboard, we need to offload the sorting and limiting to Firebase.

### Steps to Implement

1.  **Update Firebase Rules:**
    Go to your Firebase Console → Realtime Database → **Rules** tab, and add the `".indexOn": ["level"]` rule to the `leaderboard` node. The complete rules should look like this:

    ```json
    {
        "rules": {
            "leaderboard": {
                ".read": true,
                ".write": true,
                ".indexOn": ["level"]
            }
        }
    }
    ```

    _Why this is needed:_ Without this index rule, Firebase mobile SDKs will silently hang when trying to use `orderByChild("level")`.

2.  **Update Data Fetching Logic:**
    Once the rule is published in the Firebase Console, update the query logic in `utils/leaderboard.ts` to only fetch the top 100 players.

    ```typescript
    import { query, orderByChild, limitToLast } from "firebase/database";

    // In fetchLeaderboard() and subscribeLeaderboard()
    // Change this:
    const leaderboardRef = ref(db, "leaderboard");

    // To this:
    const leaderboardRef = query(
        ref(db, "leaderboard"),
        orderByChild("level"),
        limitToLast(100),
    );
    ```

    _Note:_ Because Firebase `orderByChild` sorts in ascending order (lowest level first), `limitToLast(100)` correctly grabs the 100 players with the highest levels. The client-side `.sort((a,b) => b.level - a.level)` will still be needed to reverse the array so the highest level is at index 0.

## Other Potential Improvements

- Add pagination to the leaderboard (Top 100, Top 200, etc.)
- Add a "My Rank" feature that queries specifically for the current user's rank relative to others if they fall outside the top 100.

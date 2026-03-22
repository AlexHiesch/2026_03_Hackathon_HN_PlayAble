export function reduceLives(context, obstacleType = 0) {
    context.forest_lives -= 1;

    if (context.forest_obstacles_hit === null) {
        context.forest_obstacles_hit = [];
    }
    if (obstacleType > 0) {
        context.forest_obstacles_hit.push(obstacleType);
    }

    if (context.forest_lives === 0) {
        return 'TalkingGameOver';
    } else {
        return 'TalkingAfterHurt';
    }
}

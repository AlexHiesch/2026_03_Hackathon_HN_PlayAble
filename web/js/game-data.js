export class GameData {
    constructor(country) {
        this.country = country;

        this.forest_score = 0;
        this.forest_lives = 3;
        this.forest_parallax_pos = 0;
        this.forest_sacks = [];
        this.forest_obstacles = [];
        this.forest_leaves = [];
        this.forest_controls_inverted = false;

        this.forest_normal_sacks_collected = 0;
        this.forest_golden_sacks_collected = 0;
        this.forest_reached_end = false;
        this.forest_obstacles_hit = null;

        this.cave_selected_rope = 0;
        this.cave_win_type = 0;

        // Audio instance IDs
        this.forest_bg_atmosphere_id = null;
        this.cave_score_counter_id = null;
        this.cave_fanfare_id = null;
        this.cave_bg_music_id = null;
        this.cave_stemning_id = null;
        this.scoreboard_score_counter_id = null;
    }
}

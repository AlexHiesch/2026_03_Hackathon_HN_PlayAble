import { loadFrames, loadSync, loadAudioAsset, loadStaticImage } from '../resource.js';

function makeBlackTransparent(img) {
    if (!img) return img;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 0 && d[i+1] === 0 && d[i+2] === 0) {
            d[i+3] = 0;
        }
    }
    cx.putImageData(data, 0, 0);
    return c; // Return canvas (works as drawImage source)
}

export const ForestResources = {
    // Graphics
    bg_hillsday: [], bg_trees: [], bg_ground: [], grass: [],
    leaves1: [], leaves2: [], bg_gradient: null, end_mountain: [],
    hugo_side: [], hugo_crawl: [], hugo_jump: [], hugo_telllives: [],
    hand1: [], hand2: [], tree: [], lone_tree: [], rock: [],
    sack: [], trap: [], catapult: [], hit_rock: [], hugo_lookrock: [],
    hit_rock_sync: [], catapult_fly: [], catapult_fall: [],
    catapult_airtalk: [], catapult_hang: [], catapult_hangspeak: [],
    hugohitlog: [], hugohitlog_talk: [], hugo_traptalk: [], hugo_traphurt: [],
    score_numbers: [], hugo_lives: [], sculla_hand1: [], sculla_hand2: [],
    arrows: [], scoreboard: null,
    inverted_arrows: null, hint_overlay_dos: null, hint_overlay_ocho: null,

    // Syncs
    sync_start: [], sync_rock: [], sync_dieonce: [], sync_trap: [],
    sync_lastlife: [], sync_catapult_talktop: [], sync_catapult_hang: [],
    sync_hitlog: [], sync_gameover: [], sync_levelcompleted: [],

    // Audio URLs
    sfx_bg_atmosphere: null, sfx_lightning_warning: null, sfx_hugo_knock: null,
    sfx_hugo_hittrap: null, sfx_hugo_launch: null, sfx_sack_normal: null,
    sfx_sack_bonus: null, sfx_tree_swush: null, sfx_hugo_hitlog: null,
    sfx_catapult_eject: null, sfx_birds: null, sfx_hugo_hitscreen: null,
    sfx_hugo_screenklir: null, sfx_hugo_crash: null, sfx_hugo_hangstart: null,
    sfx_hugo_hang: null,
    sfx_hugo_walk0: null, sfx_hugo_walk1: null, sfx_hugo_walk2: null,
    sfx_hugo_walk3: null, sfx_hugo_walk4: null,
    sfx_hint_dos: null, sfx_hint_ocho: null,

    speak_start: null, speak_rock: null, speak_dieonce: null, speak_trap: null,
    speak_lastlife: null, speak_catapult_up: null, speak_catapult_hit: null,
    speak_catapult_talktop: null, speak_catapult_down: null,
    speak_catapult_hang: null, speak_hitlog: null,
    speak_gameover: null, speak_levelcompleted: null,
};

export async function initForestResources() {
    const R = ForestResources;

    // Graphics
    R.bg_hillsday = await loadFrames('forest', 'hillsday');
    // Make black pixels transparent (matching Python game behavior)
    for (let i = 0; i < R.bg_hillsday.length; i++) {
        R.bg_hillsday[i] = makeBlackTransparent(R.bg_hillsday[i]);
    }
    R.bg_trees = await loadFrames('forest', 'paratrees');
    R.bg_ground = await loadFrames('forest', 'paraground');
    R.grass = await loadFrames('forest', 'grass');
    R.leaves1 = await loadFrames('forest', 'leaves1');
    R.leaves2 = await loadFrames('forest', 'leaves2');
    R.end_mountain = await loadFrames('forest', 'end_mountain');
    R.hugo_side = await loadFrames('forest', 'hugo_side');
    R.hugo_crawl = await loadFrames('forest', 'hugo_crawl');
    R.hugo_jump = await loadFrames('forest', 'hugo_jump');
    R.hugo_telllives = await loadFrames('forest', 'hugo_telllives');
    R.hand1 = await loadFrames('forest', 'hand1');
    R.hand2 = await loadFrames('forest', 'hand2');
    R.tree = await loadFrames('forest', 'tree');
    R.lone_tree = await loadFrames('forest', 'lone_tree');
    R.rock = await loadFrames('forest', 'rock');
    R.sack = await loadFrames('forest', 'sack');
    R.trap = await loadFrames('forest', 'trap');
    R.catapult = await loadFrames('forest', 'catapult');
    R.hit_rock = await loadFrames('forest', 'hit_rock');
    R.hugo_lookrock = await loadFrames('forest', 'hugo_lookrock');
    R.hit_rock_sync = await loadFrames('forest', 'hit_rock_sync');
    R.catapult_fly = await loadFrames('forest', 'catapult_fly');
    R.catapult_fall = await loadFrames('forest', 'catapult_fall');
    R.catapult_airtalk = await loadFrames('forest', 'catapult_airtalk');
    R.catapult_hang = await loadFrames('forest', 'catapult_hang');
    R.catapult_hangspeak = await loadFrames('forest', 'catapult_hangspeak');
    R.hugohitlog = await loadFrames('forest', 'hugohitlog');
    R.hugohitlog_talk = await loadFrames('forest', 'hugohitlog_talk');
    R.hugo_traptalk = await loadFrames('forest', 'hugo_traptalk');
    R.hugo_traphurt = await loadFrames('forest', 'hugo_traphurt');
    R.score_numbers = await loadFrames('forest', 'score_numbers');
    R.hugo_lives = await loadFrames('forest', 'hugo_lives');
    R.sculla_hand1 = await loadFrames('forest', 'sculla_hand1');
    R.sculla_hand2 = await loadFrames('forest', 'sculla_hand2');

    // Static images
    R.bg_gradient = await loadStaticImage('fixed_assets/gradient.bmp');
    R.scoreboard = await loadStaticImage('forest/scoreboard.png');
    R.inverted_arrows = await loadStaticImage('fixed_assets/inverted_arrows.png');
    R.hint_overlay_dos = await loadStaticImage('fixed_assets/hint_dos.png');
    R.hint_overlay_ocho = await loadStaticImage('fixed_assets/hint_ocho.png');

    // Arrow images
    R.arrows = [];
    for (let i = 0; i < 4; i++) {
        R.arrows.push(await loadStaticImage(`fixed_assets/arrows.cgf_${i}.png`));
    }

    // Syncs
    R.sync_start = await loadSync('forest', 'sync_start');
    R.sync_rock = await loadSync('forest', 'sync_rock');
    R.sync_dieonce = await loadSync('forest', 'sync_dieonce');
    R.sync_trap = await loadSync('forest', 'sync_trap');
    R.sync_lastlife = await loadSync('forest', 'sync_lastlife');
    R.sync_catapult_talktop = await loadSync('forest', 'sync_catapult_talktop');
    R.sync_catapult_hang = await loadSync('forest', 'sync_catapult_hang');
    R.sync_hitlog = await loadSync('forest', 'sync_hitlog');
    R.sync_gameover = await loadSync('forest', 'sync_gameover');
    R.sync_levelcompleted = await loadSync('forest', 'sync_levelcompleted');

    // Audio
    R.sfx_bg_atmosphere = await loadAudioAsset('forest', 'sfx_bg_atmosphere');
    R.sfx_lightning_warning = await loadAudioAsset('forest', 'sfx_lightning_warning');
    R.sfx_hugo_knock = await loadAudioAsset('forest', 'sfx_hugo_knock');
    R.sfx_hugo_hittrap = await loadAudioAsset('forest', 'sfx_hugo_hittrap');
    R.sfx_hugo_launch = await loadAudioAsset('forest', 'sfx_hugo_launch');
    R.sfx_sack_normal = await loadAudioAsset('forest', 'sfx_sack_normal');
    R.sfx_sack_bonus = await loadAudioAsset('forest', 'sfx_sack_bonus');
    R.sfx_tree_swush = await loadAudioAsset('forest', 'sfx_tree_swush');
    R.sfx_hugo_hitlog = await loadAudioAsset('forest', 'sfx_hugo_hitlog');
    R.sfx_catapult_eject = await loadAudioAsset('forest', 'sfx_catapult_eject');
    R.sfx_birds = await loadAudioAsset('forest', 'sfx_birds');
    R.sfx_hugo_hitscreen = await loadAudioAsset('forest', 'sfx_hugo_hitscreen');
    R.sfx_hugo_screenklir = await loadAudioAsset('forest', 'sfx_hugo_screenklir');
    R.sfx_hugo_crash = await loadAudioAsset('forest', 'sfx_hugo_crash');
    R.sfx_hugo_hangstart = await loadAudioAsset('forest', 'sfx_hugo_hangstart');
    R.sfx_hugo_hang = await loadAudioAsset('forest', 'sfx_hugo_hang');
    R.sfx_hugo_walk0 = await loadAudioAsset('forest', 'sfx_hugo_walk0');
    R.sfx_hugo_walk1 = await loadAudioAsset('forest', 'sfx_hugo_walk1');
    R.sfx_hugo_walk2 = await loadAudioAsset('forest', 'sfx_hugo_walk2');
    R.sfx_hugo_walk3 = await loadAudioAsset('forest', 'sfx_hugo_walk3');
    R.sfx_hugo_walk4 = await loadAudioAsset('forest', 'sfx_hugo_walk4');

    R.speak_start = await loadAudioAsset('forest', 'speak_start');
    R.speak_rock = await loadAudioAsset('forest', 'speak_rock');
    R.speak_dieonce = await loadAudioAsset('forest', 'speak_dieonce');
    R.speak_trap = await loadAudioAsset('forest', 'speak_trap');
    R.speak_lastlife = await loadAudioAsset('forest', 'speak_lastlife');
    R.speak_catapult_up = await loadAudioAsset('forest', 'speak_catapult_up');
    R.speak_catapult_hit = await loadAudioAsset('forest', 'speak_catapult_hit');
    R.speak_catapult_talktop = await loadAudioAsset('forest', 'speak_catapult_talktop');
    R.speak_catapult_down = await loadAudioAsset('forest', 'speak_catapult_down');
    R.speak_catapult_hang = await loadAudioAsset('forest', 'speak_catapult_hang');
    R.speak_hitlog = await loadAudioAsset('forest', 'speak_hitlog');
    R.speak_gameover = await loadAudioAsset('forest', 'speak_gameover');
    R.speak_levelcompleted = await loadAudioAsset('forest', 'speak_levelcompleted');

    console.log('Forest resources loaded');
}

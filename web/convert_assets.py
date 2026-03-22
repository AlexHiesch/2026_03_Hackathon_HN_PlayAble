#!/usr/bin/env python3
"""
Asset converter for Hugo web port.
Extracts game assets from the Gold edition RAR, converts proprietary formats
(CGF, TIL, LZP, OOS) to web-friendly formats (PNG, JSON), and converts
audio/video to MP3/MP4.

Usage:
    python convert_assets.py [--rar PATH_TO_RAR]

If --rar is not specified, looks for the RAR in the parent directory.
"""

import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

# ── Binary helpers ──────────────────────────────────────────────────────────

def _get_int(data, offset):
    return struct.unpack_from('<i', data, offset)[0]

def _get_short(data, offset):
    return struct.unpack_from('<h', data, offset)[0]

def _palette_from_data(data, offset):
    colors = []
    for _ in range(256):
        colors.append((data[offset], data[offset + 1], data[offset + 2], 255))
        offset += 3
    return colors

def _palette_from_alpha_data(data, offset):
    colors = []
    for _ in range(256):
        colors.append((data[offset + 2], data[offset + 1], data[offset], 255))
        offset += 4
    return colors

# ── CGF decoder ─────────────────────────────────────────────────────────────

def _cgf_parse_line(pixels, data, idx, length, x, y, palette, width):
    i = 0
    while i < length:
        v = data[idx + i]
        i += 1
        if v == 0:
            off = data[idx + i]
            if off == 0:
                return
            x += off
        elif v == 1:
            count = data[idx + i]
            for _ in range(count):
                i += 1
                pal_idx = data[idx + i]
                pos = x + width * y
                pixels[pos * 4:pos * 4 + 4] = bytes(palette[pal_idx])
                x += 1
                i += 1
        elif v == 2:
            count = data[idx + i]
            i += 1
            value = data[idx + i]
            i += 1
            for _ in range(count):
                pos = x + width * y
                pixels[pos * 4:pos * 4 + 4] = bytes(palette[value])
                x += 1
        elif v == 3:
            count = data[idx + i]
            for _ in range(count):
                i += 1
                pal_idx = data[idx + i]
                pos = x + width * y
                pixels[pos * 4:pos * 4 + 4] = bytes(palette[pal_idx])
                x += 1
        elif v == 4:
            count = data[idx + i]
            i += 1
            value = data[idx + i]
            for _ in range(count):
                pos = x + width * y
                pixels[pos * 4:pos * 4 + 4] = bytes(palette[value])
                x += 1
        i += 1


def decode_cgf(file_content, file_path):
    parent_dir = os.path.dirname(file_path)
    palette = None
    try:
        for fname in os.listdir(parent_dir):
            if fname.lower().endswith('.til'):
                with open(os.path.join(parent_dir, fname), 'rb') as f:
                    til_data = f.read()
                palette = _palette_from_data(til_data, 0x20)
                break
    except OSError:
        pass

    if palette is None:
        if len(file_content) < 0x400:
            return []
        palette = _palette_from_alpha_data(file_content, len(file_content) - 0x400)

    total_frames = _get_int(file_content, 8)
    images = []

    for frame_idx in range(total_frames):
        meta_offset = 7 * 4 + frame_idx * 6 * 4
        width = _get_int(file_content, meta_offset + 8)
        height = _get_int(file_content, meta_offset + 12)
        payload_offset = _get_int(file_content, meta_offset + 20)

        if width <= 0 or height <= 0:
            images.append(Image.new('RGBA', (1, 1), (0, 0, 0, 0)))
            continue

        pixels = bytearray(width * height * 4)
        start_offset = 7 * 4 + total_frames * 6 * 4 + payload_offset

        for y in range(height):
            if start_offset >= len(file_content):
                break
            line_len = _get_int(file_content, start_offset)
            _cgf_parse_line(pixels, file_content, start_offset + 4, line_len - 4, 0, y, palette, width)
            start_offset += line_len

        img = Image.frombytes('RGBA', (width, height), bytes(pixels))
        images.append(img)

    return images

# ── TIL decoder ─────────────────────────────────────────────────────────────

def decode_til(file_content, file_path):
    palette = _palette_from_data(file_content, 0x20)
    total_width = _get_short(file_content, 8)
    total_height = _get_short(file_content, 10)
    total_width_tiles = file_content[0x15]
    total_height_tiles = file_content[0x17]
    tile_width = total_width // total_width_tiles
    tile_height = total_height // total_height_tiles
    total_frames = _get_short(file_content, 6) + 2
    delta = total_width_tiles * total_height_tiles * 2
    tile_data_offset = total_frames * delta + 0x320

    images = []
    for frame_idx in range(total_frames):
        frame_offset = 0x320 + frame_idx * delta
        pixels = bytearray(total_width * total_height * 4)
        valid = True

        for l in range(total_width_tiles * total_height_tiles):
            tile_id = _get_short(file_content, frame_offset)
            frame_offset += 2
            x_off = (l % total_width_tiles) * tile_width
            y_off = (l // total_width_tiles) * tile_height
            curr_offset = tile_data_offset + tile_id * tile_height * tile_width

            for y in range(tile_height):
                for x in range(tile_width):
                    if curr_offset >= len(file_content):
                        valid = False
                        break
                    color_idx = file_content[curr_offset]
                    curr_offset += 1
                    pos = (x + x_off) + (y + y_off) * total_width
                    pixels[pos * 4:pos * 4 + 4] = bytes(palette[color_idx])
                if not valid:
                    break
            if not valid:
                break

        if not valid:
            break

        img = Image.frombytes('RGBA', (total_width, total_height), bytes(pixels))
        images.append(img)

    return images

# ── LZP decoder ─────────────────────────────────────────────────────────────

def decode_lzp(file_content, file_path):
    if len(file_content) == 0:
        return []

    palette = _palette_from_data(file_content, 0x20)
    total_frames = _get_int(file_content, 0)
    width = _get_int(file_content, 4)
    height = _get_int(file_content, 8)
    N = 4095

    images = []
    for frame_idx in range(total_frames):
        offset_to_offsets = len(file_content) - total_frames * 4 + frame_idx * 4
        offset_local = _get_int(file_content, offset_to_offsets)
        compressed_len = _get_int(file_content, offset_local)

        pixels = bytearray(width * height * 4)
        data_ptr = offset_local + 4
        data_end = data_ptr + compressed_len

        window = [0] * 4096
        dst_pos = 0
        window_index = 4078
        bit_idx = 0
        end = False
        flags = 0

        while not end:
            if bit_idx == 0:
                if data_ptr >= data_end:
                    break
                flags = file_content[data_ptr]
                data_ptr += 1

            if (flags & 1) != 0:
                if data_ptr >= data_end:
                    break
                c = file_content[data_ptr]
                data_ptr += 1
                if dst_pos > width * height:
                    break
                pos = dst_pos % width + (dst_pos // width) * width
                pixels[pos * 4:pos * 4 + 4] = bytes(palette[c])
                dst_pos += 1
                window[window_index] = c
                window_index = (window_index + 1) & N
            else:
                if data_ptr >= data_end:
                    break
                offset = file_content[data_ptr]
                data_ptr += 1
                if data_ptr >= data_end:
                    break
                length_byte = file_content[data_ptr]
                data_ptr += 1
                offset |= (length_byte & 0xF0) << 4
                run_len = (length_byte & 0xF) + 3
                for k in range(run_len):
                    c = window[(offset + k) & N]
                    if dst_pos > width * height:
                        end = True
                        break
                    pos = dst_pos % width + (dst_pos // width) * width
                    pixels[pos * 4:pos * 4 + 4] = bytes(palette[c])
                    dst_pos += 1
                    window[window_index] = c
                    window_index = (window_index + 1) & N

            flags >>= 1
            bit_idx = (bit_idx + 1) & 7

        img = Image.frombytes('RGBA', (width, height), bytes(pixels))
        images.append(img)

    return images

# ── OOS decoder ─────────────────────────────────────────────────────────────

def decode_oos(file_path):
    with open(file_path, 'rb') as f:
        data = f.read()
    offset_to_length = _get_int(data, 0x14)
    offset_to_data = _get_int(data, 0x18)
    length = _get_int(data, offset_to_length)
    return [data[offset_to_data + i] for i in range(length)]

# ── High-level decode ───────────────────────────────────────────────────────

def decode_surfaces(file_path):
    ext = os.path.splitext(file_path)[1].upper()
    with open(file_path, 'rb') as f:
        file_content = f.read()

    if ext == '.CGF':
        return decode_cgf(file_content, file_path)
    elif ext == '.TIL':
        return decode_til(file_content, file_path)
    elif ext == '.LZP':
        return decode_lzp(file_content, file_path)
    else:
        print(f"  Unsupported format: {ext}")
        return []

# ── Asset definitions ───────────────────────────────────────────────────────

# (game_dir, gfx_file, start_frame, end_frame, output_name)
FOREST_GFX = [
    ("ForestData", "hillsday.cgf", 0, 0, "hillsday", True),
    ("ForestData", "paratrees.cgf", 0, 0, "paratrees", True),
    ("ForestData", "spooky.cgf", 0, 0, "spooky", True),
    ("ForestData", "paraground.cgf", 0, 0, "paraground", True),
    ("ForestData", "GRASS.cgf", 0, 0, "grass", True),
    ("ForestData", "LEAVES1.cgf", 0, 0, "leaves1", True),
    ("ForestData", "LEAVES2.cgf", 0, 0, "leaves2", True),
    ("ForestData", "WALL.cgf", 0, 0, "end_mountain", True),
    ("ForestData", "hugoside.cgf", 0, 7, "hugo_side", False),
    ("ForestData", "kravle.cgf", 0, 7, "hugo_crawl", False),
    ("ForestData", "hugohop.cgf", 0, 2, "hugo_jump", False),
    ("ForestData", "hugo_hello.cgf", 0, 15, "hugo_telllives", False),
    ("ForestData", "hand1.cgf", 0, 0, "hand1", True),
    ("ForestData", "hand2.cgf", 0, 0, "hand2", True),
    ("ForestData", "branch-swing.cgf", 0, 6, "tree", False),
    ("ForestData", "lonetree.cgf", 0, 0, "lone_tree", True),
    ("ForestData", "stone.cgf", 0, 7, "rock", False),
    ("ForestData", "saek.cgf", 0, 3, "sack", False),
    ("ForestData", "faelde.cgf", 0, 5, "trap", False),
    ("ForestData", "catapult.cgf", 0, 7, "catapult", False),
    ("ForestData", "HGROCK.TIL", 0, 60, "hit_rock", False),
    ("ForestData", "hugo-rock.til", 0, 14, "hugo_lookrock", False),
    ("ForestData", "MSYNCRCK.TIL", 0, 17, "hit_rock_sync", False),
    ("ForestData", "HGKATFLY.til", 0, 113, "catapult_fly", False),
    ("ForestData", "HGKATFLY.til", 115, 189, "catapult_fall", False),
    ("ForestData", "CATAPULT-SPEAK.til", 0, 15, "catapult_airtalk", False),
    ("ForestData", "HGKATHNG.TIL", 0, 12, "catapult_hang", False),
    ("ForestData", "hanging_mouth.cgf", 0, 11, "catapult_hangspeak", False),
    ("ForestData", "BRANCH-GROGGY.til", 0, 42, "hugohitlog", False),
    ("ForestData", "BRANCH-SPEAK.til", 0, 17, "hugohitlog_talk", False),
    ("ForestData", "traptalk.til", 0, 15, "hugo_traptalk", False),
    ("ForestData", "TRAP-HURTS.til", 0, 9, "hugo_traphurt", False),
    ("ForestData", "SCORES.cgf", 0, 0, "score_numbers", True),
    ("ForestData", "HUGOSTAT.cgf", 0, 0, "hugo_lives", True),
    ("ForestData", "HEKS1.cgf", 0, 0, "sculla_hand1", True),
    ("ForestData", "HEKS2.cgf", 0, 0, "sculla_hand2", True),
]

CAVE_GFX = [
    ("RopeOutroData", "STAIRS.TIL", 0, 12, "talks", False),
    ("RopeOutroData", "STAIRS.TIL", 11, 51, "climbs", False),
    ("RopeOutroData", "CASELIVE.TIL", 0, 32, "first_rope", False),
    ("RopeOutroData", "CASELIVE.TIL", 33, 72, "second_rope", False),
    ("RopeOutroData", "CASELIVE.TIL", 73, 121, "third_rope", False),
    ("RopeOutroData", "CASELIVE.TIL", 122, 177, "scylla_leaves", False),
    ("RopeOutroData", "CASELIVE.TIL", 178, 240, "scylla_bird", False),
    ("RopeOutroData", "CASELIVE.TIL", 241, 283, "scylla_ropes", False),
    ("RopeOutroData", "CASELIVE.TIL", 284, 318, "scylla_spring", False),
    ("RopeOutroData", "CASELIVE.TIL", 319, 352, "family_cage", False),
    ("RopeOutroData", "CASEDIE.TIL", 122, 166, "hugo_puff_first", False),
    ("RopeOutroData", "CASEDIE.TIL", 167, 211, "hugo_puff_second", False),
    ("RopeOutroData", "CASEDIE.TIL", 212, 256, "hugo_puff_third", False),
    ("RopeOutroData", "CASEDIE.TIL", 257, 295, "hugo_spring", False),
    ("RopeOutroData", "HAPPY.TIL", 0, 111, "happy", False),
    ("RopeOutroData", "SCORE.cgf", 0, 9, "score_font", False),
    ("RopeOutroData", "hugo.cgf", 0, 0, "hugo", True),
]

FOREST_SYNCS = [
    ("ForestData", "005-01.oos", "sync_start"),
    ("ForestData", "005-02.oos", "sync_rock"),
    ("ForestData", "005-03.oos", "sync_dieonce"),
    ("ForestData", "005-04.oos", "sync_trap"),
    ("ForestData", "005-05.oos", "sync_lastlife"),
    ("ForestData", "005-08.oos", "sync_catapult_talktop"),
    ("ForestData", "005-10.oos", "sync_catapult_hang"),
    ("ForestData", "005-11.oos", "sync_hitlog"),
    ("ForestData", "005-12.oos", "sync_gameover"),
    ("ForestData", "005-13.oos", "sync_levelcompleted"),
]

CAVE_SYNCS = [
    ("RopeOutroData", "002-06.oos", "sync_hugo_start"),
    ("RopeOutroData", "002-09.oos", "sync_hugo_die"),
]

FOREST_AUDIO = [
    ("ForestData", "sfx", "atmos-lp.wav", "sfx_bg_atmosphere"),
    ("ForestData", "sfx", "warning.wav", "sfx_lightning_warning"),
    ("ForestData", "sfx", "knock.wav", "sfx_hugo_knock"),
    ("ForestData", "sfx", "crunch.wav", "sfx_hugo_hittrap"),
    ("ForestData", "sfx", "skriid.wav", "sfx_hugo_launch"),
    ("ForestData", "sfx", "sack-norm.wav", "sfx_sack_normal"),
    ("ForestData", "sfx", "sack.wav", "sfx_sack_bonus"),
    ("ForestData", "sfx", "wush.wav", "sfx_tree_swush"),
    ("ForestData", "sfx", "bell.wav", "sfx_hugo_hitlog"),
    ("ForestData", "sfx", "fjeder.wav", "sfx_catapult_eject"),
    ("ForestData", "sfx", "birds-lp.wav", "sfx_birds"),
    ("ForestData", "sfx", "hit_screen.wav", "sfx_hugo_hitscreen"),
    ("ForestData", "sfx", "klirr.wav", "sfx_hugo_screenklir"),
    ("ForestData", "sfx", "kineser.wav", "sfx_hugo_crash"),
    ("ForestData", "sfx", "knage-start.wav", "sfx_hugo_hangstart"),
    ("ForestData", "sfx", "knage-lp.wav", "sfx_hugo_hang"),
    ("ForestData", "sfx", "fumle0.wav", "sfx_hugo_walk0"),
    ("ForestData", "sfx", "fumle1.wav", "sfx_hugo_walk1"),
    ("ForestData", "sfx", "fumle2.wav", "sfx_hugo_walk2"),
    ("ForestData", "sfx", "fumle3.wav", "sfx_hugo_walk3"),
    ("ForestData", "sfx", "fumle4.wav", "sfx_hugo_walk4"),
    ("ForestData", "sfx", "dos.wav", "sfx_hint_dos"),
    ("ForestData", "sfx", "ocho.wav", "sfx_hint_ocho"),
    ("ForestData", "speaks", "005-01.wav", "speak_start"),
    ("ForestData", "speaks", "005-02.wav", "speak_rock"),
    ("ForestData", "speaks", "005-03.wav", "speak_dieonce"),
    ("ForestData", "speaks", "005-04.wav", "speak_trap"),
    ("ForestData", "speaks", "005-05.wav", "speak_lastlife"),
    ("ForestData", "speaks", "005-06.wav", "speak_catapult_up"),
    ("ForestData", "speaks", "005-07.wav", "speak_catapult_hit"),
    ("ForestData", "speaks", "005-08.wav", "speak_catapult_talktop"),
    ("ForestData", "speaks", "005-09.wav", "speak_catapult_down"),
    ("ForestData", "speaks", "005-10.wav", "speak_catapult_hang"),
    ("ForestData", "speaks", "005-11.wav", "speak_hitlog"),
    ("ForestData", "speaks", "005-12.wav", "speak_gameover"),
    ("ForestData", "speaks", "005-13.wav", "speak_levelcompleted"),
]

CAVE_AUDIO = [
    ("RopeOutroData", "speak", "002-05.wav", "her_er_vi"),
    ("RopeOutroData", "speak", "002-06.wav", "trappe_snak"),
    ("RopeOutroData", "speak", "002-07.wav", "nu_kommer_jeg"),
    ("RopeOutroData", "speak", "002-08.wav", "afskylia_snak"),
    ("RopeOutroData", "speak", "002-09.wav", "hugo_katapult"),
    ("RopeOutroData", "speak", "002-10.wav", "hugo_skyd_ud"),
    ("RopeOutroData", "speak", "002-11.wav", "afskylia_skyd_ud"),
    ("RopeOutroData", "speak", "002-12.wav", "hugoline_tak"),
    ("RopeOutroData", "SFX", "BA-13.WAV", "stemning"),
    ("RopeOutroData", "SFX", "BA-15.WAV", "fodtrin1"),
    ("RopeOutroData", "SFX", "BA-16.WAV", "fodtrin2"),
    ("RopeOutroData", "SFX", "BA-17.WAV", "hiv_i_reb"),
    ("RopeOutroData", "SFX", "BA-18.WAV", "fjeder"),
    ("RopeOutroData", "SFX", "BA-21.WAV", "pre_puf"),
    ("RopeOutroData", "SFX", "BA-22.WAV", "puf"),
    ("RopeOutroData", "SFX", "BA-24.WAV", "tast_trykket"),
    ("RopeOutroData", "SFX", "BA-101.WAV", "pre_fanfare"),
    ("RopeOutroData", "SFX", "BA-102.WAV", "fanfare"),
    ("RopeOutroData", "SFX", "BA-104.WAV", "fugle_skrig"),
    ("RopeOutroData", "SFX", "HEXHAHA.WAV", "trappe_grin"),
    ("RopeOutroData", "SFX", "SKRIG.WAV", "skrig"),
    ("RopeOutroData", "SFX", "COUNTER.WAV", "score_counter"),
]

# ── Conversion functions ────────────────────────────────────────────────────

def save_frames(images, output_dir, name, start, end, make_alpha_bg=False):
    """Save image frames as individual PNGs. Returns metadata dict."""
    frames = images[start:end + 1]
    if not frames:
        print(f"  Warning: no frames for {name}")
        return None

    os.makedirs(output_dir, exist_ok=True)
    frame_info = []

    for i, img in enumerate(frames):
        if make_alpha_bg:
            # Make pure black pixels transparent (matching Python game behavior for hillsday)
            pass  # Already RGBA with alpha from decoder

        out_path = os.path.join(output_dir, f"{name}_{i:04d}.png")
        img.save(out_path, 'PNG')
        frame_info.append({
            "file": f"{name}_{i:04d}.png",
            "width": img.width,
            "height": img.height,
        })

    return {
        "name": name,
        "frames": frame_info,
        "frameCount": len(frame_info),
    }


def convert_audio(src_path, dst_path):
    """Convert WAV to MP3 using ffmpeg."""
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', src_path, '-codec:a', 'libmp3lame', '-q:a', '4', dst_path],
            capture_output=True, check=True
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"  Warning: failed to convert {src_path}: {e}")
        return False


def convert_video(src_path, dst_path):
    """Convert AVI to MP4 using ffmpeg."""
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', src_path, '-c:v', 'libx264', '-preset', 'fast',
             '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', dst_path],
            capture_output=True, check=True
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"  Warning: failed to convert {src_path}: {e}")
        return False


# ── Main conversion pipeline ────────────────────────────────────────────────

def find_rar():
    """Find the Gold edition RAR in parent directory."""
    parent = Path(__file__).parent.parent
    for f in parent.iterdir():
        if 'dorada' in f.name.lower() or 'edición dorada' in f.name.lower():
            if f.suffix.lower() == '.rar':
                return str(f)
    return None


def extract_rar(rar_path, extract_to):
    """Extract RAR using bsdtar (available on macOS)."""
    print(f"Extracting {rar_path}...")
    subprocess.run(['bsdtar', '-xf', rar_path, '-C', extract_to], check=True)


def find_bigfile(extract_dir):
    """Find BigFile directory in extracted contents."""
    for root, dirs, files in os.walk(extract_dir):
        if 'BigFile' in dirs:
            return os.path.join(root, 'BigFile')
    return None


def convert_gfx(bigfile_dir, output_base, gfx_list, category):
    """Convert graphics assets."""
    manifest_entries = []
    decoded_cache = {}

    for entry in gfx_list:
        game_dir, filename, start, end, name, _ = entry
        # Use uppercase GFX for RopeOutroData
        gfx_subdir = "GFX" if game_dir == "RopeOutroData" else "gfx"
        src_path = os.path.join(bigfile_dir, game_dir, gfx_subdir, filename)

        if not os.path.exists(src_path):
            print(f"  Missing: {src_path}")
            continue

        cache_key = src_path
        if cache_key not in decoded_cache:
            print(f"  Decoding {game_dir}/{gfx_subdir}/{filename}...")
            decoded_cache[cache_key] = decode_surfaces(src_path)

        all_frames = decoded_cache[cache_key]
        output_dir = os.path.join(output_base, category)
        info = save_frames(all_frames, output_dir, name, start, end)
        if info:
            info["category"] = category
            manifest_entries.append(info)

    return manifest_entries


def convert_syncs(bigfile_dir, output_base, sync_list, category):
    """Convert OOS sync files to JSON."""
    manifest_entries = []
    for game_dir, filename, name in sync_list:
        src_path = os.path.join(bigfile_dir, game_dir, "Syncs", filename)
        if not os.path.exists(src_path):
            print(f"  Missing sync: {src_path}")
            continue

        print(f"  Converting sync {game_dir}/Syncs/{filename}...")
        sync_data = decode_oos(src_path)
        output_dir = os.path.join(output_base, category)
        os.makedirs(output_dir, exist_ok=True)
        out_path = os.path.join(output_dir, f"{name}.json")
        with open(out_path, 'w') as f:
            json.dump(sync_data, f)
        manifest_entries.append({
            "name": name,
            "category": category,
            "type": "sync",
            "file": f"{name}.json",
            "length": len(sync_data),
        })
    return manifest_entries


def convert_audio_assets(bigfile_dir, output_base, audio_list, category):
    """Convert audio files to MP3."""
    manifest_entries = []
    for game_dir, subdir, filename, name in audio_list:
        src_path = os.path.join(bigfile_dir, game_dir, subdir, filename)
        if not os.path.exists(src_path):
            print(f"  Missing audio: {src_path}")
            continue

        print(f"  Converting audio {game_dir}/{subdir}/{filename}...")
        output_dir = os.path.join(output_base, category)
        mp3_name = f"{name}.mp3"
        dst_path = os.path.join(output_dir, mp3_name)
        if convert_audio(src_path, dst_path):
            manifest_entries.append({
                "name": name,
                "category": category,
                "type": "audio",
                "file": mp3_name,
            })
    return manifest_entries


def copy_static_assets(game_resources_dir, output_base):
    """Copy repo-committed static assets."""
    manifest_entries = []

    # Images
    images_src = os.path.join(game_resources_dir, "images")
    images_dst = os.path.join(output_base, "images")
    if os.path.exists(images_src):
        shutil.copytree(images_src, images_dst, dirs_exist_ok=True)
        for f in os.listdir(images_dst):
            manifest_entries.append({"name": f, "category": "images", "type": "static", "file": f})

    # Fixed assets
    fixed_src = os.path.join(game_resources_dir, "fixed_assets")
    fixed_dst = os.path.join(output_base, "fixed_assets")
    if os.path.exists(fixed_src):
        shutil.copytree(fixed_src, fixed_dst, dirs_exist_ok=True)
        for f in os.listdir(fixed_dst):
            manifest_entries.append({"name": f, "category": "fixed_assets", "type": "static", "file": f})

    # Splats
    splats_src = os.path.join(game_resources_dir, "splats")
    splats_dst = os.path.join(output_base, "splats")
    if os.path.exists(splats_src):
        shutil.copytree(splats_src, splats_dst, dirs_exist_ok=True)

    # Orbs
    orbs_src = os.path.join(game_resources_dir, "orbs")
    orbs_dst = os.path.join(output_base, "orbs")
    if os.path.exists(orbs_src):
        shutil.copytree(orbs_src, orbs_dst, dirs_exist_ok=True)

    # Scores
    scores_src = os.path.join(game_resources_dir, "scores")
    scores_dst = os.path.join(output_base, "scores")
    if os.path.exists(scores_src):
        shutil.copytree(scores_src, scores_dst, dirs_exist_ok=True)

    # Scoreboard BMP (from BigFile)
    return manifest_entries


def convert_scoreboard_bmp(bigfile_dir, output_base):
    """Convert ForestData SCOREBRD.bmp."""
    src = os.path.join(bigfile_dir, "ForestData", "gfx", "SCOREBRD.bmp")
    if os.path.exists(src):
        dst = os.path.join(output_base, "forest", "scoreboard.png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        img = Image.open(src).convert('RGBA')
        img.save(dst, 'PNG')
        print(f"  Converted SCOREBRD.bmp -> scoreboard.png")


def convert_videos(game_resources_dir, output_base):
    """Convert AVI videos to MP4."""
    manifest_entries = []
    videos_dir = os.path.join(game_resources_dir, "videos")
    audio_dir = os.path.join(game_resources_dir, "audio_for_videos")

    for country in ["ar", "cl", "dn", "fr"]:
        country_video_dir = os.path.join(videos_dir, country)
        if not os.path.exists(country_video_dir):
            continue

        for avi_file in os.listdir(country_video_dir):
            if not avi_file.endswith('.avi'):
                continue

            src_path = os.path.join(country_video_dir, avi_file)
            mp4_name = avi_file.replace('.avi', '.mp4')
            dst_dir = os.path.join(output_base, "videos", country)
            dst_path = os.path.join(dst_dir, mp4_name)

            print(f"  Converting video {country}/{avi_file}...")
            if convert_video(src_path, dst_path):
                manifest_entries.append({
                    "name": f"{country}/{mp4_name}",
                    "category": "videos",
                    "type": "video",
                    "file": f"videos/{country}/{mp4_name}",
                })

        # Also convert audio tracks
        country_audio_dir = os.path.join(audio_dir, country)
        if os.path.exists(country_audio_dir):
            for wav_file in os.listdir(country_audio_dir):
                if not wav_file.endswith('.wav'):
                    continue
                src_path = os.path.join(country_audio_dir, wav_file)
                mp3_name = wav_file.replace('.wav', '.mp3')
                dst_dir = os.path.join(output_base, "audio_for_videos", country)
                dst_path = os.path.join(dst_dir, mp3_name)
                print(f"  Converting video audio {country}/{wav_file}...")
                if convert_audio(src_path, dst_path):
                    manifest_entries.append({
                        "name": f"{country}/{mp3_name}",
                        "category": "audio_for_videos",
                        "type": "audio",
                        "file": f"audio_for_videos/{country}/{mp3_name}",
                    })

    return manifest_entries


def main():
    parser = argparse.ArgumentParser(description='Convert Hugo assets for web')
    parser.add_argument('--rar', help='Path to Gold edition RAR file')
    parser.add_argument('--bigfile', help='Path to already-extracted BigFile directory')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    output_base = script_dir / "assets"
    game_resources_dir = script_dir.parent / "game" / "resources"

    # Clean output
    if output_base.exists():
        shutil.rmtree(output_base)
    output_base.mkdir(parents=True)

    # Get BigFile directory
    if args.bigfile:
        bigfile_dir = args.bigfile
    else:
        rar_path = args.rar or find_rar()
        if not rar_path:
            print("ERROR: Could not find Gold edition RAR. Use --rar or --bigfile.")
            sys.exit(1)

        tmpdir = tempfile.mkdtemp()
        extract_rar(rar_path, tmpdir)
        bigfile_dir = find_bigfile(tmpdir)
        if not bigfile_dir:
            print("ERROR: Could not find BigFile directory in extracted RAR.")
            sys.exit(1)

    print(f"BigFile directory: {bigfile_dir}")
    print(f"Output directory: {output_base}")
    print()

    manifest = {"forest_gfx": [], "cave_gfx": [], "forest_syncs": [], "cave_syncs": [],
                "forest_audio": [], "cave_audio": [], "static": [], "videos": []}

    # Convert graphics
    print("=== Converting Forest graphics ===")
    manifest["forest_gfx"] = convert_gfx(bigfile_dir, str(output_base), FOREST_GFX, "forest")

    print("\n=== Converting Cave graphics ===")
    manifest["cave_gfx"] = convert_gfx(bigfile_dir, str(output_base), CAVE_GFX, "cave")

    # Convert syncs
    print("\n=== Converting Forest syncs ===")
    manifest["forest_syncs"] = convert_syncs(bigfile_dir, str(output_base), FOREST_SYNCS, "forest")

    print("\n=== Converting Cave syncs ===")
    manifest["cave_syncs"] = convert_syncs(bigfile_dir, str(output_base), CAVE_SYNCS, "cave")

    # Convert audio
    print("\n=== Converting Forest audio ===")
    manifest["forest_audio"] = convert_audio_assets(bigfile_dir, str(output_base), FOREST_AUDIO, "forest")

    print("\n=== Converting Cave audio ===")
    manifest["cave_audio"] = convert_audio_assets(bigfile_dir, str(output_base), CAVE_AUDIO, "cave")

    # Scoreboard BMP
    print("\n=== Converting scoreboard ===")
    convert_scoreboard_bmp(bigfile_dir, str(output_base))

    # Static assets
    print("\n=== Copying static assets ===")
    manifest["static"] = copy_static_assets(str(game_resources_dir), str(output_base))

    # Videos
    print("\n=== Converting videos ===")
    manifest["videos"] = convert_videos(str(game_resources_dir), str(output_base))

    # Write manifest
    manifest_path = output_base / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n=== Done! Manifest written to {manifest_path} ===")
    print(f"Total forest gfx entries: {len(manifest['forest_gfx'])}")
    print(f"Total cave gfx entries: {len(manifest['cave_gfx'])}")
    print(f"Total forest audio entries: {len(manifest['forest_audio'])}")
    print(f"Total cave audio entries: {len(manifest['cave_audio'])}")


if __name__ == '__main__':
    main()

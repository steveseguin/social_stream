#!/usr/bin/env node
'use strict';

// Requires FFmpeg on PATH (or set FFMPEG_PATH). The original tone stays untouched.
// Compression raises average loudness; a -1 dB limiter keeps the PCM peaks below full scale.
// Package the WAV so playback needs no additional audio processing or codec libraries.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', path.join(root, 'audio', 'tone.mp3'),
    '-af', 'acompressor=threshold=0.125:ratio=4:attack=1:release=30:makeup=6,alimiter=limit=0.89125:attack=1:release=10:level=false:latency=true',
    '-map_metadata', '-1', '-c:a', 'pcm_s16le',
    path.join(root, 'audio', 'tone-loud.wav')
], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('Generated audio/tone-loud.wav.');

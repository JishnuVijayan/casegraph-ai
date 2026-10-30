# CaseGraph launch video (30 s, 1920x1080, 30 fps, 900 frames)

Six spring-animated scenes: Hook → Problem → Tell us → AI timeline → Case network → Call to action.
UI pictures are placeholders until you add screenshots (`src/theme.ts`, folder `public/screens/`).

```bash
cd video && npm install
npm run studio                      # live preview in the browser
```

## What makes it feel premium
- **Reacts to the audio:** `@remotion/media-utils` reads the real voiceover and music, frame by frame. The background glow, the waveform on the phone, the network hub, the logo glow and the progress line all move with the sound.
- **Cinematic transitions:** `@remotion/transitions` (wipe, slide, fade, flip) between scenes, each scene starting exactly on its narrated moment.
- **Word-synced captions** (`src/captions.json`), a slow camera push-in on every scene, film grain, and a moving aurora backdrop.
- Framer Motion is deliberately not used: Remotion renders each frame on its own, so real-time animation libraries flicker or drift. `spring()` and `interpolate()` give the same motion deterministically.

## Voiceover with exact sync (ElevenLabs)
`voiceover-script.txt` has one line per scene (about 63 words, roughly 25 seconds of speech). Edit freely, keep 6 lines and stay under 30 s.

```bash
export ELEVENLABS_API_KEY=...       # your key; never commit it
# optional: export ELEVENLABS_VOICE_ID=<a voice id from your ElevenLabs library>
npm run voiceover
```
This writes `public/voiceover.mp3` and `src/timing.json`: ElevenLabs returns the time of every character, so each scene starts 4 frames before its line is spoken. If you recorded the voice another way, put it at `public/voiceover.mp3` and run `npm run sync` (spreads scenes over the real audio length by word count; needs `ffprobe`).

## Render
```bash
npm run render                      # -> out/casegraph-launch.mp4 (H.264)
```
The first render downloads a headless Chrome (about 100 MB), done once by Remotion.

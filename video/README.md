# CaseGraph launch video (30 s, 1920x1080, 30 fps, 900 frames)

Six spring-animated scenes: Hook → Problem → Tell us → AI timeline → Case network → Call to action.
UI pictures are placeholders until you add screenshots (`src/theme.ts`, folder `public/screens/`).

```bash
cd video && npm install
npm run studio                      # live preview in the browser
```

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

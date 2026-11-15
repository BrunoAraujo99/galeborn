# Galeborn

Original anime-style 3D elemental duel for the browser (Three.js).

- `src/` game source (`index.html` + `*.js`), `assets/` hero models and audio.
- `python3 build.py` makes two builds: `dist/galeborn.html` (one self-contained file that runs from disk) and `dist/web/` (small page plus `heroes/*.glb` and `audio/*.mp3` loaded on demand).
- `public/` is a copy of `dist/web/` and is what Vercel serves.
- Online duels use Supabase (project `yhsfwftdtvtiarvookiy`); only the public publishable key is in the client, all data access goes through locked-down RPCs.

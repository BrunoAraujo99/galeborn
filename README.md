# Galeborn

Original anime-style 3D elemental duel for the browser (Three.js).

- `src/` game source (`index.html` + `*.js`), `assets/` hero models and audio.
- `python3 build.py` concatenates everything into one self-contained `dist/galeborn.html`.
- `public/index.html` is the built game served by Vercel (copy `dist/galeborn.html` there after building).
- Online duels use Supabase (project `yhsfwftdtvtiarvookiy`); only the public publishable key is in the client, all data access goes through locked-down RPCs.

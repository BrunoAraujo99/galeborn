# Galeborn: assets needed from Bruno

Everything here is optional. The game works without it, and each item replaces a placeholder or fills a gap.
Ranked by how much the game gains per item.

## 1. Animations for the 4 current heroes (Meshy, same rig as before)

Every hero already has: Running, Walking, Charged_Spell_Cast, Hit_Reaction, Idle, Knock_Down, Punch_Combo,
Regular_Jump, Roll_Dodge (fire lacks it), Roundhouse_Kick, Victory_Cheer.
The game fakes the moves below by posing the skeleton by code. A real clip will look much better. Pick
the closest match in Meshy's animation library. The exact names don't matter, so tell me which file is which.

| Priority | Clip | Used for |
|---|---|---|
| 1 | **Block / guard idle** (arms up, braced) | holding block (F / LB) |
| 1 | **Get up from the ground** | after knockdowns and launches |
| 1 | **Fire: Roll_Dodge** | fire is the only hero without it |
| 2 | **Uppercut or rising attack** | back + strike launchers |
| 2 | **Air attack / flying kick** | air strings |
| 2 | **Defeat / kneel or fall** | losing a round |
| 2 | **Fighting-stance taunt or intro pose** | the VS screen and round start |
| 3 | **Heavy hit stagger (big knockback)** | guard break, heavy hits |
| 3 | **Dash / sprint forward lean** | dashes |

Export them the same way as last time: the same .glb per hero with the extra clips inside, or separate .glb files with one clip each.
Drop them in `Downloads\Gableborn Duel characters\` and tell me.

## 2. Two new heroes (Meshy models)

Placeholder plan: both heroes join the roster as new elements with their own moveset. Until the models arrive, they
can only exist as recoloured copies of the current models, so the real model is what makes them feel new.
Requirements: humanoid, T-pose, textured, Mixamo-compatible rig (like the first four), plus the same 11 clips if
Meshy offers them.

**Storm duelist (lightning)**, a quick blade-dancer. Meshy prompt:
> Stylized anime martial artist, young adult, lean athletic build, short spiky silver-white hair, sleeveless
> deep indigo tunic with gold trim, wrapped forearms, loose dark trousers, sandals, a pale-yellow sash with
> zig-zag pattern, confident stance, cel-shaded game character, full body, T-pose, clean topology

**Frost warden (ice)**, a slow, defensive zoner. Meshy prompt:
> Stylized anime warrior, tall, broad shoulders, long braided pale-blue hair, layered white and ice-blue
> fur-trimmed coat over light armor, crystal shoulder guard on one side, heavy boots, calm expression,
> cel-shaded game character, full body, T-pose, clean topology

(These are only suggestions. If you'd rather design your own elements or looks, any original humanoid model works.)

## 3. Voices (ElevenLabs, after credits renew Dec 6)

Tavi (wind) has a full set. Soren (fire), Brannoc (earth) and Ysra (water) only have intro, name, ult, awaken,
low HP, spent, beam and victory lines. Missing for **each** of those three:
- 6 attack efforts (short "hah!", "hup!")
- 4 heavy-attack shouts
- 4 hurt grunts
- 2 jump efforts
- 1 K.O. cry
- 1 pursuit line (2-4 words)

New duel lines for **all 4** heroes (1 each):
- block/parry ("Too slow.")
- break away (a short exhale or "Enough!")
- round win, and round lost
- rematch taunt ("Again.")

If the new heroes get models, they need a full set like Tavi's (about 45 lines each).

## 4. Music (ElevenLabs music, after Dec 6)

Already promised: title theme, Awakened theme, beam-struggle theme. Add:
- **Duel theme** (fast, percussive, 90-120 s loop) for online duels, which reuse the boss music today
- **Moonwell arena theme** (night, calmer, mysterious)

## 5. Nothing needed from you for

New arena layout, balance, readability, performance, highlight clips and progression are all done in code.

# Music credits

## User-provided soundtrack

These four tracks were supplied by the project owner. They come from the
**Sitting on Clouds OST** by **Rom Di Prisco** (2017, sittingoncloudsost.com).
They are **not CC0**: they are used on the owner's own responsibility, and
redistributing them needs the rights holder's permission.

| File | Title | Used for | Edits |
|---|---|---|---|
| `battle.ogg` (3:46, loop) | 01. Battle Royal (Guitar Theme) | Battle Bus | Re-encoded MP3 to Ogg Vorbis (q4). Tags stripped. |
| `menu.ogg` (2:50) | 02. Main Menu | Lobby playlist | Same |
| `title.ogg` (2:24) | 03. Title Menu | Lobby playlist | Same |
| `title_alt.ogg` (2:34) | 04. Title Menu (Alternate) | Lobby playlist | Same |

## CC0 tracks

Every track below is CC0 1.0 / public domain
(https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not
required. The authors are credited anyway.

| File | Title | Author | Source | License | Edits |
|---|---|---|---|---|---|
| `endgame.ogg` (102.1 s, loop) | Boss Battle (loop) | Pro Sensory (Alex McCulloch) | https://opengameart.org/content/boss-battle-loop | CC0 (the author asks for credit but does not require it) | Cut 0.31 s of leading MP3 encoder silence. Re-encoded to Ogg Vorbis (~125 kbps). |
| `victory.ogg` (4.9 s) | victory (SNES set) | Beatscribe | https://github.com/Beatscribe/homebrew_vgm (`SNES/ogg/victory.ogg`) | CC0 | Trimmed to 4.9 s with a 0.3 s fade-out. Re-encoded (~109 kbps). |
| `defeat.ogg` (3.5 s) | game_over (SNES set) | Beatscribe | https://github.com/Beatscribe/homebrew_vgm (`SNES/ogg/game_over.ogg`) | CC0 | Re-encoded (~95 kbps). |

## License evidence

- **Beatscribe (victory, defeat):** comes from the author's own repository.
  Its README says: "They are available under Creative Commons Zero for your use
  in any project you'd like. ... All this is availabe under the CC0 license."
- **OpenGameArt track (endgame):** opengameart.org is blocked from
  the build environment, so the license could not be read on the source pages.
  The files were fetched from GitHub projects that ship them, and several
  independent projects credit it as CC0:
  - Boss Battle (loop): draphael123/bannerline ("License: CC0 1.0"),
    LWTBruce/Bonus-Guess ("CC0 / Public Domain; attribution requested by the
    author: Alex McCulloch"), AminDhouib/personal-portfolio (other Pro Sensory
    tracks are CC0 with credit appreciated but not required).
  Check the OpenGameArt pages from a normal browser before release.

## Where the files were downloaded from

- endgame: raw.githubusercontent.com/draphael123/bannerline/HEAD/assets/music/boss-storm-sovereign.mp3
- victory / defeat: git clone https://github.com/Beatscribe/homebrew_vgm

Note: Ogg Vorbis plays in all current Chrome/Firefox/Edge builds and in Safari
17+. For older Safari, transcode to MP3 (MP3 adds encoder padding, which hurts
gapless looping).

# Music credits

Every track here is CC0 1.0 / public domain
(https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not
required. The authors are credited anyway.

| File | Title | Author | Source | License | Edits |
|---|---|---|---|---|---|
| `lobby.ogg` (46.8 s, loop) | Happy Adventure (Loop) | TinyWorlds (Rick Hoppmann) | https://opengameart.org/content/happy-adventure-loop | CC0 | Re-encoded MP3 to Ogg Vorbis (q3.5, ~92 kbps). No trimming. |
| `bus.ogg` (74.3 s) | Level 1, from "5 Chiptunes (Action)" | SubspaceAudio (Juhani Junkala) | https://opengameart.org/content/5-chiptunes-action | CC0 | Re-encoded to Ogg Vorbis (~104 kbps). Gain -5 dB to match the other tracks. |
| `endgame.ogg` (102.1 s, loop) | Boss Battle (loop) | Pro Sensory (Alex McCulloch) | https://opengameart.org/content/boss-battle-loop | CC0 (the author asks for credit but does not require it) | Cut 0.31 s of leading MP3 encoder silence. Re-encoded to Ogg Vorbis (~125 kbps). |
| `victory.ogg` (4.9 s) | victory (SNES set) | Beatscribe | https://github.com/Beatscribe/homebrew_vgm (`SNES/ogg/victory.ogg`) | CC0 | Trimmed to 4.9 s with a 0.3 s fade-out. Re-encoded (~109 kbps). |
| `defeat.ogg` (3.5 s) | game_over (SNES set) | Beatscribe | https://github.com/Beatscribe/homebrew_vgm (`SNES/ogg/game_over.ogg`) | CC0 | Re-encoded (~95 kbps). |

## License evidence

- **Beatscribe (victory, defeat):** comes from the author's own repository.
  Its README says: "They are available under Creative Commons Zero for your use
  in any project you'd like. ... All this is availabe under the CC0 license."
- **OpenGameArt tracks (lobby, bus, endgame):** opengameart.org is blocked from
  the build environment, so the license could not be read on the source pages.
  The files were fetched from GitHub projects that ship them, and several
  independent projects credit each track as CC0:
  - Happy Adventure (Loop): AminDhouib/personal-portfolio, haseebq/super-mo,
    jamesfebin/ImpatientProgrammerBevyRust, bromagosa/Ludus ("CC0 Public Domain
    by TinyWorlds"), lemniscateresearch/BoxBreathe.
  - 5 Chiptunes (Action): divVerent/aaaaxy (license file: "License: CC0"),
    KOBUGE-Games/moon-dragoon, iamrequest/the-tall-wall-falls,
    nullstare/ReiLua, twills864/Valkyrie-Undying, dexdcimino/portfolio.
  - Boss Battle (loop): draphael123/bannerline ("License: CC0 1.0"),
    LWTBruce/Bonus-Guess ("CC0 / Public Domain; attribution requested by the
    author: Alex McCulloch"), AminDhouib/personal-portfolio (other Pro Sensory
    tracks are CC0 with credit appreciated but not required).
  Check the OpenGameArt pages from a normal browser before release.

## Where the files were downloaded from

- lobby: raw.githubusercontent.com/AminDhouib/personal-portfolio/HEAD/public/games/super-voltorb-flip/music/rookie.mp3
- bus: raw.githubusercontent.com/dexdcimino/portfolio/HEAD/games/stickland/v1/music/p1-junkala-level-1.ogg
  (that project transcoded it from the pack's original WAV)
- endgame: raw.githubusercontent.com/draphael123/bannerline/HEAD/assets/music/boss-storm-sovereign.mp3
- victory / defeat: git clone https://github.com/Beatscribe/homebrew_vgm

Note: Ogg Vorbis plays in all current Chrome/Firefox/Edge builds and in Safari
17+. For older Safari, transcode to MP3 (MP3 adds encoder padding, which hurts
gapless looping).

# typist — a typing rail shooter

An `own` game on the showroom's hall, from @jeffrey and Artur's thread
(2026-10-23): "like typing of the dead — type the whole word and the
character auto turns and shoots the switch and turns back; the characters in
the word are sub actions, so if you type incorrectly it only partially gets
there; one word at a time; could even work for a mobile keyboard."

## The loop

The hero glides down a hall toward a door. The door carries one switch per
word in the hall's phrase (one word, then two, then three). You type the
active word:

- each correct letter turns the hero a little further toward its switch and
  raises the arm along the line to it (the head leads from the first letter);
- the last letter fires: a flash, a line from the hand to the switch, the
  switch drops, the hero turns back and the next word lights up;
- a wrong letter costs one letter of progress and a frown — you only partly
  got there;
- every switch down lifts the door; reach a shut door and the hero bumps it
  and loses a heart. The word keeps what you typed — a bump never takes
  your letters. Three bumps end the run (Space restarts);
- each word, once typed, is spoken back in @jeffrey's voice.

## The doors

One syllable is a real short word ("sun", "door"); two and three are
consonant-vowel nonsense ("boyu", "popo", "rebo") — action events in letters.

| door | words |
| --- | --- |
| 1–2 | one word, one then two syllables |
| 3–4 | a single three-syllable word, at a faster glide (one word is less to type) |
| 5–6 | two words of mixed length (1–3 syllables) |
| 7–8 | three words of mixed length |
| 9+ | three words of three syllables each |

## Pace

The glide speeds up with every door cleared (less past the eighth, where the
all-three combos begin), more when accuracy is over 90%, less under 75%.
Every hall starts gently and ramps to full pace over its first third, so a
new kind of door is not also a wall of speed. Once a door's words are done
the hero sprints through it.

## Voice

`voice/*.mp3` are pre-rendered: one clip per real word and one per
consonant-vowel syllable spelt as it sounds (`bah beh bee boh boo …`),
ElevenLabs v3 in the jeffrey-pvc voice, trimmed so they butt together.
`lib/voice.mjs` schedules a word's syllables back to back on an
AudioContext, so any word the generator makes plays with no round trip.
Missing clips mean silence, not errors. Rendered by
`xbox/tools/oskiewar-typist-voice.mjs` in the oskiewar vault.

## What it shows

- `api.keys()` as a typing input (letters only, one press each).
- `api.figure` posed by progress: sixteen joints computed per tick, the
  body turned about the pelvis, the arm blended from rest to the aim line.
- `api.project` to draw the shot as a 2D line between two world points.
- `api.textWidth` to lay the phrase out letter by letter.
- `api.asset` + an AudioContext for clip playback with no engine audio API.

## Next

- A text field for phone keyboards (one word, submit).
- Vocabulary lists for language learning (Artur), with the translation shown
  on the door.
- Failure options as story: a bumped door could open onto a different hall.

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
- every switch down lifts the door; reach a shut door and the hero bumps it,
  loses a heart and the word resets. Three bumps end the run (Space restarts).

Even halls use short real words; odd halls use two-syllable nonsense
("boyu popo rebo") — three action events in letters.

## What it shows

- `api.keys()` as a typing input (letters only, one press each).
- `api.figure` posed by progress: sixteen joints computed per tick, the
  body turned about the pelvis, the arm blended from rest to the aim line.
- `api.project` to draw the shot as a 2D line between two world points.
- `api.textWidth` to lay the phrase out letter by letter.

## Next

- A text field for phone keyboards (one word, submit).
- Vocabulary lists for language learning (Artur), with the translation shown
  on the door.
- Failure options as story: a bumped door could open onto a different hall.

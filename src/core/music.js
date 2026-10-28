// Original sequenced music (composed for this project; not transcriptions of the game's score).
// Each track: { bpm, length (16th steps), loop, channels: [{ wave, vol, len, notes: [...] }] }
// notes entries: 'C4', 'F#3', numbers (Hz), or '.' for rest. Drums: 'k' kick, 's' snare, 'h' hat.
const R = '.';
function seq(str) { return str.trim().split(/\s+/); }

export const TRACKS = {
  menu: {
    bpm: 132, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.09, len: 2, notes: seq(`E5 . G5 . A5 . . . G5 . E5 . D5 . . . E5 . G5 . A5 . C6 . B5 . . . . . . .
        A5 . G5 . E5 . . . D5 . E5 . G5 . . . E5 . D5 . C5 . D5 . E5 . . . . . . .`) },
      { wave: 'triangle', vol: 0.18, len: 2, notes: seq(`A2 . A3 . A2 . A3 . F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 . E2 . E3 . E2 . E3 .
        A2 . A3 . A2 . A3 . F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 . A2 . A3 . A2 . A3 .`) },
      { drum: true, notes: seq('k . h . s . h . k . h k s . h .') },
    ],
  },
  battle: {
    bpm: 150, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 1, notes: seq(`D5 . D5 F5 . D5 G5 . A5 . G5 F5 . D5 C5 . D5 . . . . . . . F5 . E5 . D5 . C5 .
        D5 . D5 F5 . D5 G5 . A5 . C6 A5 . G5 F5 . G5 . . . A5 . . . E5 . . . . . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`D2 . D3 . D2 . D3 . D2 . D3 . C3 . C2 . Bb1 . Bb2 . Bb1 . Bb2 . C2 . C3 . C2 . C3 .
        D2 . D3 . D2 . D3 . D2 . D3 . C3 . C2 . Bb1 . Bb2 . C2 . C3 . A1 . A2 . A1 . A2 .`) },
      { drum: true, notes: seq('k . h . s . h k k . h . s . h h') },
    ],
  },
  results: {
    bpm: 110, length: 32, loop: false,
    channels: [
      { wave: 'square', vol: 0.1, len: 2, notes: seq('C5 . E5 . G5 . C6 . . . G5 . C6 . . . . . . . . . . . . . . . . . . .') },
      { wave: 'triangle', vol: 0.2, len: 4, notes: seq('C3 . . . G2 . . . C3 . . . . . . . . . . . . . . . . . . . . . . .') },
    ],
  },
  victory: {
    bpm: 120, length: 32, loop: false,
    channels: [
      { wave: 'square', vol: 0.11, len: 2, notes: seq('G4 . C5 . E5 . G5 . . . E5 . G5 . . . C6 . . . . . . . . . . . . . . .') },
      { wave: 'triangle', vol: 0.2, len: 4, notes: seq('C3 . . . E3 . . . G3 . . . C3 . . . . . . . . . . . . . . . . . . .') },
    ],
  },
};

// ---- Stage loops for Yoshi's Island, Saffron, Mushroom Kingdom, Meta Crystal, Duel Zone, Final
// Destination, bonus stages, How to Play and Dream Land. Original compositions (not transcriptions).
const STAGE_TRACKS = {
  yoshi: {
    bpm: 120, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 2, notes: seq(`F5 . A5 . C6 . A5 . Bb5 . G5 . E5 . C5 . D5 . F5 . A5 . F5 . G5 . . . . . . .
        F5 . A5 . C6 . D6 . C6 . A5 . F5 . G5 . A5 . G5 . F5 . E5 . F5 . . . . . . .`) },
      { wave: 'square', vol: 0.035, len: 2, notes: seq(`. . . . A4 . . . . . . . G4 . . . . . . . F4 . . . . . . . E4 . . .
        . . . . A4 . . . . . . . Bb4 . . . . . . . C5 . . . . . . . A4 . . .`) },
      { wave: 'triangle', vol: 0.2, len: 2, notes: seq(`F2 . . F3 C3 . . . Bb2 . . Bb3 C3 . . . D3 . . D3 A2 . . . G2 . . G3 C3 . . .
        F2 . . F3 C3 . . . Bb2 . . Bb3 C3 . . . A2 . . A3 C3 . . . F2 . . C3 F2 . . .`) },
      { drum: true, notes: seq('k . h . s . h h k . h . s . h .') },
    ],
  },
  saffron: {
    bpm: 140, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 2, notes: seq(`E5 . . G5 . . B5 . A5 . G5 . F#5 . . . E5 . . G5 . . B5 . D6 . B5 . A5 . . .
        C6 . B5 . A5 . G5 . F#5 . G5 . A5 . . . B5 . . . A5 . G5 . F#5 . D5 . E5 . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`E2 . E3 . E2 . E3 . E2 . E3 . D2 . D3 . C2 . C3 . C2 . C3 . D2 . D3 . D2 . D3 .
        A1 . A2 . A1 . A2 . B1 . B2 . B1 . B2 . E2 . E3 . E2 . E3 . B1 . B2 . D2 . D3 .`) },
      { drum: true, notes: seq('k . h k s . h . k . h k s . h h') },
    ],
  },
  mushroom: {
    bpm: 160, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 1, notes: seq(`C5 . E5 G5 . E5 C5 . D5 . F5 A5 . F5 D5 . E5 . G5 C6 . G5 E5 . F5 . E5 . D5 . . .
        C5 . E5 G5 . E5 C5 . D5 . F5 A5 . C6 B5 . C6 . G5 . E5 . D5 . C5 . . . . . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 . C3 . G2 . C3 . G2 . G2 . D3 . G2 . B2 .
        C3 . G2 . C3 . G2 . F2 . C3 . F2 . A2 . G2 . . . G2 . B2 . C3 . G2 . C3 . . .`) },
      { drum: true, notes: seq('k . h . s . h . k k h . s . h .') },
    ],
  },
  metacrystal: {
    bpm: 96, length: 64, loop: true,
    channels: [
      { wave: 'triangle', vol: 0.12, len: 1, notes: seq(`D4 F4 A4 D5 A4 F4 D4 F4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4
        G3 Bb3 D4 G4 D4 Bb3 G3 Bb3 A3 C#4 E4 A4 E4 C#4 A3 C#4`) },
      { wave: 'square', vol: 0.05, len: 4, notes: seq(`D5 . . . . . . . F5 . . . E5 . . . D5 . . . . . . . C#5 . . . . . . .
        F5 . . . G5 . . . A5 . . . Bb5 . . . A5 . . . . . . . . . . . . . . .`) },
      { wave: 'sine', vol: 0.22, len: 6, notes: seq('D2 . . . . . . . Bb1 . . . . . . . G1 . . . . . . . A1 . . . . . . .') },
      { drum: true, notes: seq('k . . . . . h . . . k . s . . .') },
    ],
  },
  duelzone: {
    bpm: 152, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 2, notes: seq(`A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 . E5 . . . E5 . D5 . C5 . B4 . C5 . . .
        A4 . C5 . E5 . A5 . B5 . C6 . B5 . G5 . A5 . . . . . . . E5 . . . A4 . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`A1 . A2 . A1 . A2 . F1 . F2 . F1 . F2 . G1 . G2 . G1 . G2 . E1 . E2 . E1 . E2 .
        A1 . A2 . A1 . A2 . F1 . F2 . G1 . G2 . A1 . A2 . A1 . A2 . E1 . E2 . E1 . E2 .`) },
      { drum: true, notes: seq('k . h . s . h . k . h k s . h .') },
    ],
  },
  final: {
    bpm: 168, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 2, notes: seq(`C5 . C5 . Eb5 . G5 . F5 . Eb5 . D5 . Bb4 . C5 . C5 . Eb5 . G5 . Ab5 . G5 . F5 . D5 .
        Eb5 . F5 . G5 . Ab5 . Bb5 . Ab5 . G5 . F5 . G5 . . . . . F5 Eb5 D5 . . . B4 . . .`) },
      { wave: 'sawtooth', vol: 0.06, len: 1, notes: seq(`C2 C2 C3 C2 C2 C3 C2 C2 Ab1 Ab1 Ab2 Ab1 Ab1 Ab2 Ab1 Ab1 C2 C2 C3 C2 C2 C3 C2 C2 F1 F1 F2 F1 F1 F2 F1 F1
        Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1 G1 G1 G2 G1 G1 G2 G1 G1 G1 G1 G2 G1 B1 B1 B2 B1`) },
      { wave: 'triangle', vol: 0.15, len: 1, notes: seq(`C3 . . . . . . . Ab2 . . . . . . . C3 . . . . . . . F2 . . . . . . .
        Eb3 . . . . . . . Bb2 . . . . . . . G2 . . . . . . . G2 . . . B2 . . .`) },
      { drum: true, notes: seq('k . h k s . h k k . h k s s h s') },
    ],
  },
  bonus: {
    bpm: 144, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 2, notes: seq(`G5 . B5 . D6 . B5 . C6 . A5 . F#5 . D5 . G5 . B5 . D6 . G6 . F#6 . D6 . E6 . . .
        E6 . D6 . C6 . B5 . A5 . B5 . C6 . A5 . G5 . D5 . G5 . . . . . . . . . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`G2 . D3 . G2 . D3 . D2 . A2 . D2 . F#2 . G2 . D3 . G2 . D3 . C3 . G2 . C3 . E3 .
        C3 . G2 . C3 . G2 . D2 . A2 . D2 . F#2 . G2 . D3 . G2 . B2 . G2 . . . D2 . . .`) },
      { drum: true, notes: seq('k . h . s . h . k . h k s . h h') },
    ],
  },
  howtoplay: {
    bpm: 112, length: 64, loop: true,
    channels: [
      { wave: 'triangle', vol: 0.14, len: 3, notes: seq(`A5 . . . C6 . . . A5 . G5 . F5 . . . G5 . . . A5 . . . G5 . E5 . C5 . . .
        A5 . . . C6 . . . D6 . C6 . A5 . . . G5 . . . F5 . . . F5 . . . . . . .`) },
      { wave: 'square', vol: 0.03, len: 2, notes: seq(`. . F4 . . . A4 . . . F4 . . . A4 . . . E4 . . . G4 . . . E4 . . . G4 .
        . . D4 . . . F4 . . . D4 . . . F4 . . . E4 . . . G4 . . . C4 . . . A4 .`) },
      { wave: 'triangle', vol: 0.2, len: 3, notes: seq(`F2 . . . C3 . . . F2 . . . C3 . . . C2 . . . G2 . . . C2 . . . G2 . . .
        Bb1 . . . F2 . . . Bb1 . . . F2 . . . C2 . . . G2 . . . F2 . . . C3 . . .`) },
      { drum: true, notes: seq('k . . . h . . . s . . . h . . .') },
    ],
  },
};
// Dream Land loop only if no other module has defined one.
if (!TRACKS.dreamland) STAGE_TRACKS.dreamland = {
  bpm: 138, length: 64, loop: true,
  channels: [
    { wave: 'square', vol: 0.08, len: 2, notes: seq(`E5 . G5 . C6 . . . B5 . A5 . G5 . . . A5 . F5 . A5 . C6 . B5 . . . . . . .
      E5 . G5 . C6 . E6 . D6 . C6 . B5 . A5 . G5 . A5 . B5 . . . C6 . . . . . . .`) },
    { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`C3 . G2 . C3 . G2 . E2 . B2 . E2 . B2 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 .
      A2 . E3 . A2 . E3 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 . C3 . G2 . C3 . . .`) },
    { drum: true, notes: seq('k . h . s . h . k . h . s . h h') },
  ],
};
for (const [k, v] of Object.entries(STAGE_TRACKS)) if (!TRACKS[k]) TRACKS[k] = v;

// ---- VS stage loops: Peach's Castle (cheerful), Sector Z (heroic space), Congo Jungle (tribal drums),
// Planet Zebes (eerie), Hyrule Castle (adventurous). Original compositions written for this project.
const VS5_TRACKS = {
  peach: {
    bpm: 140, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 2, notes: seq(`F5 . A5 . C6 . A5 . G5 . . . E5 . C5 . D5 . F5 . A5 . G5 . F5 . . . . . . .
        Bb5 . A5 . G5 . F5 . E5 . G5 . C6 . . . A5 . G5 . F5 . E5 . F5 . . . . . . .`) },
      { wave: 'square', vol: 0.03, len: 1, notes: seq(`. . A4 . . . A4 . . . G4 . . . G4 . . . F4 . . . F4 . . . A4 . . . A4 .
        . . D5 . . . D5 . . . E4 . . . G4 . . . C5 . . . Bb4 . . . A4 . . . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`F2 . C3 . F2 . C3 . C2 . G2 . C2 . G2 . Bb1 . F2 . Bb1 . F2 . F2 . C3 . F2 . C3 .
        G2 . D3 . G2 . D3 . C2 . G2 . C2 . E2 . F2 . C3 . C2 . G2 . F2 . C3 . F2 . . .`) },
      { drum: true, notes: seq('k . h . s . h . k . h k s . h .') },
    ],
  },
  sectorz: {
    bpm: 150, length: 64, loop: true,
    channels: [
      { wave: 'sawtooth', vol: 0.06, len: 3, notes: seq(`D5 . . . A4 . D5 . E5 . F5 . . . E5 . D5 . . . C5 . . . A4 . . . . . . .
        Bb4 . . . F5 . . . E5 . D5 . C5 . D5 . A5 . . . . . G5 . F5 . E5 . . . . .`) },
      { wave: 'triangle', vol: 0.12, len: 8, notes: seq(`A3 . . . . . . . G3 . . . . . . . F3 . . . . . . . E3 . . . . . . .
        D3 . . . . . . . F3 . . . . . . . A3 . . . . . . . C#4 . . . . . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`D2 D2 D3 D2 D2 D2 D3 D2 C2 C2 C3 C2 C2 C2 C3 C2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 A1 A1 A2 A1 A1 A1 A2 A1
        G1 G1 G2 G1 G1 G1 G2 G1 Bb1 Bb1 Bb2 Bb1 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 D3 D2 A1 A1 A2 A1 C#2 C#2 C#3 C#2`) },
      { drum: true, notes: seq('k . h k s . h . k . h k s . h h') },
    ],
  },
  congo: {
    bpm: 128, length: 64, loop: true,
    channels: [
      { wave: 'triangle', vol: 0.14, len: 1, sustain: 0.05, notes: seq(`A4 . C5 . E5 . . . D5 . C5 . A4 . . . G4 . A4 . C5 . . . A4 . . . . . . .
        E5 . G5 . A5 . G5 . E5 . D5 . C5 . D5 . E5 . . . C5 . A4 . G4 . A4 . . . . .`) },
      { wave: 'triangle', vol: 0.26, len: 1, sustain: 0.05, notes: seq('A2 . A2 E2 . . G2 . A2 . . E2 G2 . E2 .') },
      { wave: 'square', vol: 0.05, len: 2, notes: seq(`A1 . . . A1 . . . G1 . . . E1 . . . A1 . . . A1 . . . C2 . . . G1 . . .
        A1 . . . A1 . . . D2 . . . C2 . . . E1 . . . G1 . . . A1 . . . . . . .`) },
      { drum: true, notes: seq('k . . k s . k . k . . k s . s s') },
      { drum: true, notes: seq('h . h h . h h . h . h h . h h .') },
    ],
  },
  zebes: {
    bpm: 90, length: 64, loop: true,
    channels: [
      { wave: 'triangle', vol: 0.2, len: 16, notes: seq(`E2 . . . . . . . . . . . . . . . F2 . . . . . . . . . . . . . . .
        E2 . . . . . . . . . . . . . . . Bb1 . . . . . . . . . . . . . . .`) },
      { wave: 'square', vol: 0.045, len: 6, notes: seq(`B4 . . . . . . . Bb4 . . . . . . . E5 . . . F5 . . . . . . . . . . .
        B4 . . . . . . . C5 . . . . . . . Bb4 . . . A4 . . . . . . . . . . .`) },
      { wave: 'sine', vol: 0.06, len: 1, notes: seq(`. . E6 . . . . . . . . . . Bb5 . . . . . . . . F6 . . . . . . . . .
        . . E6 . . . . . . . . . B5 . . . . . . . . . . . Bb5 . . . . . . .`) },
      { drum: true, notes: seq('k . . . . . . . . . s . . . . . k . . . . . k . . . s . . . . .') },
    ],
  },
  hyrule: {
    bpm: 132, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.08, len: 3, notes: seq(`G4 . . . D5 . . . . . C5 D5 E5 . F#5 . G5 . . . . . D5 . . . . . B4 . . .
        C5 . . . E5 . . . A5 . . . G5 . F#5 . G5 . . . . . . . . . . . . . . .`) },
      { wave: 'triangle', vol: 0.12, len: 8, notes: seq(`B3 . . . . . . . A3 . . . . . . . B3 . . . . . . . G3 . . . . . . .
        E3 . . . . . . . C4 . . . . . . . B3 . . . . . . . D4 . . . . . . .`) },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq(`G2 . G2 . D2 . D2 . G2 . G2 . D2 . F#2 . G2 . G2 . D2 . D2 . G2 . B2 . D3 . . .
        C2 . C2 . G2 . G2 . A2 . A2 . D2 . D2 . G2 . D2 . G2 . D2 . G2 . . . D2 . . .`) },
      { drum: true, notes: seq('k . s . k . s s k . s . k s s s') },
    ],
  },
};
for (const [k, v] of Object.entries(VS5_TRACKS)) if (!TRACKS[k]) TRACKS[k] = v;

// ---- 1P mode tracks (src/modes/): Training, VS card sting, Stage Clear, Continue, Game Over, Challenger, Ending.
// Original compositions (not transcriptions).
const ONEP_TRACKS = {
  training: {
    bpm: 112, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.07, len: 2, notes: seq(`C5 . E5 . G5 . E5 . F5 . A5 . G5 . . . E5 . G5 . C6 . B5 . A5 . G5 . . . .
        D5 . F5 . A5 . F5 . G5 . B5 . A5 . . . G5 . E5 . D5 . C5 . D5 . E5 . . . .`) },
      { wave: 'triangle', vol: 0.18, len: 2, notes: seq(`C3 . . G2 C3 . . . F2 . . C3 F2 . . . A2 . . E3 A2 . . . G2 . . D3 G2 . . .
        D3 . . A2 D3 . . . G2 . . D3 G2 . . . C3 . . G2 A2 . . . G2 . . B2 C3 . . .`) },
      { drum: true, notes: seq('k . h . s . h . k k h . s . h .') },
    ],
  },
  p1card: {
    bpm: 140, length: 32, loop: false,
    channels: [
      { wave: 'square', vol: 0.1, len: 1, notes: seq('G4 . C5 . E5 . G5 . . . E5 G5 . . C6 . . . . . . . . . . . . . . . . .') },
      { wave: 'triangle', vol: 0.2, len: 2, notes: seq('C3 . . . G2 . . . C3 . . . . . . . . . . . . . . . . . . . . . . .') },
      { drum: true, notes: seq('k . . . s . . . k . s . k . . . . . . . . . . . . . . . . . . .') },
    ],
  },
  stageclear: {
    bpm: 132, length: 32, loop: false,
    channels: [
      { wave: 'square', vol: 0.11, len: 1, notes: seq('C5 D5 E5 G5 . . E5 G5 C6 . . . B5 . C6 . D6 . . . . . . . . . . . . . . .') },
      { wave: 'triangle', vol: 0.2, len: 2, notes: seq('C3 . . . E3 . . . F3 . . . G3 . . . C3 . . . . . . . . . . . . . . .') },
    ],
  },
  continue: {
    bpm: 84, length: 32, loop: true,
    channels: [
      { wave: 'triangle', vol: 0.14, len: 3, notes: seq('A4 . . . C5 . . . B4 . . . E4 . . . F4 . . . A4 . . . G#4 . . . . . . .') },
      { wave: 'sine', vol: 0.12, len: 4, notes: seq('A2 . . . . . . . G2 . . . . . . . F2 . . . . . . . E2 . . . . . . .') },
    ],
  },
  gameover: {
    bpm: 72, length: 32, loop: false,
    channels: [
      { wave: 'triangle', vol: 0.15, len: 3, notes: seq('E5 . . . D5 . . . C5 . . . B4 . . . A4 . . . . . . . . . . . . . . .') },
      { wave: 'sine', vol: 0.12, len: 6, notes: seq('A2 . . . . . . . E2 . . . . . . . A1 . . . . . . . . . . . . . . .') },
    ],
  },
  challenger: {
    bpm: 150, length: 32, loop: true,
    channels: [
      { wave: 'sawtooth', vol: 0.05, len: 1, notes: seq('E4 . E4 . F4 . E4 . E4 . E4 . F4 . G4 . E4 . E4 . F4 . E4 . D#4 . D#4 . E4 . . .') },
      { wave: 'triangle', vol: 0.2, len: 1, notes: seq('E2 . E2 E2 . . E2 . E2 . E2 E2 . . F2 . E2 . E2 E2 . . E2 . D#2 . D#2 D#2 . . E2 .') },
      { drum: true, notes: seq('k . . k s . . . k . . k s . k .') },
    ],
  },
  ending: {
    bpm: 96, length: 64, loop: true,
    channels: [
      { wave: 'square', vol: 0.07, len: 3, notes: seq(`G4 . . . C5 . . . E5 . . . D5 . . . C5 . . . A4 . . . G4 . . . . . . .
        A4 . . . D5 . . . F5 . . . E5 . . . D5 . . . B4 . . . C5 . . . . . . .`) },
      { wave: 'triangle', vol: 0.18, len: 4, notes: seq(`C3 . . . . . . . A2 . . . . . . . F2 . . . . . . . G2 . . . . . . .
        D3 . . . . . . . B2 . . . . . . . G2 . . . . . . . C3 . . . . . . .`) },
    ],
  },
};
for (const [k, v] of Object.entries(ONEP_TRACKS)) if (!TRACKS[k]) TRACKS[k] = v;

// Item themes (original): invincibility star and hammer
const ITEM_TRACKS = {
  star: { bpm: 190, length: 32, loop: true, channels: [
    { wave: 'square', vol: 0.09, len: 1, notes: seq('C5 . C5 . C5 . D5 C5 . C5 . D5 . C5 . B4 . B4 . B4 . C5 B4 . B4 . C5 . B4 .') },
    { wave: 'triangle', vol: 0.2, len: 1, notes: seq('F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3') },
    { drum: true, notes: seq('k h s h k h s h') } ] },
  hammer: { bpm: 176, length: 32, loop: true, channels: [
    { wave: 'square', vol: 0.09, len: 1, notes: seq('G4 . G4 . A4 G4 . E4 . C4 . E4 . G4 . . A4 . A4 . B4 A4 . F4 . D4 . F4 . A4 . .') },
    { wave: 'triangle', vol: 0.2, len: 1, notes: seq('C3 . G2 . C3 . G2 . C3 . G2 . C3 . G2 . D3 . A2 . D3 . A2 . D3 . A2 . G2 . B2 .') },
    { drum: true, notes: seq('k . s . k k s .') } ] },
};
for (const [k, v] of Object.entries(ITEM_TRACKS)) if (!TRACKS[k]) TRACKS[k] = v;

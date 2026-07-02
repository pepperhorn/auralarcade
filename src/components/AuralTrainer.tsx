import {
  Award,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  Info,
  Keyboard,
  Mic,
  Music2,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  Waves
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import rhythmBank from "../data/rhythm-examples.json";
import "./AuralTrainer.css";

type Grade =
  | "Preliminary"
  | "Grade 1"
  | "Grade 2"
  | "Grade 3"
  | "Grade 4"
  | "Grade 5"
  | "Grade 6"
  | "Grade 7"
  | "Grade 8";

type AnswerMode = "choice" | "sung" | "played" | "rhythm";
type ExerciseKind = "rhythm" | "interval" | "melody" | "harmony" | "cadence" | "memory";
type RhythmTone = "kick" | "snare" | "clap" | "hi-hat" | "mid-tom" | "low-tom" | "cowbell";

type Exercise = {
  id: string;
  grade: Grade;
  kind: ExerciseKind;
  title: string;
  prompt: string;
  answerMode: AnswerMode;
  notes?: number[];
  lowerPart?: number[];
  rhythm?: number[];
  meter?: "duple" | "triple";
  options?: string[];
  correct: string;
  targetMidi?: number;
  sungBonus?: boolean;
  revealCopy?: string;
};

type AudioKit = {
  context: AudioContext;
  piano: any;
  drums: any;
};

type RhythmBankExample = {
  id: string;
  grade: Grade;
  title: string;
  prompt: string;
  answerMode: "choice" | "rhythm";
  meter: "duple" | "triple";
  rhythm: number[];
  options?: string[];
  correct: string;
};

const beatSeconds = 0.55;
const repeatGapSeconds = 1.1;
const rhythmToneOptions: Array<{ value: RhythmTone; label: string; note: string }> = [
  { value: "kick", label: "Kick", note: "kick" },
  { value: "snare", label: "Snare", note: "snare" },
  { value: "clap", label: "Clap", note: "clap" },
  { value: "hi-hat", label: "Hi-hat", note: "hi-hat" },
  { value: "mid-tom", label: "Mid tom", note: "mid-tom" },
  { value: "low-tom", label: "Low tom", note: "low-tom" },
  { value: "cowbell", label: "Cowbell", note: "cowbell" }
];

const grades: Grade[] = [
  "Preliminary",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8"
];

const gradeSummaries: Record<Grade, string> = {
  Preliminary: "Beat, rhythm echo, five-note pitch echo, higher/lower notes.",
  "Grade 1": "Tonic finish, duple/triple rhythm echo, short melodic phrase.",
  "Grade 2": "Rhythm echo, melodic phrase, higher/lower notes from two-note sounds.",
  "Grade 3": "Meter, melody, simultaneous higher/lower notes, scale intervals to a fifth.",
  "Grade 4": "Meter, major-scale intervals, two-part memory, middle note of triads.",
  "Grade 5": "Meter, major-scale intervals, three-interval two-part memory, triad singing.",
  "Grade 6": "Major and harmonic minor intervals, triad position, cadences, four-interval parts.",
  "Grade 7": "Triad quality and position, cadences, printed memory, two-part lower/higher phrase.",
  "Grade 8": "Major/minor/diminished triads, all principal cadences, longer memory, lower-part recall."
};

const optionDefinitions: Record<string, string> = {
  "First note": "Choose this when the first note sounded higher than the second.",
  "Second note": "Choose this when the second note sounded higher than the first.",
  "Same note": "Choose this only if both notes are the same pitch.",
  "Cannot tell": "Use this if you are unsure, then replay and listen for the higher pitch.",
  C4: "Middle C on the piano.",
  D4: "The note D just above middle C.",
  E4: "The note E just above middle C.",
  G4: "The note G above middle C.",
  Second: "A step from the keynote to the next scale note.",
  Third: "Three letter names apart, such as C to E.",
  Fourth: "Four letter names apart, such as C to F.",
  Fifth: "Five letter names apart, such as C to G.",
  "Major second": "Two semitones above the keynote.",
  "Major third": "Four semitones above the keynote.",
  "Perfect fifth": "Seven semitones above the keynote.",
  "Major sixth": "Nine semitones above the keynote.",
  Octave: "The same note name eight scale degrees higher.",
  "Minor sixth": "Eight semitones above the keynote.",
  "Minor seventh": "Ten semitones above the keynote.",
  "Duple time": "Beats grouped in twos, with a strong beat then a weaker beat.",
  "Triple time": "Beats grouped in threes, with one strong beat followed by two weaker beats.",
  "Simple quadruple": "Four beats in a bar, commonly felt as strong, weak, medium, weak.",
  "Free time": "Music without a regular repeating beat pattern.",
  "Major triad": "A three-note chord with a major third and perfect fifth above the root.",
  "Minor triad": "A three-note chord with a minor third and perfect fifth above the root.",
  "Diminished triad": "A three-note chord built from two minor thirds; it sounds tense or narrow.",
  "Augmented triad": "A three-note chord built from two major thirds; it sounds widened or unsettled.",
  "Major root position": "A major triad with its root as the lowest note.",
  "Minor root position": "A minor triad with its root as the lowest note.",
  "Minor first inversion": "A minor triad with its third as the lowest note.",
  "Major second inversion": "A major triad with its fifth as the lowest note.",
  "Minor second inversion": "A minor triad with its fifth as the lowest note.",
  "Diminished root position": "A diminished triad with its root as the lowest note.",
  "Perfect cadence": "A dominant-to-tonic ending, V to I, with a strong finished sound.",
  "Plagal cadence": "A subdominant-to-tonic ending, IV to I.",
  "Interrupted cadence": "A dominant chord that avoids the tonic, usually V to vi.",
  "Imperfect cadence": "A phrase ending on the dominant chord, leaving the music unfinished."
};

const coreExercises: Exercise[] = [
  {
    id: "pre-time",
    grade: "Preliminary",
    kind: "rhythm",
    title: "Steady Beat Launch",
    prompt: "Clap or tap the beat after the piano stops.",
    answerMode: "rhythm",
    rhythm: [1, 1, 1, 1, 1, 1],
    meter: "duple",
    correct: "steady beat"
  },
  {
    id: "pre-high-low",
    grade: "Preliminary",
    kind: "interval",
    title: "Higher Or Lower",
    prompt: "Which note was higher?",
    answerMode: "choice",
    notes: [60, 65],
    options: ["First note", "Second note", "Same note", "Cannot tell"],
    correct: "Second note"
  },
  {
    id: "g1-tonic",
    grade: "Grade 1",
    kind: "melody",
    title: "Find Home Base",
    prompt: "Sing or play the tonic that completes the phrase.",
    answerMode: "sung",
    notes: [60, 62, 64, 67, 62],
    targetMidi: 60,
    correct: "C4",
    sungBonus: true
  },
  {
    id: "g1-rhythm",
    grade: "Grade 1",
    kind: "rhythm",
    title: "Rhythm Echo",
    prompt: "Tap the passage after hearing it twice.",
    answerMode: "rhythm",
    rhythm: [1, 0.5, 0.5, 1, 1],
    meter: "duple",
    correct: "rhythm"
  },
  {
    id: "g2-higher",
    grade: "Grade 2",
    kind: "interval",
    title: "Two-Note Stack",
    prompt: "Hum or identify the higher note in the simultaneous pair.",
    answerMode: "choice",
    notes: [60, 67],
    options: ["C4", "D4", "E4", "G4"],
    correct: "G4"
  },
  {
    id: "g3-meter",
    grade: "Grade 3",
    kind: "rhythm",
    title: "Meter Scout",
    prompt: "Tap the rhythm and choose whether it is duple or triple.",
    answerMode: "choice",
    rhythm: [1, 0.5, 0.5, 1, 1, 1, 1],
    meter: "triple",
    options: ["Duple time", "Triple time", "Simple quadruple", "Free time"],
    correct: "Triple time"
  },
  {
    id: "g3-interval",
    grade: "Grade 3",
    kind: "interval",
    title: "Scale Distance",
    prompt: "Name the interval from the keynote.",
    answerMode: "choice",
    notes: [60, 65],
    options: ["Second", "Third", "Fourth", "Fifth"],
    correct: "Fourth"
  },
  {
    id: "g4-major-interval",
    grade: "Grade 4",
    kind: "interval",
    title: "Major-Scale Interval",
    prompt: "Name the interval from the keynote.",
    answerMode: "choice",
    notes: [60, 69],
    options: ["Major second", "Major third", "Perfect fifth", "Major sixth", "Octave"],
    correct: "Major sixth"
  },
  {
    id: "g4-triad-middle",
    grade: "Grade 4",
    kind: "harmony",
    title: "Middle Note Rescue",
    prompt: "Sing or play the middle note of the triad.",
    answerMode: "sung",
    notes: [64, 67, 72],
    targetMidi: 67,
    correct: "G4",
    sungBonus: true
  },
  {
    id: "g5-triad-all",
    grade: "Grade 5",
    kind: "harmony",
    title: "Triad Ladder",
    prompt: "Sing or play the three notes of the chord, then identify the quality.",
    answerMode: "choice",
    notes: [57, 60, 65],
    options: ["Major triad", "Minor triad", "Diminished triad", "Augmented triad"],
    correct: "Minor triad"
  },
  {
    id: "g5-two-part",
    grade: "Grade 5",
    kind: "melody",
    title: "Upper Path",
    prompt: "Recall the higher part of the slow two-part progression.",
    answerMode: "played",
    notes: [52, 60, 55, 64, 57, 65, 59, 67],
    lowerPart: [52, 55, 57, 59],
    options: ["C4 E4 F4 G4", "C4 E4 F4 A4", "D4 E4 G4 A4", "C4 D4 F4 G4"],
    correct: "C4 E4 F4 G4"
  },
  {
    id: "g6-minor-interval",
    grade: "Grade 6",
    kind: "interval",
    title: "Harmonic Minor Signal",
    prompt: "Name the interval from the keynote.",
    answerMode: "choice",
    notes: [60, 68],
    options: ["Minor sixth", "Major sixth", "Minor seventh", "Major third", "Perfect fifth"],
    correct: "Minor sixth"
  },
  {
    id: "g6-cadence",
    grade: "Grade 6",
    kind: "cadence",
    title: "Cadence Gate",
    prompt: "Recognise the cadence at the end of the phrase.",
    answerMode: "choice",
    notes: [60, 64, 67, 65, 69, 72, 67, 71, 74, 60, 64, 67],
    options: ["Perfect cadence", "Plagal cadence", "Interrupted cadence", "Imperfect cadence"],
    correct: "Perfect cadence"
  },
  {
    id: "g7-position",
    grade: "Grade 7",
    kind: "harmony",
    title: "Triad Identity",
    prompt: "State the triad quality and position.",
    answerMode: "choice",
    notes: [64, 69, 72],
    options: ["Major root position", "Minor first inversion", "Major second inversion", "Diminished root position"],
    correct: "Minor first inversion"
  },
  {
    id: "g7-memory",
    grade: "Grade 7",
    kind: "memory",
    title: "Printed Memory Sprint",
    prompt: "Study the phrase, then answer from memory.",
    answerMode: "choice",
    notes: [62, 64, 65, 69, 67, 64],
    options: ["D E F A G E", "D F E A G E", "C E F A G E", "D E F G A E"],
    correct: "D E F A G E",
    revealCopy: "D E F A G E"
  },
  {
    id: "g8-dim-triad",
    grade: "Grade 8",
    kind: "harmony",
    title: "Triad Boss",
    prompt: "Recognise the triad quality and position where required.",
    answerMode: "choice",
    notes: [59, 62, 65],
    options: ["Major root position", "Minor second inversion", "Diminished triad", "Augmented triad", "Minor root position"],
    correct: "Diminished triad"
  },
  {
    id: "g8-lower-part",
    grade: "Grade 8",
    kind: "melody",
    title: "Lower Line Recall",
    prompt: "Listen to the two-part phrase and identify the lower part.",
    answerMode: "played",
    notes: [48, 60, 50, 62, 52, 64, 53, 65, 55, 67, 57, 69],
    lowerPart: [48, 50, 52, 53, 55, 57],
    options: ["C D E F G A", "C E D F G A", "D E F G A B", "C D F E G A"],
    correct: "C D E F G A"
  }
];

const generatedRhythmExercises: Exercise[] = (rhythmBank.examples as RhythmBankExample[]).map((example) => ({
  id: example.id,
  grade: example.grade,
  kind: "rhythm",
  title: example.title,
  prompt: example.prompt,
  answerMode: example.answerMode,
  rhythm: example.rhythm,
  meter: example.meter,
  options: example.options,
  correct: example.correct
}));

const exercises: Exercise[] = [
  ...generatedRhythmExercises,
  ...coreExercises.filter((exercise) => exercise.kind !== "rhythm")
];

let audioKitPromise: Promise<AudioKit> | null = null;

function midiToName(midi: number) {
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function frequencyToMidi(freq: number) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

async function getAudioKit(): Promise<AudioKit> {
  if (!audioKitPromise) {
    audioKitPromise = (async () => {
      const { DrumMachine, Soundfont } = await import("smplr");
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextCtor();
      // FluidR3_GM acoustic grand loads as a single soundfont file (~hundreds of KB)
      // instead of SplendidGrandPiano's ~20MB / 340+ individual sample requests.
      const piano = Soundfont(context, {
        instrument: "acoustic_grand_piano",
        kit: "FluidR3_GM",
        volume: 96
      });
      const drums = DrumMachine(context, { instrument: "TR-808", volume: 78 });
      await Promise.allSettled([piano.ready, drums.ready]);
      return { context, piano, drums };
    })();
  }

  const kit = await audioKitPromise;
  if (kit.context.state !== "running") {
    await kit.context.resume();
  }
  return kit;
}

function applyExampleVolume({ piano, drums }: Pick<AudioKit, "piano" | "drums">, exampleVolume: number) {
  piano.output.volume = exampleVolume;
  drums.output.volume = Math.max(16, Math.round(exampleVolume * 0.82));
}

function scaledVelocity(baseVelocity: number, exampleVolume: number) {
  return Math.max(1, Math.round(baseVelocity * (exampleVolume / 127)));
}

function rhythmToneNote(rhythmTone: RhythmTone) {
  return rhythmToneOptions.find((option) => option.value === rhythmTone)?.note ?? "kick";
}

function playDrumTone(drums: any, rhythmTone: RhythmTone, options: { time: number; duration: number; velocity: number }) {
  const note = rhythmToneNote(rhythmTone);
  const groups = typeof drums.getGroupNames === "function" ? drums.getGroupNames() : [];
  drums.start({ note: groups.includes(note) ? note : "kick", ...options });
}

function exampleDurationSeconds(exercise: Exercise) {
  const repeats = exercise.grade === "Preliminary" ? 1 : 2;
  const rhythmBeats = exercise.rhythm?.reduce((total, value) => total + value, 0) ?? 0;
  const noteBeats = exercise.notes
    ? exercise.kind === "harmony"
      ? 2.3
      : exercise.kind === "cadence"
        ? Math.ceil(exercise.notes.length / 3)
        : exercise.notes.length > 7 && exercise.notes.length % 2 === 0
          ? exercise.notes.length / 2
          : exercise.notes.length
    : 0;
  const repeatDuration = Math.max(rhythmBeats, noteBeats, 1) * beatSeconds;
  return repeats * repeatDuration + Math.max(0, repeats - 1) * repeatGapSeconds + 0.35;
}

function playExercise(
  exercise: Exercise,
  exampleVolume: number,
  getRhythmTone: () => RhythmTone,
  rhythmEventTimers: number[]
) {
  return getAudioKit().then(({ context, piano, drums }) => {
    applyExampleVolume({ piano, drums }, exampleVolume);
    const repeats = exercise.grade === "Preliminary" ? 1 : 2;
    const rhythmBeats = exercise.rhythm?.reduce((total, value) => total + value, 0) ?? 0;
    const noteBeats = exercise.notes
      ? exercise.kind === "harmony"
        ? 2.3
        : exercise.kind === "cadence"
          ? Math.ceil(exercise.notes.length / 3)
          : exercise.notes.length > 7 && exercise.notes.length % 2 === 0
            ? exercise.notes.length / 2
            : exercise.notes.length
      : 0;
    const repeatDuration = Math.max(rhythmBeats, noteBeats, 1) * beatSeconds;
    const now = context.currentTime + 0.14;

    for (let r = 0; r < repeats; r += 1) {
      const offset = now + r * (repeatDuration + repeatGapSeconds);

      if (exercise.rhythm) {
        let cursor = offset;
        let beatPosition = 0;
        const beatsPerBar = exercise.meter === "triple" ? 3 : 2;
        exercise.rhythm.forEach((value) => {
          const accent = Math.abs(beatPosition % beatsPerBar) < 0.001;
          const hitTime = cursor;
          const timerDelay = Math.max(0, (hitTime - context.currentTime - 0.08) * 1000);
          const timer = window.setTimeout(() => {
            playDrumTone(drums, getRhythmTone(), {
              time: hitTime,
              duration: 0.12,
              velocity: scaledVelocity(accent ? 96 : 58, exampleVolume)
            });
          }, timerDelay);
          rhythmEventTimers.push(timer);
          cursor += value * beatSeconds;
          beatPosition += value;
        });
      }

      if (exercise.notes) {
        if (exercise.kind === "harmony") {
          exercise.notes.forEach((note) => {
            piano.start({ note, time: offset, duration: 1.25, velocity: scaledVelocity(72, exampleVolume) });
          });
        } else if (exercise.kind === "cadence") {
          for (let i = 0; i < exercise.notes.length; i += 3) {
            exercise.notes.slice(i, i + 3).forEach((note) => {
              piano.start({
                note,
                time: offset + (i / 3) * beatSeconds,
                duration: beatSeconds * 0.9,
                velocity: scaledVelocity(74, exampleVolume)
              });
            });
          }
        } else if (exercise.notes.length > 7 && exercise.notes.length % 2 === 0) {
          for (let i = 0; i < exercise.notes.length; i += 2) {
            piano.start({
              note: exercise.notes[i],
              time: offset + (i / 2) * beatSeconds,
              duration: beatSeconds * 0.9,
              velocity: scaledVelocity(70, exampleVolume)
            });
            piano.start({
              note: exercise.notes[i + 1],
              time: offset + (i / 2) * beatSeconds,
              duration: beatSeconds * 0.9,
              velocity: scaledVelocity(72, exampleVolume)
            });
          }
        } else {
          exercise.notes.forEach((note, index) => {
            piano.start({
              note,
              time: offset + index * beatSeconds,
              duration: beatSeconds * 0.85,
              velocity: scaledVelocity(78, exampleVolume)
            });
          });
        }
      }
    }
  });
}

function scoreForLevel(points: number) {
  return Math.max(1, Math.floor(points / 120) + 1);
}

function randomExerciseIndex(length: number, previousIndex?: number) {
  if (length <= 1) return 0;
  let nextIndex = Math.floor(Math.random() * length);
  if (previousIndex !== undefined && nextIndex === previousIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (length - 1))) % length;
  }
  return nextIndex;
}

export default function AuralTrainer() {
  const [grade, setGrade] = useState<Grade>("Grade 3");
  const [levelsOpen, setLevelsOpen] = useState(true);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [points, setPoints] = useState(80);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState("Choose a drill and press play.");
  const [feedback, setFeedback] = useState<{ id: number; tone: "neutral" | "correct" | "incorrect" }>({
    id: 0,
    tone: "neutral"
  });
  const [audioState, setAudioState] = useState<"idle" | "loading" | "ready">("idle");
  const [isPlayingExample, setIsPlayingExample] = useState(false);
  const [exampleVolume, setExampleVolume] = useState(86);
  const [rhythmTone, setRhythmTone] = useState<RhythmTone>("clap");
  const [answerMode, setAnswerMode] = useState<"sung" | "played">("sung");
  const [selected, setSelected] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [hasCheckedAnswer, setHasCheckedAnswer] = useState(false);
  const [micState, setMicState] = useState<"idle" | "listening" | "done">("idle");
  const [detected, setDetected] = useState<string>("None");
  const [sungMidi, setSungMidi] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(true);
  const taps = useRef<number[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<any>(null);
  const detectedMidiRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const playLockRef = useRef<number | null>(null);
  const rhythmToneRef = useRef<RhythmTone>("clap");
  const rhythmEventTimersRef = useRef<number[]>([]);

  const gradeExercises = useMemo(() => exercises.filter((exercise) => exercise.grade === grade), [grade]);
  const exercise = gradeExercises[exerciseIndex % gradeExercises.length];
  const level = scoreForLevel(points);
  const progress = Math.min(100, points % 120 === 0 ? 100 : ((points % 120) / 120) * 100);

  useEffect(() => {
    setExerciseIndex((previousIndex) => randomExerciseIndex(gradeExercises.length, previousIndex));
  }, [grade, gradeExercises.length]);

  useEffect(() => {
    if (!audioKitPromise) return;
    void audioKitPromise.then((kit) => applyExampleVolume(kit, exampleVolume));
  }, [exampleVolume]);

  useEffect(() => {
    rhythmToneRef.current = rhythmTone;
  }, [rhythmTone]);

  useEffect(() => {
    return () => {
      if (playLockRef.current) window.clearTimeout(playLockRef.current);
      rhythmEventTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  async function startAudio() {
    setAudioState("loading");
    setStatus("Loading piano and rhythm samples...");
    const kit = await getAudioKit();
    const { context, drums } = kit;
    applyExampleVolume(kit, exampleVolume);
    const warmupTime = context.currentTime + 0.04;
    playDrumTone(drums, rhythmTone, { time: warmupTime, duration: 0.05, velocity: 1 });
    setAudioState("ready");
    setStatus("Audio ready. Press Play example.");
  }

  async function playCurrentExercise() {
    if (isPlayingExample) return;
    setIsPlayingExample(true);
    rhythmEventTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    rhythmEventTimersRef.current = [];

    try {
      if (audioState !== "ready") {
        await startAudio();
      }

      await playExercise(exercise, exampleVolume, () => rhythmToneRef.current, rhythmEventTimersRef.current);
      if (playLockRef.current) window.clearTimeout(playLockRef.current);
      playLockRef.current = window.setTimeout(() => {
        setIsPlayingExample(false);
        playLockRef.current = null;
        rhythmEventTimersRef.current = [];
      }, exampleDurationSeconds(exercise) * 1000);
    } catch (error) {
      setIsPlayingExample(false);
      setStatus("Audio playback could not start. Try Start audio again.");
      throw error;
    }
  }

  function clearAnswerState() {
    setSelected("");
    setAttempts(0);
    setHasCheckedAnswer(false);
    setDetected("None");
    setSungMidi(null);
    setMicState("idle");
    setRevealed(true);
    taps.current = [];
  }

  function goOn(nextGrade = grade) {
    if (playLockRef.current) {
      window.clearTimeout(playLockRef.current);
      playLockRef.current = null;
    }
    rhythmEventTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    rhythmEventTimersRef.current = [];
    setIsPlayingExample(false);
    const nextGradeCount = exercises.filter((exercise) => exercise.grade === nextGrade).length;
    setExerciseIndex((previousIndex) => randomExerciseIndex(nextGradeCount, previousIndex));
    clearAnswerState();
    setStatus("Fresh random example loaded. Press play when ready.");
  }

  function resetFor(nextGrade = grade) {
    goOn(nextGrade);
    setStatus(`${nextGrade} loaded with a fresh random example. Press play when ready.`);
  }

  function award(correct: boolean, sung = false) {
    setFeedback((value) => ({ id: value.id + 1, tone: correct ? "correct" : "incorrect" }));
    setHasCheckedAnswer(true);

    if (correct) {
      const base = attempts === 0 ? 30 : 18;
      const bonus = sung ? 12 : 0;
      const streakBonus = streak >= 2 ? 8 : 0;
      setPoints((value) => value + base + bonus + streakBonus);
      setStreak((value) => value + 1);
      setStatus(`Correct. +${base + bonus + streakBonus} points${bonus ? " including sung-answer bonus" : ""}. Hear it again or go on.`);
      return;
    }

    const penalty = attempts === 0 ? 6 : 3;
    setPoints((value) => Math.max(0, value - penalty));
    setStreak(0);
    setAttempts((value) => value + 1);
    setStatus(`Not yet. -${penalty} points, but the retry is worth most of it back.`);
  }

  function submitChoice(value = selected) {
    if (!value) {
      setStatus("Pick an answer first.");
      return;
    }
    award(value === exercise.correct, false);
  }

  function submitPlayed(note: string) {
    setSelected(note);
    award(note === exercise.correct, false);
  }

  function submitSung() {
    if (!exercise.targetMidi) {
      setStatus("This drill does not need a sung pitch check.");
      return;
    }
    if (micState === "listening") {
      setStatus("Finish recording before checking the answer.");
      return;
    }
    if (sungMidi === null) {
      setStatus("Record a sung answer first.");
      return;
    }

    const ok = Math.abs(sungMidi - exercise.targetMidi) <= 1;
    award(ok, ok && Boolean(exercise.sungBonus));
  }

  function tapRhythm() {
    taps.current = [...taps.current, performance.now()];
    setStatus(`${taps.current.length} taps captured.`);
  }

  function submitRhythm() {
    if (!exercise.rhythm || taps.current.length < 2) {
      setStatus("Tap at least two beats before submitting.");
      return;
    }
    const expected = exercise.rhythm.length;
    const countClose = Math.abs(taps.current.length - expected) <= 1;
    const gaps = taps.current.slice(1).map((tap, index) => tap - taps.current[index]);
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, gaps.length);
    const evenEnough = gaps.every((gap) => Math.abs(gap - average) < average * 0.55);
    award(countClose && evenEnough, false);
  }

  async function startMic() {
    if (!exercise.targetMidi) {
      setStatus("This drill does not need microphone pitch detection.");
      return;
    }

    setMicState("listening");
    setDetected("Listening...");
    setSungMidi(null);
    detectedMidiRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const RecordRTC = (await import("recordrtc")).default;
    recorderRef.current = new RecordRTC(stream, { type: "audio", mimeType: "audio/webm" });
    recorderRef.current.startRecording();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const detector = PitchDetector.forFloat32Array(analyser.fftSize);
    detector.minVolumeDecibels = -35;
    const input = new Float32Array(analyser.fftSize);

    const analyse = () => {
      analyser.getFloatTimeDomainData(input);
      const [pitch, clarity] = detector.findPitch(input, audioContext.sampleRate);
      if (pitch > 0 && clarity > 0.82) {
        const midi = frequencyToMidi(pitch);
        detectedMidiRef.current.push(midi);
        setDetected(`${midiToName(midi)} (${Math.round(pitch)} Hz)`);
      }
      rafRef.current = requestAnimationFrame(analyse);
    };
    analyse();

    window.setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      recorderRef.current?.stopRecording(() => undefined);
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close();
      setMicState("done");
      const votes = detectedMidiRef.current.reduce<Record<number, number>>((acc, midi) => {
        acc[midi] = (acc[midi] || 0) + 1;
        return acc;
      }, {});
      const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      const detectedMidi = best ? Number(best[0]) : null;
      setSungMidi(detectedMidi);
      setDetected(detectedMidi === null ? "No clear pitch" : midiToName(detectedMidi));
      setStatus(detectedMidi === null ? "No clear pitch detected. Try recording again." : "Pitch captured. Press Check answer.");
    }, 3200);
  }

  const optionList = exercise.options ?? [];
  const playNotes = exercise.targetMidi
    ? [midiToName(exercise.targetMidi), midiToName(exercise.targetMidi + 2), midiToName(exercise.targetMidi + 4), midiToName(exercise.targetMidi + 7)]
    : optionList;

  return (
    <main className="shell">
      {audioState !== "ready" ? (
        <div className="audioGate" role="dialog" aria-modal="true" aria-labelledby="audioGateTitle">
          <div className="audioGate__panel">
            <div className="eyebrow">
              <Volume2 size={16} /> Insert coin
            </div>
            <h2 id="audioGateTitle">Press start to power up the cabinet</h2>
            <p>Warms up the piano and rhythm samples so your very first round drops in perfectly on tempo.</p>
            <button className="primary audioGate__button" disabled={audioState === "loading"} onClick={() => void startAudio()}>
              <Play size={20} /> {audioState === "loading" ? "Loading..." : "Press start"}
            </button>
          </div>
        </div>
      ) : null}

      <section className="hero">
        <div className="hero__copy">
          <div className="eyebrow">
            <Sparkles size={16} /> Aural Arcade
          </div>
          <h1>Train your ears. Rack up combos. Level up every grade.</h1>
        </div>
        <div className="scoreboard" aria-label="Score">
          <div>
            <span>Level</span>
            <strong>{level}</strong>
          </div>
          <div>
            <span>Points</span>
            <strong>{points}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>{streak}</strong>
          </div>
          <div className="meter">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="layout">
        <div className={levelsOpen ? "levels levels--open" : "levels"}>
          <button
            className="levelsToggle"
            onClick={() => setLevelsOpen((open) => !open)}
            aria-expanded={levelsOpen}
            aria-controls="gradeRail"
          >
            <span className="levelsToggle__label">
              <Trophy size={15} /> Levels · {grade}
            </span>
            <ChevronDown size={18} className="levelsToggle__chevron" />
          </button>
          {levelsOpen ? (
            <aside className="gradeRail" id="gradeRail" aria-label="Grades">
              {grades.map((item) => (
                <button
                  className={item === grade ? "gradeButton gradeButton--active" : "gradeButton"}
                  key={item}
                  onClick={() => {
                    setGrade(item);
                    resetFor(item);
                  }}
                >
                  <span>{item}</span>
                  {item === grade ? <BadgeCheck size={18} /> : <Circle size={12} />}
                </button>
              ))}
            </aside>
          ) : null}
        </div>

        <section className="trainer">
          <div className="trainer__top">
            <div>
              <div className="tag">
                <Music2 size={16} /> {exercise.kind}
              </div>
              <h2>{exercise.title}</h2>
              <p>{exercise.prompt}</p>
            </div>
            <button
              className="iconButton"
              title="Play example"
              aria-label="Play example"
              disabled={isPlayingExample}
              onClick={() => void playCurrentExercise()}
            >
              <Play size={22} />
            </button>
          </div>

          <div className="requirement">
            <Volume2 size={18} />
            <span>{gradeSummaries[grade]}</span>
          </div>

          <label className="volumeControl">
            <span>
              <Volume2 size={17} /> Example volume
            </span>
            <input
              type="range"
              min="20"
              max="127"
              value={exampleVolume}
              onChange={(event) => setExampleVolume(Number(event.currentTarget.value))}
            />
            <strong>{Math.round((exampleVolume / 127) * 100)}%</strong>
          </label>

          <div className="toneControl" role="group" aria-label="Rhythm tone">
            <span>Rhythm tone</span>
            {rhythmToneOptions.map((option) => (
              <button
                key={option.value}
                className={rhythmTone === option.value ? "toneButton toneButton--active" : "toneButton"}
                onClick={() => setRhythmTone(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {exercise.revealCopy ? (
            <div className="memoryStrip">
              <span>{revealed ? exercise.revealCopy : "Phrase hidden"}</span>
              <button onClick={() => setRevealed((value) => !value)}>{revealed ? "Hide" : "Show"}</button>
            </div>
          ) : null}

          {exercise.answerMode === "choice" || exercise.answerMode === "played" ? (
            <div className="choices">
              {optionList.map((option) => {
                const definition = optionDefinitions[option];
                return (
                  <button
                    key={option}
                    className={selected === option ? "choice choice--selected" : "choice"}
                    onClick={() => {
                      setSelected(option);
                      if (exercise.answerMode === "played") submitPlayed(option);
                    }}
                  >
                    <span>{option}</span>
                    {definition ? (
                      <span className="optionInfo" aria-label={`${option} definition`}>
                        <Info size={16} />
                        <span className="optionTooltip">{definition}</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {exercise.answerMode === "sung" ? (
            <div className="responseBox">
              <div className="modeSwitch" role="group" aria-label="Answer mode">
                <button className={answerMode === "sung" ? "active" : ""} onClick={() => setAnswerMode("sung")}>
                  <Mic size={17} /> Sing
                </button>
                <button className={answerMode === "played" ? "active" : ""} onClick={() => setAnswerMode("played")}>
                  <Keyboard size={17} /> Play
                </button>
              </div>

              {answerMode === "sung" ? (
                <div className="micPanel">
                  <button className="primary" disabled={micState === "listening"} onClick={() => void startMic()}>
                    <Waves size={18} /> {micState === "listening" ? "Listening" : "Record answer"}
                  </button>
                  <span>{detected}</span>
                </div>
              ) : (
                <div className="notePad">
                  {playNotes.map((note) => (
                    <button key={note} onClick={() => submitPlayed(note)}>
                      {note}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {exercise.answerMode === "rhythm" ? (
            <div className="rhythmPad">
              <div className="answerHint">
                <span>Rhythm answer</span>
                <button className="tooltipIcon" aria-label="Rhythm definition">
                  <Info size={16} />
                  <span className="tooltipText">
                    Rhythm is the pattern of long and short sounds in time. Tap the note values, not just the steady beat.
                  </span>
                </button>
              </div>
              <button className="tapTarget" onClick={tapRhythm}>
                Tap
              </button>
              <div className="tapActions">
                <button className="primary" onClick={submitRhythm}>
                  Submit rhythm
                </button>
                <button
                  onClick={() => {
                    taps.current = [];
                    setStatus("Taps cleared.");
                  }}
                >
                  <RotateCcw size={16} /> Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="actions">
            <button className="playExample" disabled={isPlayingExample} onClick={() => void playCurrentExercise()}>
              <Play size={18} /> {isPlayingExample ? "Playing" : hasCheckedAnswer ? "Hear again" : "Play example"}
            </button>
            {(exercise.answerMode === "choice" || exercise.answerMode === "played") && (!hasCheckedAnswer || feedback.tone === "incorrect") && (
              <button className="primary" onClick={() => submitChoice()}>
                Check answer <ChevronRight size={18} />
              </button>
            )}
            {exercise.answerMode === "sung" && answerMode === "sung" && (!hasCheckedAnswer || feedback.tone === "incorrect") && (
              <button className="primary" onClick={submitSung}>
                Check answer <ChevronRight size={18} />
              </button>
            )}
            {hasCheckedAnswer ? (
              <button className="goOnButton" onClick={() => goOn()}>
                Go on <ChevronRight size={18} />
              </button>
            ) : null}
          </div>

          <div key={feedback.id} className={`status status--${feedback.tone}`} role="status">
            <Award size={18} />
            <span>{status}</span>
          </div>
        </section>

        <aside className="mission">
          <div className="mission__header">
            <Trophy size={20} />
            <h3>Mission Rules</h3>
          </div>
          <ul>
            <li>Correct first tries earn 30 points.</li>
            <li>Wrong answers lose a few points, then retries can recover most of the score.</li>
            <li>Sung pitch answers earn a 12 point bonus when the mic detects the target.</li>
            <li>Grades above Preliminary play examples twice, matching the exam requirement.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

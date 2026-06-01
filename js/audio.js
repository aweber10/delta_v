let context = null;
let muted = false;

export function isMuted() {
  return muted;
}

export async function initAudio() {
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
  }

  if (context.state === 'suspended') {
    await context.resume();
  }

  return true;
}

export function toggleMute() {
  muted = !muted;
  if (!muted) playStart();
  return muted;
}

export function playStart() {
  playSequence([
    { frequency: 196, start: 0, duration: 0.08, type: 'sine', gain: 0.08 },
    { frequency: 293.66, start: 0.09, duration: 0.1, type: 'sine', gain: 0.07 },
  ]);
}

export function playDock() {
  playSequence([
    { frequency: 220, start: 0, duration: 0.08, type: 'triangle', gain: 0.12 },
    { frequency: 330, start: 0.08, duration: 0.1, type: 'sine', gain: 0.1 },
    { frequency: 660, start: 0.18, duration: 0.16, type: 'sine', gain: 0.08 },
  ]);
}

export function playDeliveryComplete() {
  playSequence([
    { frequency: 392, start: 0, duration: 0.1, type: 'sine', gain: 0.11 },
    { frequency: 523.25, start: 0.1, duration: 0.1, type: 'sine', gain: 0.11 },
    { frequency: 659.25, start: 0.2, duration: 0.12, type: 'sine', gain: 0.1 },
    { frequency: 783.99, start: 0.32, duration: 0.22, type: 'triangle', gain: 0.09 },
  ]);
}

function playSequence(notes) {
  if (!context || muted) return;

  const now = context.currentTime;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + note.start;
    const end = start + note.duration;

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

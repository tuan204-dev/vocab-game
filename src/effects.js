import confetti from 'canvas-confetti';

// Audio context for sound effects
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Play a tone (correct or incorrect)
export function playSound(type) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'correct') {
      // Happy ascending notes
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } else {
      // Sad descending tone
      oscillator.frequency.setValueAtTime(300, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.log('Audio not available:', e);
  }
}

// Confetti celebration
export function showConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#FFD93D'];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: colors
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: colors
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Show correct feedback
export function showCorrectFeedback(callback) {
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  
  icon.textContent = '🎉';
  text.textContent = 'Correct!';
  text.style.color = '#4CAF50';
  
  overlay.classList.remove('hidden');
  playSound('correct');
  showConfetti();
  
  setTimeout(() => {
    overlay.classList.add('hidden');
    if (callback) callback();
  }, 1500);
}

// Show wrong feedback
export function showWrongFeedback(callback) {
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  
  icon.textContent = '😢';
  text.textContent = 'Oops! Try again!';
  text.style.color = '#FF6B6B';
  
  overlay.classList.remove('hidden');
  playSound('wrong');
  
  setTimeout(() => {
    overlay.classList.add('hidden');
    if (callback) callback();
  }, 1200);
}

// Star burst effect for final score
export function celebrateScore(score, total) {
  if (score >= total * 0.8) {
    // Great score - big celebration
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 80,
        origin: { x: 0, y: 0.8 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 80,
        origin: { x: 1, y: 0.8 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  } else if (score >= total * 0.5) {
    // Medium score - smaller celebration
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.6 }
    });
  }
}

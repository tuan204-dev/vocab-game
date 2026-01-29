import { 
  getQuestions, 
  saveQuestions, 
  addQuestion, 
  updateQuestion, 
  deleteQuestion, 
  resetToDefault,
  getGameQuestions,
  prepareQuestion,
  toggleQuestion
} from './questions.js';

import {
  initFaceTracking,
  setTiltCallback,
  clearTiltCallback,
  stopTracking,
  requestCameraPermission,
  isCameraAvailable
} from './camera.js';

import {
  showCorrectFeedback,
  showWrongFeedback,
  celebrateScore
} from './effects.js';

import { config } from './config.js';

// Game State
const state = {
  currentScreen: 'welcome',
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  isAnswering: false,
  editingQuestionIndex: null,
  isAuthenticated: false
};

// DOM Elements cache
const screens = {
  welcome: document.getElementById('welcome-screen'),
  permission: document.getElementById('permission-screen'),
  instructions: document.getElementById('instructions-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  manager: document.getElementById('manager-screen')
};

// Initialize the application
function init() {
  setupEventListeners();
  loadSavedSettings();
  showScreen('welcome');
}

// Load saved settings from localStorage
function loadSavedSettings() {
  const savedLimit = localStorage.getItem('question-limit');
  if (savedLimit) {
    document.getElementById('question-limit').value = savedLimit;
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Welcome screen
  document.getElementById('start-btn').addEventListener('click', handleStartGame);
  document.getElementById('manage-btn').addEventListener('click', handleManageClick);
  
  // Permission screen
  document.getElementById('allow-camera-btn').addEventListener('click', handleAllowCamera);
  document.getElementById('back-to-welcome').addEventListener('click', () => showScreen('welcome'));
  
  // Instructions screen
  document.getElementById('ready-btn').addEventListener('click', startGame);
  
  // Results screen
  document.getElementById('play-again-btn').addEventListener('click', handlePlayAgain);
  document.getElementById('home-btn').addEventListener('click', handleGoHome);
  
  // Game screen
  document.getElementById('end-game-btn').addEventListener('click', endGame);
  
  // Manager screen
  document.getElementById('manager-back-btn').addEventListener('click', handleManagerBack);
  document.getElementById('manager-start-btn').addEventListener('click', handleStartGame);
  document.getElementById('add-question-btn').addEventListener('click', handleAddQuestion);
  document.getElementById('reset-questions-btn').addEventListener('click', handleResetQuestions);
  document.getElementById('cancel-modal-btn').addEventListener('click', closeQuestionModal);
  document.getElementById('question-form').addEventListener('submit', handleSaveQuestion);
  document.getElementById('confirm-reset-btn').addEventListener('click', confirmReset);
  document.getElementById('cancel-reset-btn').addEventListener('click', cancelReset);
  
  // Authentication modal
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('cancel-auth-btn').addEventListener('click', closeAuthModal);
  
  // Global keyboard shortcuts
  document.addEventListener('keydown', handleKeyPress);
}

// Handle keyboard shortcuts
function handleKeyPress(e) {
  // Enter key on welcome screen
  if (state.currentScreen === 'welcome' && e.key === 'Enter') {
    e.preventDefault();
    handleStartGame();
  }
  // Enter key on instructions screen
  if (state.currentScreen === 'instructions' && e.key === 'Enter') {
    e.preventDefault();
    startGame();
  }
  // Enter key on results screen
  if (state.currentScreen === 'results' && e.key === 'Enter') {
    e.preventDefault();
    handlePlayAgain();
  }
}

// Screen management
function showScreen(screenName) {
  Object.keys(screens).forEach(name => {
    screens[name].classList.remove('active');
  });
  screens[screenName].classList.add('active');
  state.currentScreen = screenName;
  
  if (screenName === 'manager') {
    renderQuestionsList();
  }
}

// Handle start game button
async function handleStartGame() {
  if (!isCameraAvailable()) {
    alert('Camera is not available on this device. Please use a device with a camera.');
    return;
  }

  try {
    // Check permission status via Permissions API
    // Note: 'camera' permission name might vary by browser (e.g. 'video_capture')
    // but 'camera' is standard for Permissions API
    const permissionStatus = await navigator.permissions.query({ name: 'camera' });
    
    if (permissionStatus.state === 'granted') {
      // Already granted! Init camera and skip to instructions
      // We need to pass elements because we're skipping the normal flow
      const previewVideo = document.getElementById('preview-video');
      await initFaceTracking(previewVideo, null);
      showScreen('instructions');
      return;
    }
  } catch (e) {
    // Permissions API might not be implemented fully or correctly
    console.log('Permissions API check failed, falling back to manual flow:', e);
  }

  // If not granted or check failed, show the permission screen
  showScreen('permission');
}

// Handle camera permission
async function handleAllowCamera() {
  const btn = document.getElementById('allow-camera-btn');
  btn.textContent = 'Requesting...';
  btn.disabled = true;
  
  const hasPermission = await requestCameraPermission();
  
  if (hasPermission) {
    await initializeCamera();
    showScreen('instructions');
  } else {
    alert('Camera permission was denied. Please allow camera access to play the game.');
  }
  
  // Reset button state
  btn.textContent = 'Allow Camera Use';
  btn.disabled = false;
}

// Initialize camera for instructions/game
async function initializeCamera() {
  const previewVideo = document.getElementById('preview-video');
  
  try {
    // Let initFaceTracking handle the camera via MediaPipe Camera
    // Don't create a separate getUserMedia stream to avoid conflicts
    await initFaceTracking(previewVideo, null);
  } catch (error) {
    console.error('Failed to initialize camera:', error);
    alert('Failed to start camera. Please refresh and try again.');
  }
}

// Start the actual game
async function startGame() {
  const shouldShuffle = document.getElementById('shuffle-toggle').checked;
  const limitInput = document.getElementById('question-limit');
  const limit = limitInput.value ? parseInt(limitInput.value) : null;
  
  // Save the limit value to localStorage
  if (limitInput.value) {
    localStorage.setItem('question-limit', limitInput.value);
  } else {
    localStorage.removeItem('question-limit');
  }
  
  state.questions = getGameQuestions(shouldShuffle, limit).map(prepareQuestion);
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.isAnswering = false;
  
  updateScoreDisplay();
  showScreen('game');
  
  // Setup game video
  const gameVideo = document.getElementById('game-video');
  const faceCanvas = document.getElementById('face-canvas');
  
  try {
    // Set canvas dimensions
    faceCanvas.width = 640;
    faceCanvas.height = 480;
    
    console.log('Initializing face tracking for game...');
    
    // initFaceTracking will handle the camera internally via MediaPipe Camera
    await initFaceTracking(gameVideo, faceCanvas);
    
    // Small delay to ensure everything is ready
    await new Promise(r => setTimeout(r, 300));
    
    // Set up tilt callback
    console.log('Setting tilt callback...');
    setTiltCallback(handleTiltSelection);
    
    // Show first question
    showQuestion();
    console.log('Game started, waiting for head tilts...');
    
  } catch (error) {
    console.error('Failed to start game:', error);
    alert('Failed to start camera. Please refresh and try again.');
  }
}

// Show current question
function showQuestion() {
  if (state.currentQuestionIndex >= state.questions.length) {
    endGame();
    return;
  }
  
  const question = state.questions[state.currentQuestionIndex];
  
  document.getElementById('question-text').textContent = question.text;
  document.getElementById('answer-left').querySelector('.answer-text').textContent = question.leftAnswer;
  document.getElementById('answer-right').querySelector('.answer-text').textContent = question.rightAnswer;
  document.getElementById('current-question').textContent = state.currentQuestionIndex + 1;
  document.getElementById('total-questions').textContent = state.questions.length;
  
  // Reset answer card styles
  document.getElementById('answer-left').className = 'answer-card answer-left';
  document.getElementById('answer-right').className = 'answer-card answer-right';
  
  state.isAnswering = true;
}

// Handle head tilt selection
function handleTiltSelection(direction) {
  if (!state.isAnswering || state.currentScreen !== 'game') return;
  
  state.isAnswering = false;
  
  const question = state.questions[state.currentQuestionIndex];
  const selectedCard = direction === 'left' 
    ? document.getElementById('answer-left')
    : document.getElementById('answer-right');
  const correctCard = question.correctSide === 'left'
    ? document.getElementById('answer-left')
    : document.getElementById('answer-right');
  
  const isCorrect = direction === question.correctSide;
  
  // Highlight selected answer
  selectedCard.classList.add('highlight');
  
  setTimeout(() => {
    if (isCorrect) {
      state.score++;
      updateScoreDisplay();
      correctCard.classList.add('correct');
      showCorrectFeedback(() => {
        state.currentQuestionIndex++;
        showQuestion();
      });
    } else {
      selectedCard.classList.add('wrong');
      correctCard.classList.add('correct');
      showWrongFeedback(() => {
        state.currentQuestionIndex++;
        showQuestion();
      });
    }
  }, 300);
}

// Update score display
function updateScoreDisplay() {
  document.getElementById('score').textContent = state.score;
}

// End the game
// End the game
function endGame() {
  clearTiltCallback();
  stopTracking();
  
  // If manual end, currentQuestionIndex is the number of questions answered
  // If natural end, currentQuestionIndex equals questions.length
  const totalAnswered = state.currentQuestionIndex;
  
  // Avoid division by zero
  const percentage = totalAnswered > 0 ? (state.score / totalAnswered) * 100 : 0;
  
  let title, message;
  
  if (totalAnswered === 0) {
     title = 'Game Over';
     message = 'You didn\'t answer any questions!';
  } else if (percentage >= 90) {
    title = 'Amazing! 🌟';
    message = 'You are a vocabulary superstar!';
  } else if (percentage >= 70) {
    title = 'Great Job! 🎉';
    message = 'You did really well!';
  } else if (percentage >= 50) {
    title = 'Good Try! 👍';
    message = 'Keep practicing and you\'ll do even better!';
  } else {
    title = 'Keep Going! 💪';
    message = 'Practice makes perfect!';
  }
  
  document.getElementById('results-title').textContent = title;
  document.getElementById('final-score').textContent = state.score;
  document.querySelector('.score-max').textContent = `/ ${totalAnswered}`;
  document.getElementById('results-message').textContent = message;
  
  showScreen('results');
  if (state.score > 0) {
    celebrateScore(state.score, totalAnswered);
  }
}

// Handle play again
async function handlePlayAgain() {
  window.location.reload();
}

// Handle go home
function handleGoHome() {
  stopTracking();
  showScreen('welcome');
}

// ===== Question Manager Functions =====

// Render questions list
function renderQuestionsList() {
  const list = document.getElementById('questions-list');
  const questions = getQuestions();
  
  if (questions.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #888;">No questions yet. Add some!</p>';
    return;
  }
  
  list.innerHTML = questions.map((q, index) => `
    <div class="question-item ${q.disabled ? 'disabled' : ''}" data-index="${index}">
      <div class="question-index">${index + 1}</div>
      <div class="question-info">
        <h4>${q.question}</h4>
        <div class="question-answers">
          <span class="answer-tag correct">✓ ${q.correct}</span>
          <span class="answer-tag wrong">✗ ${q.wrong}</span>
        </div>
      </div>
      <div class="question-actions">
        <button class="btn-toggle ${q.disabled ? 'btn-enable' : 'btn-disable'}" onclick="toggleQuestionHandler(${index})" title="${q.disabled ? 'Enable' : 'Disable'}">
          ${q.disabled ? '✅' : '🚫'}
        </button>
        <button class="btn-edit" onclick="editQuestion(${index})">✏️</button>
        <button class="btn-delete" onclick="deleteQuestionHandler(${index})">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Handle add question
function handleAddQuestion() {
  state.editingQuestionIndex = null;
  document.getElementById('modal-title').textContent = 'Add Question';
  document.getElementById('question-form').reset();
  document.getElementById('question-modal').classList.remove('hidden');
}

// Edit question (exposed globally)
window.editQuestion = function(index) {
  const questions = getQuestions();
  const question = questions[index];
  
  state.editingQuestionIndex = index;
  document.getElementById('modal-title').textContent = 'Edit Question';
  document.getElementById('question-input').value = question.question;
  document.getElementById('correct-answer-input').value = question.correct;
  document.getElementById('wrong-answer-input').value = question.wrong;
  
  document.getElementById('question-modal').classList.remove('hidden');
};

// Delete question handler (exposed globally)
window.deleteQuestionHandler = function(index) {
  deleteQuestion(index);
  renderQuestionsList();
};

// Toggle question disabled state (exposed globally)
window.toggleQuestionHandler = function(index) {
  toggleQuestion(index);
  renderQuestionsList();
};

// Close question modal
function closeQuestionModal() {
  document.getElementById('question-modal').classList.add('hidden');
  state.editingQuestionIndex = null;
}

// Handle save question
function handleSaveQuestion(e) {
  e.preventDefault();
  
  const questionData = {
    question: document.getElementById('question-input').value.trim(),
    correct: document.getElementById('correct-answer-input').value.trim(),
    wrong: document.getElementById('wrong-answer-input').value.trim()
  };
  
  if (state.editingQuestionIndex !== null) {
    updateQuestion(state.editingQuestionIndex, questionData);
  } else {
    addQuestion(questionData);
  }
  
  closeQuestionModal();
  renderQuestionsList();
}

// Handle reset questions - show confirm modal
function handleResetQuestions() {
  document.getElementById('confirm-reset-modal').classList.remove('hidden');
}

// Confirm reset
function confirmReset() {
  resetToDefault();
  renderQuestionsList();
  document.getElementById('confirm-reset-modal').classList.add('hidden');
}

// Cancel reset
function cancelReset() {
  document.getElementById('confirm-reset-modal').classList.add('hidden');
}

// Authentication functions
function handleManageClick() {
  // Show authentication modal
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('password-input').value = '';
  document.getElementById('auth-error').classList.add('hidden');
  // Focus on password input
  setTimeout(() => {
    document.getElementById('password-input').focus();
  }, 100);
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const passwordInput = document.getElementById('password-input');
  const authError = document.getElementById('auth-error');
  
  if (passwordInput.value === config.managerPassword) {
    // Authentication successful
    state.isAuthenticated = true;
    closeAuthModal();
    showScreen('manager');
  } else {
    // Show error
    authError.classList.remove('hidden');
    passwordInput.value = '';
    passwordInput.focus();
  }
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('password-input').value = '';
  document.getElementById('auth-error').classList.add('hidden');
}

function handleManagerBack() {
  state.isAuthenticated = false;
  showScreen('welcome');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

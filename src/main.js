import { 
  getQuestions, 
  addQuestion, 
  updateQuestion, 
  deleteQuestion, 
  resetToDefault,
  getGameQuestions,
  prepareQuestion,
  toggleQuestion,
  getUnits,
  addUnit,
  updateUnit,
  deleteUnit
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
  editingQuestionId: null,
  editingUnitId: null,
  unitModalMode: 'add',
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
  refreshUnitSelectors();
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
  document.getElementById('add-unit-btn').addEventListener('click', () => openUnitModal('add'));
  document.getElementById('rename-unit-btn').addEventListener('click', () => openUnitModal('rename'));
  document.getElementById('delete-unit-btn').addEventListener('click', handleDeleteUnitClick);
  document.getElementById('unit-form').addEventListener('submit', handleSaveUnit);
  document.getElementById('cancel-unit-modal-btn').addEventListener('click', closeUnitModal);
  document.getElementById('confirm-delete-unit-btn').addEventListener('click', confirmDeleteUnit);
  document.getElementById('cancel-delete-unit-btn').addEventListener('click', cancelDeleteUnit);
  
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
}

// Screen management
function showScreen(screenName) {
  Object.keys(screens).forEach(name => {
    screens[name].classList.remove('active');
  });
  screens[screenName].classList.add('active');
  state.currentScreen = screenName;
  
  if (screenName === 'manager') {
    refreshUnitSelectors();
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
  const selectedUnitIds = getSelectedUnitIds();

  if (!selectedUnitIds || selectedUnitIds.length === 0) {
    alert('Please choose at least one unit to play.');
    return;
  }
  
  // Save the limit value to localStorage
  if (limitInput.value) {
    localStorage.setItem('question-limit', limitInput.value);
  } else {
    localStorage.removeItem('question-limit');
  }
  
  state.questions = getGameQuestions(shouldShuffle, limit, selectedUnitIds).map(prepareQuestion);
  if (state.questions.length === 0) {
    alert('These units have no active questions. Please choose another unit or add questions.');
    return;
  }
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

// ===== Question Manager Functions =====

// Render questions list
function renderQuestionsList() {
  const list = document.getElementById('questions-list');
  const activeUnitId = getActiveManagerUnitId();
  const questions = getQuestions(activeUnitId);
  
  if (questions.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #888;">No questions yet. Add some!</p>';
    return;
  }
  
  list.innerHTML = questions.map((q, index) => `
    <div class="question-item ${q.disabled ? 'disabled' : ''}" data-id="${q.id}">
      <div class="question-index">${index + 1}</div>
      <div class="question-info">
        <h4>${q.question}</h4>
        <div class="question-answers">
          <span class="answer-tag correct">✓ ${q.correct}</span>
          <span class="answer-tag wrong">✗ ${q.wrong}</span>
        </div>
      </div>
      <div class="question-actions">
        <button class="btn-toggle ${q.disabled ? 'btn-enable' : 'btn-disable'}" onclick="toggleQuestionHandler('${q.id}')" title="${q.disabled ? 'Enable' : 'Disable'}">
          ${q.disabled ? '✅' : '🚫'}
        </button>
        <button class="btn-edit" onclick="editQuestion('${q.id}')">✏️</button>
        <button class="btn-delete" onclick="deleteQuestionHandler('${q.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Handle add question
function handleAddQuestion() {
  state.editingQuestionId = null;
  document.getElementById('modal-title').textContent = 'Add Question';
  document.getElementById('question-form').reset();
  const unitSelect = document.getElementById('question-unit-select');
  const activeUnitId = getActiveManagerUnitId();
  if (unitSelect && activeUnitId) {
    unitSelect.value = activeUnitId;
  }
  document.getElementById('question-modal').classList.remove('hidden');
}

// Edit question (exposed globally)
window.editQuestion = function(index) {
  const questions = getQuestions();
  const question = questions.find(q => q.id === index);
  if (!question) return;
  
  state.editingQuestionId = question.id;
  document.getElementById('modal-title').textContent = 'Edit Question';
  document.getElementById('question-input').value = question.question;
  document.getElementById('correct-answer-input').value = question.correct;
  document.getElementById('wrong-answer-input').value = question.wrong;
  document.getElementById('question-unit-select').value = question.unitId;
  
  document.getElementById('question-modal').classList.remove('hidden');
};

// Delete question handler (exposed globally)
window.deleteQuestionHandler = function(questionId) {
  deleteQuestion(questionId);
  renderQuestionsList();
};

// Toggle question disabled state (exposed globally)
window.toggleQuestionHandler = function(questionId) {
  toggleQuestion(questionId);
  renderQuestionsList();
};

// Close question modal
function closeQuestionModal() {
  document.getElementById('question-modal').classList.add('hidden');
  state.editingQuestionId = null;
}

// Handle save question
function handleSaveQuestion(e) {
  e.preventDefault();
  
  const questionData = {
    question: document.getElementById('question-input').value.trim(),
    correct: document.getElementById('correct-answer-input').value.trim(),
    wrong: document.getElementById('wrong-answer-input').value.trim(),
    unitId: document.getElementById('question-unit-select').value
  };
  
  if (state.editingQuestionId !== null) {
    updateQuestion(state.editingQuestionId, questionData);
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
  refreshUnitSelectors();
  renderQuestionsList();
  document.getElementById('confirm-reset-modal').classList.add('hidden');
}

// Cancel reset
function cancelReset() {
  document.getElementById('confirm-reset-modal').classList.add('hidden');
}

// Authentication functions
function handleManageClick() {
  state.isAuthenticated = true;
  showScreen('manager');
}

function handleManagerBack() {
  state.isAuthenticated = false;
  showScreen('welcome');
}

// ===== Unit Management =====
function refreshUnitSelectors() {
  const units = getUnits();
  const checkboxesContainer = document.getElementById('unit-checkboxes');
  const questionUnitSelect = document.getElementById('question-unit-select');
  const savedUnitIds = JSON.parse(localStorage.getItem('selected-unit-ids') || '[]');
  const savedManagerUnitId = localStorage.getItem('active-unit-id');

  const fallbackUnitId = units[0] ? units[0].id : '';
  const selectedIds = savedUnitIds.filter(id => units.some(u => u.id === id));
  const managerUnitId = savedManagerUnitId && units.some(u => u.id === savedManagerUnitId)
    ? savedManagerUnitId
    : fallbackUnitId;

  const optionsHtml = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  if (questionUnitSelect) questionUnitSelect.innerHTML = optionsHtml;

  if (checkboxesContainer) {
    checkboxesContainer.innerHTML = units.map(u => {
      const checked = selectedIds.length > 0 ? selectedIds.includes(u.id) : u.id === fallbackUnitId;
      return `
        <label class="unit-checkbox">
          <input type="checkbox" value="${u.id}" ${checked ? 'checked' : ''}>
          <span>${u.name}</span>
        </label>
      `;
    }).join('');
    checkboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', handleWelcomeUnitChange);
    });
  }

  const persistedIds = selectedIds.length > 0 ? selectedIds : (fallbackUnitId ? [fallbackUnitId] : []);
  localStorage.setItem('selected-unit-ids', JSON.stringify(persistedIds));
  if (managerUnitId) {
    localStorage.setItem('active-unit-id', managerUnitId);
  }

  renderUnitTabs(units, managerUnitId);
  if (questionUnitSelect) questionUnitSelect.value = managerUnitId;
}

function handleWelcomeUnitChange(e) {
  const checkboxesContainer = document.getElementById('unit-checkboxes');
  if (!checkboxesContainer) return;
  const unitIds = Array.from(checkboxesContainer.querySelectorAll('input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  localStorage.setItem('selected-unit-ids', JSON.stringify(unitIds));
}

function getSelectedUnitIds() {
  const checkboxesContainer = document.getElementById('unit-checkboxes');
  if (!checkboxesContainer) return [];
  return Array.from(checkboxesContainer.querySelectorAll('input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function getActiveManagerUnitId() {
  const units = getUnits();
  const savedId = localStorage.getItem('active-unit-id');
  const validId = savedId && units.some(u => u.id === savedId) ? savedId : (units[0] ? units[0].id : null);
  if (validId) {
    localStorage.setItem('active-unit-id', validId);
  }
  return validId;
}

function openUnitModal(mode) {
  state.unitModalMode = mode;
  const title = mode === 'add' ? 'Add Unit' : 'Rename Unit';
  document.getElementById('unit-modal-title').textContent = title;
  const input = document.getElementById('unit-name-input');
  const units = getUnits();
  const activeUnitId = getActiveManagerUnitId();
  const activeUnit = units.find(u => u.id === activeUnitId);
  input.value = mode === 'rename' && activeUnit ? activeUnit.name : '';
  document.getElementById('unit-modal').classList.remove('hidden');
  input.focus();
}

function closeUnitModal() {
  document.getElementById('unit-modal').classList.add('hidden');
  document.getElementById('unit-name-input').value = '';
}

function handleSaveUnit(e) {
  e.preventDefault();
  const name = document.getElementById('unit-name-input').value.trim();
  if (!name) return;

  if (state.unitModalMode === 'add') {
    const unit = addUnit(name);
    refreshUnitSelectors();
    localStorage.setItem('active-unit-id', unit.id);
  } else {
    const activeUnitId = getActiveManagerUnitId();
    if (activeUnitId) {
      updateUnit(activeUnitId, name);
    }
    refreshUnitSelectors();
  }

  closeUnitModal();
  renderQuestionsList();
}

function handleDeleteUnitClick() {
  const units = getUnits();
  if (units.length <= 1) {
    alert('You must have at least one unit.');
    return;
  }
  const activeUnitId = getActiveManagerUnitId();
  const activeUnit = units.find(u => u.id === activeUnitId);
  document.getElementById('delete-unit-name').textContent = activeUnit ? activeUnit.name : '';
  document.getElementById('confirm-delete-unit-modal').classList.remove('hidden');
}

function confirmDeleteUnit() {
  const activeUnitId = getActiveManagerUnitId();
  if (activeUnitId) {
    deleteUnit(activeUnitId);
    refreshUnitSelectors();
    renderQuestionsList();
  }
  cancelDeleteUnit();
}

function cancelDeleteUnit() {
  document.getElementById('confirm-delete-unit-modal').classList.add('hidden');
}

function renderUnitTabs(units, activeUnitId) {
  const tabsContainer = document.getElementById('unit-tabs');
  if (!tabsContainer) return;

  if (units.length === 0) {
    tabsContainer.innerHTML = '';
    return;
  }

  tabsContainer.innerHTML = units.map(u => `
    <button class="unit-tab ${u.id === activeUnitId ? 'active' : ''}" data-unit-id="${u.id}">${u.name}</button>
  `).join('');

  tabsContainer.querySelectorAll('.unit-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const unitId = btn.getAttribute('data-unit-id');
      localStorage.setItem('active-unit-id', unitId);
      refreshUnitSelectors();
      renderQuestionsList();
    });
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

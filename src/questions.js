// Import default questions from JSON
import defaultQuestions from './questions.json';

const STORAGE_KEY = 'vocabulary-game-questions';

// Get all questions (custom + if no custom, use default)
export function getQuestions() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return [...defaultQuestions];
}

// Save questions to localStorage
export function saveQuestions(questions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}

// Add a new question
export function addQuestion(question) {
  const questions = getQuestions();
  questions.push({
    ...question,
    id: Date.now()
  });
  saveQuestions(questions);
  return questions;
}

// Update an existing question
export function updateQuestion(index, updatedQuestion) {
  const questions = getQuestions();
  if (index >= 0 && index < questions.length) {
    questions[index] = { ...questions[index], ...updatedQuestion };
    saveQuestions(questions);
  }
  return questions;
}

// Delete a question
export function deleteQuestion(index) {
  const questions = getQuestions();
  if (index >= 0 && index < questions.length) {
    questions.splice(index, 1);
    saveQuestions(questions);
  }
  return questions;
}

// Reset to default questions
export function resetToDefault() {
  localStorage.removeItem(STORAGE_KEY);
  return [...defaultQuestions];
}

// Get questions for a game session
export function getGameQuestions(shuffle = true) {
  const questions = getQuestions().filter(q => !q.disabled);
  if (shuffle) {
    return [...questions].sort(() => Math.random() - 0.5);
  }
  return [...questions];
}

// Toggle question disabled state
export function toggleQuestion(index) {
  const questions = getQuestions();
  if (index >= 0 && index < questions.length) {
    questions[index].disabled = !questions[index].disabled;
    saveQuestions(questions);
  }
  return questions;
}

// Prepare question with randomized answer positions
export function prepareQuestion(question) {
  const isCorrectOnLeft = Math.random() < 0.5;
  return {
    text: question.question,
    leftAnswer: isCorrectOnLeft ? question.correct : question.wrong,
    rightAnswer: isCorrectOnLeft ? question.wrong : question.correct,
    correctSide: isCorrectOnLeft ? 'left' : 'right'
  };
}

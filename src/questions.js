// Import default questions from JSON
import defaultQuestions from './questions.json';

const STORAGE_KEY = 'vocabulary-game-data';
const LEGACY_STORAGE_KEY = 'vocabulary-game-questions';
const DEFAULT_UNIT_NAME = 'Supper Kid';

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildDefaultData() {
  if (Array.isArray(defaultQuestions)) {
    const isUnitArray = defaultQuestions.every(
      item => item && typeof item.unit === 'string' && Array.isArray(item.question || item.questions)
    );

    if (isUnitArray) {
      const units = defaultQuestions
        .map(item => ({ id: generateId('unit'), name: item.unit.trim() }))
        .filter(u => u.name);

      if (units.length === 0) {
        units.push({ id: generateId('unit'), name: DEFAULT_UNIT_NAME });
      }

      const unitIdByName = new Map(units.map(u => [u.name, u.id]));
      const fallbackUnitId = units[0].id;

      return {
        units,
        questions: defaultQuestions.flatMap(item =>
          (item.question || item.questions).map(q => ({
            id: generateId('q'),
            unitId: unitIdByName.get(item.unit) || fallbackUnitId,
            disabled: !!q.disabled,
            question: q.question,
            correct: q.correct,
            wrong: q.wrong
          }))
        ).filter(q => q.question && q.correct && q.wrong)
      };
    }

    const unitId = generateId('unit');
    return {
      units: [{ id: unitId, name: DEFAULT_UNIT_NAME }],
      questions: defaultQuestions.map((q) => ({
        id: generateId('q'),
        unitId,
        disabled: false,
        ...q
      }))
    };
  }

  if (defaultQuestions && Array.isArray(defaultQuestions.units) && Array.isArray(defaultQuestions.questions)) {
    const units = defaultQuestions.units
      .map(u => ({ id: generateId('unit'), name: (u.name || DEFAULT_UNIT_NAME).trim() }))
      .filter(u => u.name);

    if (units.length === 0) {
      units.push({ id: generateId('unit'), name: DEFAULT_UNIT_NAME });
    }

    const unitIdByName = new Map(units.map(u => [u.name, u.id]));
    const fallbackUnitId = units[0].id;

    return {
      units,
      questions: defaultQuestions.questions
        .map(q => ({
          id: generateId('q'),
          unitId: unitIdByName.get(q.unit) || fallbackUnitId,
          disabled: !!q.disabled,
          question: q.question,
          correct: q.correct,
          wrong: q.wrong
        }))
        .filter(q => q.question && q.correct && q.wrong)
    };
  }

  const fallbackUnitId = generateId('unit');
  return {
    units: [{ id: fallbackUnitId, name: DEFAULT_UNIT_NAME }],
    questions: []
  };
}

function countDefaultQuestions() {
  if (Array.isArray(defaultQuestions)) {
    const isUnitArray = defaultQuestions.every(
      item => item && typeof item.unit === 'string' && Array.isArray(item.question || item.questions)
    );
    if (isUnitArray) {
      return defaultQuestions.reduce((sum, item) => sum + (item.question || item.questions).length, 0);
    }
    return defaultQuestions.length;
  }

  if (defaultQuestions && Array.isArray(defaultQuestions.questions)) {
    return defaultQuestions.questions.length;
  }

  return 0;
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.units) || !Array.isArray(data.questions)) {
    return buildDefaultData();
  }
  if (data.units.length === 0) {
    const fallback = buildDefaultData();
    return {
      units: fallback.units,
      questions: data.questions.map(q => ({
        ...q,
        unitId: fallback.units[0].id
      }))
    };
  }

  const unitIds = new Set(data.units.map(u => u.id));
  if (unitIds.size > 0) {
    const fallbackUnitId = data.units[0].id;
    data.questions = data.questions.map(q => ({
      ...q,
      unitId: unitIds.has(q.unitId) ? q.unitId : fallbackUnitId
    }));
  }

  return data;
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const normalized = normalizeData(JSON.parse(stored));
    const defaultCount = countDefaultQuestions();
    if (normalized.questions.length === 0 && defaultCount > 0) {
      const rebuilt = buildDefaultData();
      saveData(rebuilt);
      return rebuilt;
    }
    return normalized;
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    const unitId = generateId('unit');
    const legacyQuestions = JSON.parse(legacy);
    const migrated = {
      units: [{ id: unitId, name: DEFAULT_UNIT_NAME }],
      questions: legacyQuestions.map(q => ({
        id: generateId('q'),
        unitId,
        disabled: !!q.disabled,
        question: q.question,
        correct: q.correct,
        wrong: q.wrong
      }))
    };
    saveData(migrated);
    return migrated;
  }

  const defaults = buildDefaultData();
  saveData(defaults);
  return defaults;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== Units =====
export function getUnits() {
  return loadData().units;
}

export function addUnit(name) {
  const data = loadData();
  const unit = { id: generateId('unit'), name: name.trim() };
  data.units.push(unit);
  saveData(data);
  return unit;
}

export function updateUnit(unitId, name) {
  const data = loadData();
  const unit = data.units.find(u => u.id === unitId);
  if (unit) {
    unit.name = name.trim();
    saveData(data);
  }
  return unit;
}

export function deleteUnit(unitId) {
  const data = loadData();
  data.units = data.units.filter(u => u.id !== unitId);
  data.questions = data.questions.filter(q => q.unitId !== unitId);
  saveData(data);
  return data;
}

// ===== Questions =====
export function getQuestions(unitId = null) {
  const data = loadData();
  if (!unitId) return data.questions;
  if (Array.isArray(unitId)) {
    const unitSet = new Set(unitId);
    return data.questions.filter(q => unitSet.has(q.unitId));
  }
  return data.questions.filter(q => q.unitId === unitId);
}

export function addQuestion(question) {
  const data = loadData();
  data.questions.push({
    ...question,
    id: generateId('q'),
    disabled: false
  });
  saveData(data);
  return data.questions;
}

export function updateQuestion(questionId, updatedQuestion) {
  const data = loadData();
  const question = data.questions.find(q => q.id === questionId);
  if (question) {
    Object.assign(question, updatedQuestion);
    saveData(data);
  }
  return data.questions;
}

export function deleteQuestion(questionId) {
  const data = loadData();
  data.questions = data.questions.filter(q => q.id !== questionId);
  saveData(data);
  return data.questions;
}

export function toggleQuestion(questionId) {
  const data = loadData();
  const question = data.questions.find(q => q.id === questionId);
  if (question) {
    question.disabled = !question.disabled;
    saveData(data);
  }
  return data.questions;
}

// Reset to default questions
export function resetToDefault() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return buildDefaultData();
}

// Get questions for a game session
export function getGameQuestions(shuffle = true, limit = null, unitIds = null) {
  let questions = getQuestions(unitIds).filter(q => !q.disabled);
  if (shuffle) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }
  if (limit && limit > 0) {
    questions = questions.slice(0, limit);
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

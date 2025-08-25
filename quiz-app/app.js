(function() {
  'use strict';

  // ----------------------
  // Utilities
  // ----------------------
  const byId = (id) => document.getElementById(id);
  const trim = (s) => (s || '').trim();

  function isQuestionStart(line) {
    return /^\d+\./.test(line);
  }

  function isOptionMarker(line) {
    // Matches: "A.", "A ", or a lone "A" line
    const m = trim(line).match(/^([A-E])(?:\.|\)|\:)?(\s.*)?$/);
    if (!m) return null;
    const letter = m[1];
    const rest = (m[2] || '').trim();
    return { letter, rest };
  }

  function normalizeWhitespace(lines) {
    return lines.map(l => l.replace(/\s+$/,'')).join('\n');
  }

  // ----------------------
  // Parser
  // ----------------------
  function parseQuestions(rawText) {
    const lines = rawText.split(/\r?\n/);
    const blocks = [];
    let i = 0;

    // Group into question blocks delimited by next question start or EOF
    while (i < lines.length) {
      // Find next question start
      while (i < lines.length && !isQuestionStart(lines[i])) i++;
      if (i >= lines.length) break;
      const start = i;
      i++;
      while (i < lines.length && !isQuestionStart(lines[i])) i++;
      const end = i; // [start, end)
      const blockLines = lines.slice(start, end);
      const block = parseQuestionBlock(blockLines);
      if (block) blocks.push(block);
    }

    return blocks;
  }

  function parseQuestionBlock(blockLines) {
    // Extract question number and first line
    const first = blockLines[0];
    const qnumMatch = first.match(/^(\d+)\.\s*(.*)$/);
    if (!qnumMatch) return null;
    const number = parseInt(qnumMatch[1], 10);
    let promptParts = [qnumMatch[2] || ''];

    // Heuristic: Split block into options and explanations
    let splitIdx = blockLines.findIndex(l => /\bCorrect\.|\bIncorrect\./.test(l));
    if (splitIdx === -1) splitIdx = blockLines.length;

    const headerAndOptions = blockLines.slice(0, splitIdx);
    const explanationsLines = blockLines.slice(splitIdx);

    // From headerAndOptions, collect prompt and options
    const options = [];
    let j = 1; // we already consumed first line
    while (j < headerAndOptions.length) {
      const marker = isOptionMarker(headerAndOptions[j]);
      if (marker && marker.letter) break;
      promptParts.push(headerAndOptions[j]);
      j++;
    }

    const seenLetters = new Set();
    while (j < headerAndOptions.length) {
      const line = headerAndOptions[j];
      const marker = isOptionMarker(line);
      if (!marker) { j++; continue; }
      const letter = marker.letter;
      if (seenLetters.has(letter)) { j++; continue; }
      seenLetters.add(letter);

      let textParts = [];
      if (marker.rest) textParts.push(marker.rest);
      j++;
      while (j < headerAndOptions.length) {
        const peek = headerAndOptions[j];
        if (isOptionMarker(peek)) break;
        if (trim(peek) === '') {
          let k = j + 1; let found = false;
          for (; k < Math.min(headerAndOptions.length, j + 3); k++) {
            if (isOptionMarker(headerAndOptions[k])) { found = true; break; }
          }
          if (found) break;
        }
        textParts.push(peek);
        j++;
      }
      const text = trim(textParts.join(' ')).replace(/\s{2,}/g,' ');
      options.push({ letter, text, correct: false, explanation: '' });
    }

    let prompt = trim(promptParts.join(' ').replace(/\s{2,}/g,' '));

    const exp = parseExplanations(explanationsLines);
    for (const opt of options) {
      const e = exp[opt.letter];
      if (e) {
        opt.correct = !!e.correct;
        opt.explanation = e.text;
      }
    }

    const multi = /\(\s*Select\s+\w+\s*\)/i.test(prompt) || (options.filter(o => o.correct).length > 1);

    return { number, prompt, options, multi };
  }

  function parseExplanations(lines) {
    const map = {};
    let i = 0;
    let currentLetter = null;
    let buffer = [];

    function flush() {
      if (!currentLetter) return;
      const combined = buffer.join(' ').replace(/\s{2,}/g,' ').trim();
      if (!combined) { map[currentLetter] = { correct: false, text: '' }; }
      else {
        const correct = /\bCorrect\./i.test(combined);
        const cleaned = combined.replace(/Learn more about[\s\S]*$/i, '').trim();
        map[currentLetter] = { correct, text: cleaned };
      }
      buffer = [];
    }

    while (i < lines.length) {
      const line = lines[i];
      const marker = isOptionMarker(line);
      if (marker && marker.letter) {
        if (currentLetter) flush();
        currentLetter = marker.letter;
        if (marker.rest) buffer.push(marker.rest);
        i++;
        continue;
      }
      if (currentLetter) buffer.push(line);
      i++;
    }
    flush();

    return map;
  }

  // ----------------------
  // State & Persistence
  // ----------------------
  const STORAGE_KEY = 'quiz_state_v1';
  const STORAGE_SOURCE = 'quiz_source_v1';
  let questions = [];
  let currentIndex = 0;
  let score = 0;
  const answers = new Map();
  const graded = new Set();
  let currentSource = 'official';

  function saveState() {
    try {
      const state = {
        currentIndex,
        score,
        answers: Array.from(answers.entries()).map(([k,v]) => [k, Array.from(v)]) ,
        graded: Array.from(graded),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(STORAGE_SOURCE, currentSource);
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const src = localStorage.getItem(STORAGE_SOURCE);
      if (src) currentSource = src;
      const sel = byId('source-select');
      if (sel) sel.value = currentSource;
      if (!raw) return;
      const state = JSON.parse(raw);
      currentIndex = state.currentIndex || 0;
      score = state.score || 0;
      answers.clear();
      (state.answers || []).forEach(([k, arr]) => answers.set(Number(k), new Set(arr)));
      graded.clear();
      (state.graded || []).forEach(n => graded.add(Number(n)));
    } catch (_) {}
  }

  function resetState() {
    currentIndex = 0;
    score = 0;
    answers.clear();
    graded.clear();
    saveState();
  }

  // ----------------------
  // Rendering
  // ----------------------
  function render() {
    const total = questions.length;
    byId('progress').textContent = `Question ${Math.min(currentIndex + 1, total)} / ${total}`;
    byId('score').textContent = `Score: ${score}`;

    if (total === 0) {
      byId('quiz').classList.add('hidden');
      byId('results').classList.add('hidden');
      return;
    }

    const q = questions[currentIndex];
    byId('quiz').classList.remove('hidden');
    byId('results').classList.add('hidden');

    byId('question-meta').innerHTML = `#${q.number}${q.multi ? ' <span class="badge">Multi-select</span>' : ''}`;
    byId('question-text').textContent = q.prompt;

    const form = byId('options-form');
    form.innerHTML = '';
    const name = `q_${q.number}`;
    const selected = answers.get(q.number) || new Set();
    q.options.forEach(opt => {
      const id = `${name}_${opt.letter}`;
      const wrapper = document.createElement('label');
      wrapper.className = 'option';

      const input = document.createElement('input');
      input.type = q.multi ? 'checkbox' : 'radio';
      input.name = name;
      input.id = id;
      input.value = opt.letter;
      input.checked = selected.has(opt.letter);
      input.addEventListener('change', () => {
        const set = answers.get(q.number) || new Set();
        if (q.multi) {
          if (input.checked) set.add(opt.letter); else set.delete(opt.letter);
        } else {
          set.clear(); set.add(opt.letter);
        }
        answers.set(q.number, set);
        saveState();
      });

      const textDiv = document.createElement('div');
      textDiv.innerHTML = `<strong>${opt.letter}.</strong> ${escapeHtml(opt.text)}`;

      wrapper.appendChild(input);
      wrapper.appendChild(textDiv);
      form.appendChild(wrapper);
    });

    if (graded.has(q.number)) {
      applyGradingVisuals(q);
      fillExplanations(q);
    } else {
      clearGradingVisuals();
    }

    byId('prev-btn').disabled = currentIndex === 0;
    byId('next-btn').disabled = currentIndex >= questions.length - 1;
  }

  function applyGradingVisuals(q) {
    const selected = answers.get(q.number) || new Set();
    const form = byId('options-form');
    const optionEls = Array.from(form.querySelectorAll('.option'));
    optionEls.forEach((el, idx) => {
      const opt = q.options[idx];
      el.classList.toggle('correct', opt.correct);
      if (selected.has(opt.letter) && !opt.correct) {
        el.classList.add('incorrect');
      }
    });
  }

  function clearGradingVisuals() {
    const form = byId('options-form');
    form.querySelectorAll('.option').forEach(el => {
      el.classList.remove('correct', 'incorrect');
    });
    byId('explanations-content').innerHTML = '';
    byId('explanations').open = false;
  }

  function fillExplanations(q) {
    const container = byId('explanations-content');
    container.innerHTML = '';
    q.options.forEach(opt => {
      const ex = document.createElement('div');
      ex.className = 'ex';
      const tag = opt.correct ? '<span class="correct-tag">Correct</span>' : '<span class="incorrect-tag">Incorrect</span>';
      ex.innerHTML = `<strong>${opt.letter}.</strong> ${tag}<br>${escapeHtml(opt.explanation || '')}`;
      container.appendChild(ex);
    });
    byId('explanations').open = true;
  }

  function gradeCurrent() {
    const q = questions[currentIndex];
    const selected = answers.get(q.number) || new Set();
    const correctSet = new Set(q.options.filter(o => o.correct).map(o => o.letter));
    if (selected.size === 0) return false;
    let correct = true;
    if (selected.size !== correctSet.size) correct = false;
    else {
      for (const s of selected) { if (!correctSet.has(s)) { correct = false; break; } }
    }
    if (!graded.has(q.number)) {
      if (correct) score += 1;
      graded.add(q.number);
      saveState();
    }
    applyGradingVisuals(q);
    fillExplanations(q);
    render();
    return true;
  }

  function showResults() {
    const total = questions.length;
    byId('quiz').classList.add('hidden');
    byId('results').classList.remove('hidden');
    byId('results-summary').innerHTML = `You scored ${score} out of ${total}.`;
  }

  // ----------------------
  // Loading
  // ----------------------
  async function loadFromWorkspace(source) {
    let path;
    switch (source) {
      case 'generated':
        path = '../practice-questions/generated-questions.txt';
        break;
      case 'generated-domain-1':
        path = '../practice-questions/generated-domain-1.txt';
        break;
      case 'generated-domain-2':
        path = '../practice-questions/generated-domain-2.txt';
        break;
      case 'generated-domain-3':
        path = '../practice-questions/generated-domain-3.txt';
        break;
      case 'generated-domain-4':
        path = '../practice-questions/generated-domain-4.txt';
        break;
      case 'generated-domain-5':
        path = '../practice-questions/generated-domain-5.txt';
        break;
      case 'official':
      default:
        path = '../practice-questions/practice-questions-official.txt';
    }
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load questions file');
    const text = await res.text();
    return text;
  }

  function hydrate(text) {
    questions = parseQuestions(text);
    questions = questions.filter(q => q.options && q.options.length >= 2);
    resetScoreIfNeeded();
    render();
  }

  function resetScoreIfNeeded() {
    let newScore = 0;
    for (const q of questions) {
      if (!graded.has(q.number)) continue;
      const selected = answers.get(q.number) || new Set();
      const correctSet = new Set(q.options.filter(o => o.correct).map(o => o.letter));
      let correct = selected.size === correctSet.size;
      if (correct) { for (const s of selected) if (!correctSet.has(s)) { correct = false; break; } }
      if (correct) newScore += 1;
    }
    score = newScore;
    saveState();
  }

  // ----------------------
  // Events
  // ----------------------
  function attachEvents() {
    byId('prev-btn').addEventListener('click', () => {
      if (currentIndex > 0) { currentIndex -= 1; saveState(); render(); }
    });
    byId('next-btn').addEventListener('click', () => {
      if (currentIndex < questions.length - 1) { currentIndex += 1; saveState(); render(); }
      else showResults();
    });
    byId('submit-btn').addEventListener('click', () => {
      const did = gradeCurrent();
      if (!did) {
        alert('Please select an answer before submitting.');
      }
    });
    byId('restart-btn').addEventListener('click', () => {
      resetState();
      render();
    });
    byId('load-btn').addEventListener('click', async () => {
      try {
        const text = await loadFromWorkspace(currentSource);
        hydrate(text);
      } catch (e) {
        alert('Failed to reload: ' + e.message);
      }
    });
    byId('file-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { hydrate(String(reader.result || '')); }
        catch (err) { alert('Failed to parse uploaded file'); }
      };
      reader.readAsText(file);
    });
    const sourceSelect = byId('source-select');
    if (sourceSelect) {
      sourceSelect.addEventListener('change', async () => {
        currentSource = sourceSelect.value;
        saveState();
        try {
          const text = await loadFromWorkspace(currentSource);
          resetState();
          hydrate(text);
        } catch (e) {
          alert('Failed to load source: ' + e.message);
        }
      });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // ----------------------
  // Bootstrap
  // ----------------------
  document.addEventListener('DOMContentLoaded', async () => {
    attachEvents();
    loadState();
    try {
      const text = await loadFromWorkspace(currentSource);
      hydrate(text);
    } catch (e) {
      byId('quiz').classList.add('hidden');
    }
  });
})();

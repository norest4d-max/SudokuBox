const DIFFICULTIES = {
  easy: { label: "Easy", blanks: 36 },
  medium: { label: "Medium", blanks: 46 },
  veryHard: { label: "Very Hard", blanks: 56 }
};

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function basePattern(row, col) {
  return (row * 3 + Math.floor(row / 3) + col) % 9;
}

function makeSolution(seed) {
  const random = mulberry32(seed);
  const rowGroups = shuffled([0, 1, 2], random);
  const colGroups = shuffled([0, 1, 2], random);
  const rows = rowGroups.flatMap(group => shuffled([0, 1, 2], random).map(row => group * 3 + row));
  const cols = colGroups.flatMap(group => shuffled([0, 1, 2], random).map(col => group * 3 + col));
  const nums = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random);

  return rows.map(row => cols.map(col => nums[basePattern(row, col)]));
}

function countSolutions(grid, limit = 2) {
  const board = grid.map(row => [...row]);
  let solutions = 0;

  function valid(row, col, value) {
    for (let i = 0; i < 9; i += 1) {
      if (board[row][i] === value || board[i][col] === value) return false;
    }

    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r += 1) {
      for (let c = boxCol; c < boxCol + 3; c += 1) {
        if (board[r][c] === value) return false;
      }
    }

    return true;
  }

  function solve() {
    if (solutions >= limit) return;

    let best = null;
    let bestCandidates = null;

    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (board[r][c] !== 0) continue;

        const candidates = [];
        for (let value = 1; value <= 9; value += 1) {
          if (valid(r, c, value)) candidates.push(value);
        }

        if (candidates.length === 0) return;
        if (!best || candidates.length < bestCandidates.length) {
          best = [r, c];
          bestCandidates = candidates;
        }
      }
    }

    if (!best) {
      solutions += 1;
      return;
    }

    const [row, col] = best;
    for (const value of bestCandidates) {
      board[row][col] = value;
      solve();
      board[row][col] = 0;
    }
  }

  solve();
  return solutions;
}

function makePuzzle(solution, blanks, seed) {
  const random = mulberry32(seed);
  const puzzle = solution.map(row => [...row]);
  const cells = shuffled([...Array(81).keys()], random);

  let removed = 0;
  for (const cell of cells) {
    if (removed >= blanks) break;

    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const previous = puzzle[row][col];
    puzzle[row][col] = 0;

    if (countSolutions(puzzle, 2) === 1) {
      removed += 1;
    } else {
      puzzle[row][col] = previous;
    }
  }

  return puzzle;
}

function buildPuzzleBank() {
  const bank = {};
  let globalSeed = 7301;

  for (const [difficulty, config] of Object.entries(DIFFICULTIES)) {
    bank[difficulty] = [];
    const seen = new Set();

    while (bank[difficulty].length < 20) {
      const seed = globalSeed++;
      const solution = makeSolution(seed);
      const puzzle = makePuzzle(solution, config.blanks, seed * 97);
      const key = puzzle.flat().join("");

      if (seen.has(key)) continue;
      seen.add(key);

      bank[difficulty].push({
        id: `${difficulty}-${String(bank[difficulty].length + 1).padStart(2, "0")}`,
        puzzle,
        solution
      });
    }
  }

  return bank;
}

const PUZZLES = buildPuzzleBank();

const boardElement = document.getElementById("sudokuBoard");
const difficultySelect = document.getElementById("difficultySelect");
const puzzleSelect = document.getElementById("puzzleSelect");
const checkBtn = document.getElementById("checkBtn");
const hintBtn = document.getElementById("hintBtn");
const resetBtn = document.getElementById("resetBtn");
const message = document.getElementById("message");
const difficultyLabel = document.getElementById("difficultyLabel");
const puzzleCounter = document.getElementById("puzzleCounter");
const progressLabel = document.getElementById("progressLabel");

let currentDifficulty = "easy";
let currentIndex = 0;
let activePuzzle = PUZZLES[currentDifficulty][currentIndex];

function storageKey() {
  return `sudokubox:${activePuzzle.id}`;
}

function solvedKey() {
  return "sudokubox:solved";
}

function getSavedBoard() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 81 ? parsed : null;
  } catch {
    return null;
  }
}

function saveBoard() {
  const values = [...document.querySelectorAll(".cell")].map(cell => Number(cell.value) || 0);
  localStorage.setItem(storageKey(), JSON.stringify(values));
}

function getSolvedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(solvedKey())) || []);
  } catch {
    return new Set();
  }
}

function setSolved() {
  const solved = getSolvedSet();
  solved.add(activePuzzle.id);
  localStorage.setItem(solvedKey(), JSON.stringify([...solved]));
  updateProgress();
}

function updateProgress() {
  progressLabel.textContent = `${getSolvedSet().size} solved locally`;
}

function resizeBoard() {
  const max = Math.min(window.innerWidth * 0.94, 620);
  document.documentElement.style.setProperty("--board-size", `${Math.max(280, max)}px`);
}

function fillPuzzleSelect() {
  puzzleSelect.innerHTML = "";
  PUZZLES[currentDifficulty].forEach((puzzle, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Set ${index + 1}`;
    puzzleSelect.appendChild(option);
  });
  puzzleSelect.value = String(currentIndex);
}

function renderBoard() {
  activePuzzle = PUZZLES[currentDifficulty][currentIndex];
  boardElement.innerHTML = "";
  const saved = getSavedBoard();
  const savedFlat = saved || activePuzzle.puzzle.flat();

  activePuzzle.puzzle.flat().forEach((given, index) => {
    const cell = document.createElement("input");
    cell.className = "cell";
    cell.inputMode = "numeric";
    cell.maxLength = 1;
    cell.autocomplete = "off";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`);

    if (given) {
      cell.value = given;
      cell.disabled = true;
      cell.classList.add("given");
    } else {
      const savedValue = savedFlat[index];
      cell.value = savedValue || "";
      cell.classList.add("user");
      cell.addEventListener("input", event => {
        const clean = event.target.value.replace(/[^1-9]/g, "").slice(-1);
        event.target.value = clean;
        event.target.classList.remove("wrong");
        saveBoard();
      });

      cell.addEventListener("keydown", event => {
        if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
          event.currentTarget.value = "";
          event.currentTarget.classList.remove("wrong");
          saveBoard();
        }
      });
    }

    boardElement.appendChild(cell);
  });

  difficultyLabel.textContent = DIFFICULTIES[currentDifficulty].label;
  puzzleCounter.textContent = `Puzzle ${currentIndex + 1} / 20`;
  message.textContent = "Choose a cell and type 1–9. Use Backspace or 0 to clear.";
  updateProgress();
}

function currentCells() {
  return [...document.querySelectorAll(".cell")];
}

function checkBoard() {
  let complete = true;
  let correct = true;

  currentCells().forEach((cell, index) => {
    cell.classList.remove("wrong");
    const row = Math.floor(index / 9);
    const col = index % 9;
    const value = Number(cell.value);

    if (!value) complete = false;
    if (value && value !== activePuzzle.solution[row][col]) {
      correct = false;
      cell.classList.add("wrong");
    }
  });

  if (correct && complete) {
    message.textContent = "Solved. Clean work.";
    setSolved();
  } else if (correct) {
    message.textContent = "No mistakes showing. Keep going.";
  } else {
    message.textContent = "Some numbers are off. Marked cells need another look.";
  }
}

function giveHint() {
  const emptyCells = currentCells()
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => !cell.disabled && !cell.value);

  if (!emptyCells.length) {
    message.textContent = "No empty cells left. Hit Check.";
    return;
  }

  const hint = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const row = Math.floor(hint.index / 9);
  const col = hint.index % 9;
  hint.cell.value = activePuzzle.solution[row][col];
  hint.cell.classList.remove("wrong");
  saveBoard();
  message.textContent = "One hint dropped.";
}

function resetPuzzle() {
  localStorage.removeItem(storageKey());
  renderBoard();
}

difficultySelect.addEventListener("change", event => {
  currentDifficulty = event.target.value;
  currentIndex = 0;
  fillPuzzleSelect();
  renderBoard();
});

puzzleSelect.addEventListener("change", event => {
  currentIndex = Number(event.target.value);
  renderBoard();
});

checkBtn.addEventListener("click", checkBoard);
hintBtn.addEventListener("click", giveHint);
resetBtn.addEventListener("click", resetPuzzle);
window.addEventListener("resize", resizeBoard);

resizeBoard();
fillPuzzleSelect();
renderBoard();
document.addEventListener('DOMContentLoaded', () => {
    const quizContainer = document.getElementById('quiz-container');
    const submitBtn = document.getElementById('submit-btn');
    const resultsContainer = document.getElementById('results-container');

    function renderQuiz() {
        let currentSection = '';
        const quizHtml = window.quizData.map((q, index) => {
            let sectionHeader = '';
            if (q.section !== currentSection) {
                currentSection = q.section;
                sectionHeader = `<h3 class="mt-4">${q.section}</h3><hr>`;
            }

            const optionsHtml = q.options.map(opt => `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="question-${index}" id="q-${index}-opt-${opt.key}" value="${opt.key}">
                    <label class="form-check-label" for="q-${index}-opt-${opt.key}">
                        <strong>${opt.key})</strong> ${opt.text}
                    </label>
                </div>
            `).join('');

            return `
                ${sectionHeader}
                <div class="card my-3" id="q-card-${index}">
                    <div class="card-body">
                        <p class="card-title"><strong>Question ${q.question_number}:</strong> ${q.text}</p>
                        ${optionsHtml}
                    </div>
                </div>
            `;
        }).join('');

        quizContainer.innerHTML = quizHtml;
    }

    function handleSubmit() {
        const userAnswers = {};
        let allAnswered = true;
        window.quizData.forEach((q, index) => {
            const selectedOption = document.querySelector(`input[name="question-${index}"]:checked`);
            if (selectedOption) {
                userAnswers[index] = selectedOption.value;
            } else {
                allAnswered = false;
            }
        });

        if (!allAnswered) {
            alert('Please answer all questions before submitting.');
            return;
        }

        let score = 0;
        window.quizData.forEach((q, index) => {
            const questionCard = document.getElementById(`q-card-${index}`);
            questionCard.classList.remove('border-success', 'border-danger');

            const isCorrect = userAnswers[index] === q.answer;
            if (isCorrect) {
                score++;
                questionCard.classList.add('border-success');
            } else {
                questionCard.classList.add('border-danger');
            }

            // Highlight the correct answer
            const correctOptInput = document.getElementById(`q-${index}-opt-${q.answer}`);
            if (correctOptInput) {
                correctOptInput.parentElement.classList.add('correct-answer-highlight');
            }
        });

        const percentage = Math.round((score / window.quizData.length) * 100);
        
        resultsContainer.innerHTML = `
            <div class="alert alert-info">
                <h3>Quiz Results</h3>
                <p>You scored ${score} out of ${window.quizData.length} (${percentage}%)</p>
            </div>
        `;
        resultsContainer.style.display = 'block';
        submitBtn.style.display = 'none';
        window.scrollTo(0, document.body.scrollHeight);
    }

    renderQuiz();
    submitBtn.addEventListener('click', handleSubmit);
}); 
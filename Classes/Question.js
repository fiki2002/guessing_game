/**
 * Question class to handle game questions and answers
 */
class Question {
        constructor(question = '', answer = '') {
                this.question = question;
                this.answer = answer.toLowerCase().trim();
                this.isRevealed = false;
                this.createdAt = new Date();
        }

        /**
         * Set question and answer
         * @param {string} question - The question text
         * @param {string} answer - The correct answer
         */
        setQuestion(question, answer) {
                this.question = question;
                this.answer = answer.toLowerCase().trim();
                this.isRevealed = false;
                this.createdAt = new Date();
        }

        /**
         * Check if a guess matches the answer
         * @param {string} guess - The player's guess
         * @returns {boolean} - True if guess is correct
         */
        checkAnswer(guess) {
                if (!guess || !this.answer) return false;
                return guess.toLowerCase().trim() === this.answer;
        }

        /**
         * Reveal the answer
         */
        reveal() {
                this.isRevealed = true;
        }

        /**
         * Check if answer is revealed
         * @returns {boolean} - True if answer is revealed
         */
        isAnswerRevealed() {
                return this.isRevealed;
        }

        /**
         * Get question data for clients
         * @param {boolean} includeAnswer - Whether to include the answer
         * @returns {Object} - Question data
         */
        getPublicData(includeAnswer = false) {
                return {
                        question: this.question,
                        answer: includeAnswer ? this.answer : undefined,
                        isRevealed: this.isRevealed,
                        createdAt: this.createdAt
                };
        }

        /**
         * Check if question is set
         * @returns {boolean} - True if question and answer are set
         */
        isSet() {
                return this.question.trim() !== '' && this.answer.trim() !== '';
        }

        /**
         * Reset question
         */
        reset() {
                this.question = '';
                this.answer = '';
                this.isRevealed = false;
                this.createdAt = new Date();
        }
}

module.exports = Question;

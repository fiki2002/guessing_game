const Player = require('./Player');
const Timer = require('./Timer');
const Question = require('./Question');

/**
 * GameSession class to manage the game state and logic
 */
class GameSession {
        constructor(id = 'default') {
                this.id = id;
                this.status = 'waiting';
                this.players = new Map();
                this.question = new Question();
                this.timer = new Timer(60000);
                this.winner = null;
                this.createdAt = new Date();
                this.currentMasterIndex = 0;
                this.masterTimeoutId = null;
                this.timeoutTriggered = false;
        }

        /**
         * Add a player to the session
         * @param {string} socketId - Socket ID
         * @param {string} name - Player name
         * @returns {Player} - The created player
         */
        addPlayer(socketId, name) {
                // Check if name already exists
                for (let player of this.players.values()) {
                        if (player.name.toLowerCase() === name.toLowerCase()) {
                                throw new Error('Name already taken');
                        }
                }

                const playerId = this.generatePlayerId();
                const player = new Player(playerId, name, socketId);

                // First player becomes master
                if (this.players.size === 0) {
                        player.setAsMaster();
                }

                this.players.set(socketId, player);
                return player;
        }

        /**
         * Remove a player from the session
         * @param {string} socketId - Socket ID
         * @returns {Player|null} - The removed player or null
         */
        removePlayer(socketId) {
                const player = this.players.get(socketId);
                if (player) {
                        this.players.delete(socketId);

                        // If master left, promote next player
                        if (player.isMaster && this.players.size > 0) {
                                this.promoteNextMaster();
                        }
                }
                return player;
        }

        /**
         * Get player by socket ID
         * @param {string} socketId - Socket ID
         * @returns {Player|null} - The player or null
         */
        getPlayer(socketId) {
                return this.players.get(socketId);
        }

        /**
         * Get all players as array
         * @returns {Array} - Array of players
         */
        getPlayers() {
                return Array.from(this.players.values());
        }

        /**
         * Get public player data for clients
         * @returns {Array} - Array of player public data
         */
        getPlayersPublicData() {
                return this.getPlayers().map(player => player.getPublicData());
        }

        /**
         * Set question and answer (master only)
         * @param {string} question - The question
         * @param {string} answer - The answer
         * @param {string} socketId - Master's socket ID
         * @returns {boolean} - True if successful
         */
        setQuestion(question, answer, socketId) {
                const player = this.getPlayer(socketId);
                if (!player || !player.isMaster) {
                        return false;
                }

                this.question.setQuestion(question, answer);
                return true;
        }

        /**
         * Start the game (master only)
         * @param {string} socketId - Master's socket ID
         * @returns {boolean} - True if successful
         */
        startGame(socketId) {
                const player = this.getPlayer(socketId);
                if (!player || !player.isMaster) {
                        return false;
                }

                if (this.status !== 'waiting' || !this.question.isSet() || this.players.size < 3) {
                        return false;
                }

                // Clear master timeout if it exists
                if (this.masterTimeoutId) {
                        clearTimeout(this.masterTimeoutId);
                        this.masterTimeoutId = null;
                }

                this.status = 'in-progress';
                this.winner = null;

                // Reset all players for new round
                this.getPlayers().forEach(p => p.resetForNewRound());

                // Start timer
                this.timer.start(
                        (timeLeft) => {
                                // Timer tick callback - will be handled by server
                        },
                        () => {
                                // Timer complete callback - will be handled by server
                                console.log('Timer callback triggered - ending game due to timeout');
                                // Don't call endGame here - let the server handle it to avoid race conditions
                        }
                );

                return true;
        }

        /**
         * Process a player's guess
         * @param {string} socketId - Player's socket ID
         * @param {string} guess - The guess
         * @returns {Object} - Result object
         */
        processGuess(socketId, guess) {
                const player = this.getPlayer(socketId);
                if (!player || this.status !== 'in-progress') {
                        return { success: false, message: 'Invalid guess attempt' };
                }

                if (!player.canGuess()) {
                        return { success: false, message: 'No more attempts left' };
                }

                player.makeAttempt();

                if (this.question.checkAnswer(guess)) {
                        // Correct guess!
                        this.endGame(player, 'correct');
                        return {
                                success: true,
                                correct: true,
                                message: 'Correct! You won!',
                                player: player.getPublicData()
                        };
                } else {
                        // Wrong guess
                        return {
                                success: true,
                                correct: false,
                                message: 'Wrong guess!',
                                attemptsLeft: player.maxAttempts - player.attempts
                        };
                }
        }

        /**
         * End the game
         * @param {Player} winner - The winning player (null for timeout)
         * @param {string} reason - Reason for ending ('correct' or 'timeout')
         */
        endGame(winner, reason) {
                console.log(`Game ending - reason: ${reason}, winner: ${winner ? winner.name : 'none'}`);
                this.status = 'ended';
                this.timer.stop();
                this.question.reveal();

                if (winner && reason === 'correct') {
                        this.winner = winner;
                        winner.awardPoints(10);
                }

                // Rotate master for next round
                this.rotateMaster();
        }

        /**
         * Reset session for new round
         */
        resetForNewRound() {
                this.status = 'waiting';
                this.question.reset();
                this.timer.reset();
                this.winner = null;
                this.timeoutTriggered = false;

                // Reset all players
                this.getPlayers().forEach(player => player.resetForNewRound());
        }

        /**
         * Rotate master to next player (randomly)
         */
        rotateMaster() {
                if (this.players.size <= 1) return;

                // Remove master status from current master
                this.getPlayers().forEach(player => player.removeMaster());

                // Randomly select next master
                const players = this.getPlayers();
                const randomIndex = Math.floor(Math.random() * players.length);
                const nextMaster = players[randomIndex];
                nextMaster.setAsMaster();

                this.currentMasterIndex = randomIndex;
        }

        /**
         * Promote next player to master (when master leaves)
         */
        promoteNextMaster() {
                if (this.players.size === 0) return;

                const players = this.getPlayers();
                const newMaster = players[0];
                newMaster.setAsMaster();
        }

        /**
         * Check if new players can join
         * @returns {boolean} - True if players can join
         */
        canJoin() {
                return this.status === 'waiting';
        }

        /**
         * Get session public data
         * @returns {Object} - Session data for clients
         */
        getPublicData() {
                return {
                        id: this.id,
                        status: this.status,
                        players: this.getPlayersPublicData(),
                        playerCount: this.players.size,
                        question: this.question.getPublicData(this.status === 'ended'),
                        timeLeft: this.timer.getTimeLeft(),
                        winner: this.winner ? this.winner.getPublicData() : null
                };
        }

        /**
         * Generate unique player ID
         * @returns {string} - Unique player ID
         */
        generatePlayerId() {
                return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        }

        /**
         * Check if session is empty
         * @returns {boolean} - True if no players
         */
        isEmpty() {
                return this.players.size === 0;
        }

        /**
         * Clear session data
         */
        clear() {
                this.players.clear();
                this.status = 'waiting';
                this.question.reset();
                this.timer.stop();
                this.winner = null;
                this.currentMasterIndex = 0;
        }
}

module.exports = GameSession;

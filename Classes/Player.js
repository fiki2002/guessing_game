/**
 * Player class to represent a game participant
 */
class Player {
        constructor(id, name, socketId) {
                this.id = id;
                this.name = name;
                this.socketId = socketId;
                this.isMaster = false;
                this.score = 0;
                this.attempts = 0;
                this.maxAttempts = 3;
                this.hasGuessed = false;
                this.joinTime = new Date();
        }

        /**
         * Award points to the player
         * @param {number} points - Points to award
         */
        awardPoints(points) {
                this.score += points;
        }

        /**
         * Increment attempt count
         */
        makeAttempt() {
                this.attempts++;
                if (this.attempts >= this.maxAttempts) {
                        this.hasGuessed = true;
                }
        }

        /**
         * Reset player for new round
         */
        resetForNewRound() {
                this.attempts = 0;
                this.hasGuessed = false;
        }

        /**
         * Check if player can make more attempts
         * @returns {boolean} - True if player can still guess
         */
        canGuess() {
                return this.attempts < this.maxAttempts && !this.hasGuessed;
        }

        /**
         * Set player as game master
         */
        setAsMaster() {
                this.isMaster = true;
        }

        /**
         * Remove master status
         */
        removeMaster() {
                this.isMaster = false;
        }

        /**
         * Get player data for client
         * @returns {Object} - Player data without socketId
         */
        getPublicData() {
                return {
                        id: this.id,
                        name: this.name,
                        isMaster: this.isMaster,
                        score: this.score,
                        attempts: this.attempts,
                        maxAttempts: this.maxAttempts,
                        hasGuessed: this.hasGuessed
                };
        }
}

module.exports = Player;

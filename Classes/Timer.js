/**
 * Timer class to handle game timing
 */
class Timer {
        constructor(duration = 60000) { // Default 60 seconds
                this.duration = duration;
                this.timeLeft = duration;
                this.timerId = null;
                this.isRunning = false;
                this.startTime = null;
                this.callbacks = {
                        onTick: null,
                        onComplete: null
                };
        }

        /**
         * Start the timer
         * @param {Function} onTick - Callback for each tick (receives timeLeft)
         * @param {Function} onComplete - Callback when timer completes
         */
        start(onTick = null, onComplete = null) {
                if (this.isRunning) {
                        this.stop();
                }

                this.callbacks.onTick = onTick;
                this.callbacks.onComplete = onComplete;
                this.isRunning = true;
                this.startTime = Date.now();
                this.timeLeft = this.duration;

                // Start the countdown
                this.timerId = setInterval(() => {
                        const elapsed = Date.now() - this.startTime;
                        this.timeLeft = Math.max(0, this.duration - elapsed);

                        if (this.callbacks.onTick) {
                                this.callbacks.onTick(this.timeLeft);
                        }

                        if (this.timeLeft <= 0) {
                                this.stop();
                                if (this.callbacks.onComplete) {
                                        this.callbacks.onComplete();
                                }
                        }
                }, 1000); // Update every second
        }

        /**
         * Stop the timer
         */
        stop() {
                if (this.timerId) {
                        clearInterval(this.timerId);
                        this.timerId = null;
                }
                this.isRunning = false;
        }

        /**
         * Reset timer to initial duration
         */
        reset() {
                this.stop();
                this.timeLeft = this.duration;
        }

        /**
         * Get formatted time string (MM:SS)
         * @returns {string} - Formatted time
         */
        getFormattedTime() {
                const minutes = Math.floor(this.timeLeft / 60000);
                const seconds = Math.floor((this.timeLeft % 60000) / 1000);
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        /**
         * Get time left in milliseconds
         * @returns {number} - Time left in ms
         */
        getTimeLeft() {
                return this.timeLeft;
        }

        /**
         * Check if timer is running
         * @returns {boolean} - True if timer is active
         */
        isActive() {
                return this.isRunning;
        }
}

module.exports = Timer;

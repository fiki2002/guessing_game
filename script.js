class GameClient {
        constructor() {
                this.socket = null;
                this.player = null;
                this.session = null;
                this.initializeElements();
                this.initializeEventListeners();
                this.connect();
        }

        initializeElements() {
                // Sections
                this.joinSection = document.getElementById('joinSection');
                this.gameHeader = document.getElementById('gameHeader');
                this.gameSection = document.getElementById('gameSection');

                // Join elements
                this.playerNameInput = document.getElementById('playerName');
                this.joinBtn = document.getElementById('joinBtn');
                this.joinError = document.getElementById('joinError');

                // Game elements
                this.timer = document.getElementById('timer');
                this.statusText = document.getElementById('statusText');
                this.statusInfo = document.getElementById('statusInfo');

                // Master controls
                this.masterControls = document.getElementById('masterControls');
                this.questionInput = document.getElementById('questionInput');
                this.answerInput = document.getElementById('answerInput');
                this.createQuestionBtn = document.getElementById('createQuestionBtn');
                this.startGameBtn = document.getElementById('startGameBtn');

                // Question area
                this.questionArea = document.getElementById('questionArea');
                this.questionText = document.getElementById('questionText');
                this.answerText = document.getElementById('answerText');

                // Chat elements
                this.chatMessages = document.getElementById('chatMessages');
                this.guessInput = document.getElementById('guessInput');
                this.sendGuessBtn = document.getElementById('sendGuessBtn');

                // Sidebar elements
                this.playerCount = document.getElementById('playerCount');
                this.playersList = document.getElementById('playersList');

                // Share link elements
                this.shareLink = document.getElementById('shareLink');
                this.copyLinkBtn = document.getElementById('copyLinkBtn');
        }

        initializeEventListeners() {
                // Join events
                this.joinBtn.addEventListener('click', () => this.joinGame());
                this.playerNameInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') this.joinGame();
                });

                // Master controls
                this.createQuestionBtn.addEventListener('click', () => this.createQuestion());

                // Chat events
                this.sendGuessBtn.addEventListener('click', () => this.sendGuess());
                this.guessInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') this.sendGuess();
                });

                // Share link events
                this.copyLinkBtn.addEventListener('click', () => this.copyShareLink());
                this.shareLink.addEventListener('click', () => this.shareLink.select());
        }

        connect() {
                this.socket = io();

                this.socket.on('joined', (data) => {
                        this.player = data.player;
                        this.session = data.session;
                        this.showGameSection();
                        this.updateUI();
                });

                this.socket.on('error', (data) => {
                        this.showError(data.message);
                });

                this.socket.on('playerJoined', (data) => {
                        this.session = data.session;
                        this.addMessage(`${data.player.name} joined the game`, 'system');
                        this.updateUI();
                });

                this.socket.on('playerLeft', (data) => {
                        this.session = data.session;
                        this.addMessage(`${data.player.name} left the game`, 'system');
                        this.updateUI();
                });

                this.socket.on('sessionUpdate', (data) => {
                        this.session = data;

                        // Update player data from session to ensure we have the latest master status
                        if (this.session && this.player) {
                                const updatedPlayer = this.session.players.find(p => p.id === this.player.id);
                                if (updatedPlayer) {
                                        this.player = updatedPlayer;
                                }
                        }

                        this.forceRefreshUI();

                        // Reset timer styling if game is starting
                        if (data.status === 'in-progress') {
                                this.timer.style.color = '';
                                this.timer.style.fontWeight = '';
                        }
                });

                this.socket.on('questionCreated', (data) => {
                        this.addMessage('Question created successfully!', 'system');
                        this.updateUI();
                });

                this.socket.on('gameStarted', (data) => {
                        this.session = data.session;
                        this.addMessage('Game started! Good luck!', 'system');
                        this.addMessage(`Question: ${data.question.question}`, 'system');

                        // Reset timer styling for new game
                        this.timer.style.color = '';
                        this.timer.style.fontWeight = '';

                        this.updateUI();
                });

                this.socket.on('newMasterNotification', (data) => {
                        this.addMessage(data.message, 'system');

                        // Update player data from session to ensure we have the latest master status
                        if (this.session && this.player) {
                                const updatedPlayer = this.session.players.find(p => p.id === this.player.id);
                                if (updatedPlayer) {
                                        this.player = updatedPlayer;
                                }
                        }

                        this.updateUI();
                        // Force update master controls for new master
                        this.updateMasterControls();

                        // If this player is the new master, show special notification and ensure controls are visible
                        if (this.player && this.player.isMaster) {
                                this.addMessage('🎮 You are now the game master! Create a question to start the next round.', 'system');
                                // Force show master controls
                                this.masterControls.classList.remove('hidden');
                                this.questionInput.value = '';
                                this.answerInput.value = '';
                                this.createQuestionBtn.disabled = false;
                        }
                });

                this.socket.on('winnerModal', (data) => {
                        this.showWinnerModal(data);
                });

                this.socket.on('timeoutNotification', (data) => {
                        this.showTimeoutNotification(data);
                });

                this.socket.on('timeoutModal', (data) => {
                        this.showTimeoutModal(data);
                        this.addMessage('⏰ Game timeout! Nobody got the correct answer.', 'system');
                        this.addMessage(`The answer was: ${data.answer}`, 'system');

                        this.updateUI();

                        if (this.player && this.player.isMaster) {
                                this.forceRefreshUI();
                        }
                });

                this.socket.on('guessResult', (data) => {
                        if (data.correct) {
                                this.addMessage('Correct! You won!', 'winner');
                        } else {
                                this.addMessage(`Wrong guess! ${data.attemptsLeft} attempts left.`, 'system');
                        }
                });

                this.socket.on('gameEnded', (data) => {
                        this.session = data.session;

                        this.updateUI();

                        if (data.reason === 'correct') {
                                this.addMessage(`${data.winner.name} won the game!`, 'winner');
                                this.timer.textContent = '00:00';
                        } else if (data.reason === 'timeout') {
                                this.addMessage('⏰ Game timed out! No winner this round.', 'system');
                                this.timer.textContent = '00:00';

                                this.forceRefreshUI();
                        } else {
                                this.addMessage('Time\'s up! No winner this round.', 'system');
                        }
                        this.addMessage(`The answer was: ${data.answer}`, 'system');
                });

                this.socket.on('timerUpdate', (data) => {
                        this.timer.textContent = data.formatted;

                        if (data.formatted === '00:00' && this.session && this.session.status === 'in-progress') {
                                this.timer.style.color = '#ff4444';
                                this.timer.style.fontWeight = 'bold';
                        }
                });
        }

        joinGame() {
                const name = this.playerNameInput.value.trim();
                if (!name) {
                        this.showError('Please enter your name');
                        return;
                }

                this.joinBtn.disabled = true;
                this.joinBtn.textContent = 'Joining...';

                this.socket.emit('join', { name });
        }

        createQuestion() {
                const question = this.questionInput.value.trim();
                const answer = this.answerInput.value.trim();

                if (!question || !answer) {
                        this.showError('Please enter both question and answer');
                        return;
                }

                this.socket.emit('createQuestion', { question, answer });
        }

        sendGuess() {
                const guess = this.guessInput.value.trim();
                if (!guess) return;

                this.socket.emit('guess', { guess });
                this.addMessage(`You guessed: ${guess}`, 'guess');
                this.guessInput.value = '';
        }

        showGameSection() {
                this.joinSection.classList.add('hidden');
                this.gameHeader.classList.remove('hidden');
                this.gameSection.classList.remove('hidden');
                this.updateShareLink();
        }

        updateUI() {
                if (!this.session) return;

                this.statusText.textContent = this.getStatusText();

                this.playerCount.textContent = this.session.playerCount;

                this.updatePlayersList();

                this.updateMasterControls();

                this.updateQuestionArea();

                this.updateChatInput();
        }

        forceRefreshUI() {
                this.updateUI();

                if (this.player && this.player.isMaster) {
                        this.masterControls.classList.remove('hidden');
                        this.questionInput.value = '';
                        this.answerInput.value = '';
                        this.createQuestionBtn.disabled = false;
                }
        }

        getStatusText() {

                switch (this.session.status) {
                        case 'waiting':
                                return 'Waiting for players to join...';
                        case 'in-progress':
                                return 'Game in progress!';
                        case 'ended':
                                if (this.session.winner) {
                                        return 'Game ended. Winner found!';
                                } else {
                                        return 'Game timeout - nobody got the correct answer';
                                }
                        default:
                                return 'Unknown status';
                }
        }

        updatePlayersList() {
                this.playersList.innerHTML = '';
                this.session.players.forEach(player => {
                        const playerDiv = document.createElement('div');
                        playerDiv.className = 'player-item';

                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'player-name';

                        let nameText = player.name;
                        if (this.player && player.id === this.player.id) {
                                nameText += ' <span class="you-tag">(You)</span>';
                        }

                        nameSpan.innerHTML = nameText;
                        if (player.isMaster) {
                                nameSpan.innerHTML += ' <span class="master-badge">MASTER</span>';
                        }

                        const scoreSpan = document.createElement('span');
                        scoreSpan.className = 'player-score';
                        scoreSpan.textContent = `${player.score} pts`;

                        playerDiv.appendChild(nameSpan);
                        playerDiv.appendChild(scoreSpan);
                        this.playersList.appendChild(playerDiv);
                });
        }

        updateMasterControls() {
                const isMaster = this.player && this.player.isMaster;


                if (isMaster) {
                        this.masterControls.classList.remove('hidden');

                        this.createQuestionBtn.disabled = this.session.playerCount < 3;

                        if (this.session.status === 'waiting') {
                                this.questionInput.value = '';
                                this.answerInput.value = '';
                        }
                } else {
                        this.masterControls.classList.add('hidden');
                }
        }

        updateQuestionArea() {
                if (this.session.status === 'in-progress' && this.session.question) {
                        this.questionArea.classList.remove('hidden');
                        this.questionText.textContent = this.session.question.question;

                        if (this.session.status === 'ended' || this.session.question.isRevealed) {
                                this.answerText.textContent = `Answer: ${this.session.question.answer}`;
                                this.answerText.classList.remove('hidden');
                        }
                } else {
                        this.questionArea.classList.add('hidden');
                }
        }

        updateChatInput() {
                const canGuess = this.session.status === 'in-progress' &&
                        this.player &&
                        !this.player.isMaster &&
                        this.player.attempts < this.player.maxAttempts;

                const isTimeout = this.session.status === 'ended' && !this.session.winner;
                const shouldDisable = isTimeout || this.session.status === 'ended' || !canGuess;

                this.guessInput.disabled = shouldDisable;
                this.sendGuessBtn.disabled = shouldDisable;


                if (isTimeout) {
                        this.guessInput.placeholder = '⏰ Game timed out - waiting for next round...';
                } else if (this.session.status === 'ended') {
                        this.guessInput.placeholder = 'Game ended - waiting for next round...';
                } else if (canGuess) {
                        this.guessInput.placeholder = `Enter your guess (${this.player.maxAttempts - this.player.attempts} attempts left)`;
                } else if (this.player && this.player.isMaster) {
                        this.guessInput.placeholder = 'You are the master - create a question!';
                } else if (this.session.status === 'in-progress') {
                        this.guessInput.placeholder = 'No more attempts left';
                } else {
                        this.guessInput.placeholder = 'Enter your guess...';
                }
        }

        addMessage(text, type = 'system') {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${type}`;
                messageDiv.textContent = text;

                this.chatMessages.appendChild(messageDiv);
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }

        showError(message) {
                this.joinError.textContent = message;
                this.joinError.classList.remove('hidden');
                this.joinBtn.disabled = false;
                this.joinBtn.textContent = 'Join Session';
        }

        showWinnerModal(data) {
                const modal = document.getElementById('winnerModal');
                const winnerName = document.getElementById('winnerName');
                const winnerAnswer = document.getElementById('winnerAnswer');
                const countdown = document.getElementById('winnerCountdown');

                winnerName.textContent = data.winner.name;
                winnerAnswer.textContent = data.answer;
                modal.classList.remove('hidden');

                this.timer.textContent = '00:00';

                let timeLeft = data.countdown;
                countdown.textContent = timeLeft;

                const countdownInterval = setInterval(() => {
                        timeLeft--;
                        countdown.textContent = timeLeft;

                        if (timeLeft <= 0) {
                                clearInterval(countdownInterval);
                                modal.classList.add('hidden');
                        }
                }, 1000);
        }

        showTimeoutNotification(data) {
                this.addMessage(data.message, 'system');
                this.addMessage(`The answer was: ${data.answer}`, 'system');

                const timeoutDiv = document.createElement('div');
                timeoutDiv.className = 'timeout-notification';
                timeoutDiv.textContent = '⏰ Time\'s up! Game ended without a winner.';

                const mainArea = document.querySelector('.main-area');
                mainArea.insertBefore(timeoutDiv, mainArea.firstChild);

                setTimeout(() => {
                        if (timeoutDiv.parentNode) {
                                timeoutDiv.parentNode.removeChild(timeoutDiv);
                        }
                }, 5000);
        }

        showTimeoutModal(data) {
                const modalOverlay = document.createElement('div');
                modalOverlay.className = 'modal-overlay';
                modalOverlay.id = 'timeoutModal';

                const modal = document.createElement('div');
                modal.className = 'modal';

                modal.innerHTML = `
            <h2>⏰ Game Timeout!</h2>
            <div class="timeout-message">${data.message}</div>
            <div class="answer">The answer was: <strong>${data.answer}</strong></div>
            <div class="countdown" id="timeoutCountdown">5</div>
        `;

                modalOverlay.appendChild(modal);
                document.body.appendChild(modalOverlay);

                let timeLeft = 5;
                const countdownElement = document.getElementById('timeoutCountdown');

                const countdownInterval = setInterval(() => {
                        timeLeft--;
                        countdownElement.textContent = timeLeft;

                        if (timeLeft <= 0) {
                                clearInterval(countdownInterval);
                                modalOverlay.remove();
                        }
                }, 1000);
        }

        async updateShareLink() {
                try {
                        const response = await fetch('/api/game-url');
                        const data = await response.json();
                        this.shareLink.value = data.url;
                } catch (err) {
                        this.shareLink.value = window.location.href;
                }
        }

        async copyShareLink() {
                try {
                        await navigator.clipboard.writeText(this.shareLink.value);

                        const originalText = this.copyLinkBtn.innerHTML;
                        this.copyLinkBtn.innerHTML = '<span class="copy-icon">✅</span>';
                        this.copyLinkBtn.classList.add('copied');

                        this.addMessage('🔗 Game link copied to clipboard!', 'system');

                        setTimeout(() => {
                                this.copyLinkBtn.innerHTML = originalText;
                                this.copyLinkBtn.classList.remove('copied');
                        }, 2000);

                } catch (err) {
                        console.error('Failed to copy link:', err);

                        this.shareLink.select();
                        this.shareLink.setSelectionRange(0, 99999);

                        this.addMessage('📋 Link selected - press Ctrl+C to copy', 'system');
                }
        }
}

document.addEventListener('DOMContentLoaded', () => {
        new GameClient();
});

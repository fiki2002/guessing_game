const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameSession = require('./Classes/GameSession');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const gameUrl = process.env.GAME_URL || `http://localhost:${PORT}`;

app.use(express.static('.'));

app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to get game URL
app.get('/api/game-url', (req, res) => {
        const gameUrl = process.env.GAME_URL || `http://localhost:${PORT}`;
        res.json({ url: gameUrl });
});

const gameSession = new GameSession('default');

io.on('connection', (socket) => {

        socket.on('join', (data) => {
                try {
                        const { name } = data;

                        if (!name || name.trim() === '') {
                                socket.emit('error', { message: 'Name is required' });
                                return;
                        }

                        // Check if players can join
                        if (!gameSession.canJoin()) {
                                socket.emit('error', { message: 'Game is in progress. Please wait for it to end.' });
                                return;
                        }

                        // Add player to session
                        const player = gameSession.addPlayer(socket.id, name.trim());

                        // Join socket to room
                        socket.join('game');

                        // Send success response
                        socket.emit('joined', {
                                player: player.getPublicData(),
                                session: gameSession.getPublicData()
                        });

                        // Broadcast to all players
                        io.to('game').emit('playerJoined', {
                                player: player.getPublicData(),
                                session: gameSession.getPublicData()
                        });


                } catch (error) {
                        socket.emit('error', { message: error.message });
                }
        });

        // Handle question creation (master only)
        socket.on('createQuestion', (data) => {
                try {
                        const { question, answer } = data;

                        if (!question || !answer) {
                                socket.emit('error', { message: 'Question and answer are required' });
                                return;
                        }

                        const questionSet = gameSession.setQuestion(question, answer, socket.id);

                        if (questionSet) {
                                const gameStarted = gameSession.startGame(socket.id);

                                if (gameStarted) {
                                        io.to('game').emit('gameStarted', {
                                                question: gameSession.question.getPublicData(),
                                                session: gameSession.getPublicData()
                                        });
                                } else {
                                        socket.emit('error', {
                                                message: 'Cannot start game. Need at least 3 players.'
                                        });
                                }
                        } else {
                                socket.emit('error', { message: 'Only the game master can create questions' });
                        }

                } catch (error) {
                        socket.emit('error', { message: error.message });
                }
        });


        // Handle player guess
        socket.on('guess', (data) => {
                try {
                        const { guess } = data;

                        if (!guess || guess.trim() === '') {
                                socket.emit('error', { message: 'Guess is required' });
                                return;
                        }

                        const result = gameSession.processGuess(socket.id, guess.trim());

                        if (result.success) {
                                if (result.correct) {
                                        io.to('game').emit('gameEnded', {
                                                winner: result.player,
                                                answer: gameSession.question.answer,
                                                reason: 'correct',
                                                session: gameSession.getPublicData()
                                        });

                                        io.to('game').emit('winnerModal', {
                                                winner: result.player,
                                                answer: gameSession.question.answer,
                                                countdown: 5
                                        });

                                        // Reset for new round after countdown
                                        setTimeout(() => {
                                                gameSession.resetForNewRound();
                                                io.to('game').emit('sessionUpdate', gameSession.getPublicData());

                                                // Notify all players about new master
                                                const newMaster = gameSession.getPlayers().find(p => p.isMaster);
                                                if (newMaster) {
                                                        io.to(newMaster.socketId).emit('newMasterNotification', {
                                                                message: 'You are now the game master! Create a question to start the next round.'
                                                        });

                                                        gameSession.getPlayers().forEach(player => {
                                                                if (player.socketId !== newMaster.socketId) {
                                                                        io.to(player.socketId).emit('newMasterNotification', {
                                                                                message: `${newMaster.name} is now the game master and will ask the next question.`
                                                                        });
                                                                }
                                                        });

                                                        // Set timeout for new master to start game (60 seconds)
                                                        const masterTimeout = setTimeout(() => {
                                                                if (gameSession.status === 'waiting') {
                                                                        gameSession.rotateMaster();
                                                                        const nextMaster = gameSession.getPlayers().find(p => p.isMaster);

                                                                        if (nextMaster) {
                                                                                io.to('game').emit('sessionUpdate', gameSession.getPublicData());

                                                                                // Notify new master
                                                                                io.to(nextMaster.socketId).emit('newMasterNotification', {
                                                                                        message: 'Previous master didn\'t start the game. You are now the game master!'
                                                                                });

                                                                                // Notify other players
                                                                                gameSession.getPlayers().forEach(player => {
                                                                                        if (player.socketId !== nextMaster.socketId) {
                                                                                                io.to(player.socketId).emit('newMasterNotification', {
                                                                                                        message: `${nextMaster.name} is now the game master.`
                                                                                                });
                                                                                        }
                                                                                });
                                                                        }
                                                                }
                                                        }, 60000);

                                                        gameSession.masterTimeoutId = masterTimeout;
                                                }
                                        }, 5000);

                                } else {
                                        // Wrong guess
                                        socket.emit('guessResult', result);
                                        io.to('game').emit('sessionUpdate', gameSession.getPublicData());
                                }
                        } else {
                                socket.emit('error', { message: result.message });
                        }

                } catch (error) {
                        socket.emit('error', { message: error.message });
                }
        });

        // Handle timer updates
        socket.on('getTimer', () => {
                if (gameSession.status === 'in-progress') {
                        socket.emit('timerUpdate', {
                                timeLeft: gameSession.timer.getTimeLeft(),
                                formatted: gameSession.timer.getFormattedTime()
                        });
                }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
                console.log('User disconnected:', socket.id);

                const player = gameSession.removePlayer(socket.id);

                if (player) {
                        console.log(`Player ${player.name} left the game`);

                        // If session is empty, clear it
                        if (gameSession.isEmpty()) {
                                gameSession.clear();
                                console.log('Session cleared - no players left');
                        } else {
                                // Broadcast player left
                                io.to('game').emit('playerLeft', {
                                        player: player.getPublicData(),
                                        session: gameSession.getPublicData()
                                });
                        }
                }
        });
});

// Timer broadcast (every second during active game)
setInterval(() => {
        if (gameSession.status === 'in-progress' && gameSession.timer.isActive()) {
                io.to('game').emit('timerUpdate', {
                        timeLeft: gameSession.timer.getTimeLeft(),
                        formatted: gameSession.timer.getFormattedTime()
                });
        }
}, 1000);

// Handle timer timeout - improved synchronization
setInterval(() => {
        if (gameSession.status === 'in-progress' && gameSession.timer.getTimeLeft() <= 0) {

                // Prevent multiple timeout triggers
                if (gameSession.timeoutTriggered) {
                        return;
                }
                gameSession.timeoutTriggered = true;

                // Timer expired - end game immediately
                gameSession.endGame(null, 'timeout');

                // Get session data after ending the game
                const sessionData = gameSession.getPublicData();

                // Immediately broadcast the game ended event
                io.to('game').emit('gameEnded', {
                        winner: null,
                        answer: gameSession.question.answer,
                        reason: 'timeout',
                        session: sessionData
                });

                // Show timeout popover modal to all players
                io.to('game').emit('timeoutModal', {
                        message: 'Game timeout, nobody got the correct answer',
                        answer: gameSession.question.answer
                });

                // Notify current master to ask another question
                const currentMaster = gameSession.getPlayers().find(p => p.isMaster);
                if (currentMaster) {
                        // Notify the master
                        io.to(currentMaster.socketId).emit('newMasterNotification', {
                                message: 'No one answered the previous question. You are now the game master - ask another question!'
                        });

                        // Notify other players about the master
                        gameSession.getPlayers().forEach(player => {
                                if (player.socketId !== currentMaster.socketId) {
                                        io.to(player.socketId).emit('newMasterNotification', {
                                                message: `${currentMaster.name} is now the game master and will ask the next question.`
                                        });
                                }
                        });
                }

                // Reset for new round after a delay
                setTimeout(() => {
                        gameSession.resetForNewRound();
                        gameSession.timeoutTriggered = false; // Reset timeout flag
                        io.to('game').emit('sessionUpdate', gameSession.getPublicData());
                }, 5000);
        }
}, 100); // Check very frequently for better synchronization

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Open ${gameUrl} to play the game`);
});

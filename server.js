const createError = require('http-errors');
const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const debug = require('debug')('quick-streamer:server');
const Database = require("./database");

const db = new Database();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get("/panel", (req, res) => {
    const existingSessionIds = Object.keys(db.sessions);

    let session;
    if (existingSessionIds.length === 0) {
        session = db.initSession();

        res.redirect(`/panel?${new URLSearchParams({ownerKey: session.ownerKey})}`);
        return;
    } else {
        session = db.sessions[existingSessionIds[0]];

        if (session.ownerKey !== req.query["ownerKey"]) {
            res.send("Nieprawidłowy klucz uwierzytelniający.");
            return;
        }
    }

    res.render("panel");
});

app.get("/", (req, res) => {
    res.render("watch");
});

io.use((socket, next) => {
    const username = socket.handshake.auth["username"];

    if (!username?.trim() || typeof username !== "string") {
        next(new Error("invalid username"));
    }

    const sessionId = Object.keys(db.sessions)[0];
    socket.join(sessionId);
    socket.data.sessionId = sessionId;
    socket.data.isStreamer = "ownerKey" in socket.handshake.auth ?
        socket.handshake.auth["ownerKey"] === db.sessions[sessionId].ownerKey
        :
        false;
    socket.data.username = username;
    next();
});

io.on("connection", socket => {
    const currentSessionId = String(socket.data.sessionId);
    const currentSession = () => db.sessions[currentSessionId];
    const toStreamerInCurrentSession = () => io.to(currentSession().streamer.socketId);
    const inCurrentSession = () => io.in(currentSessionId);
    const selfUsername = String(socket.data.username);
    const isStreamer = Boolean(socket.data.isStreamer);

    if (!isStreamer) {
        const currentMembers = currentSession().members;
        currentMembers[socket.id] = selfUsername;
    }

    socket.on("stream:sendMessage", message => {
        inCurrentSession().emit("stream:message", selfUsername, message);
    });

    socket.on("stream:requestState", () => {
        io.in(socket.id).emit("stream:state", currentSession().state);
    });

    socket.on("rtc:offer", offer => {
        toStreamerInCurrentSession().emit("rtc:offer", offer, socket.id);
    });

    socket.on("rtc:answer", (socketId, answer) => {
        io.to(socketId).emit("rtc:answer", answer);
    });

    socket.on("rtc:iceCandidate", (socketId, candidate) => {
        console.log(`ICE candidate ${socket.id} --> ${socketId}`);
        io.to(socketId).emit("rtc:iceCandidate", socket.id, candidate);
    });

    socket.on("rtc:iceCandidateToStreamer", candidate => {
        console.log(`ICE candidate ${socket.id} --> ${currentSession().streamer.socketId}`);
        toStreamerInCurrentSession().emit("rtc:iceCandidate", socket.id, candidate);
    });

    if (isStreamer) {
        const ownerKey = socket.handshake.auth["ownerKey"];

        db.registerStreamerInfo(currentSessionId, ownerKey, {
            name: selfUsername,
            socketId: socket.id
        });

        socket.on("stream:start", () => {
            currentSession().state = "started";
            inCurrentSession().emit("stream:state", "started");
        });

        socket.on("stream:stop", () => {
            db.closeSession(currentSessionId);
            inCurrentSession().emit("stream:state", "stopped");
        });
    }

    socket.on("disconnect", () => {
        const session = currentSession();

        if (session) {
            if (isStreamer) {
                db.closeSession(currentSessionId);
                inCurrentSession().emit("stream:state", "stopped");
            } else {
                const currentMembers = session.members;
                delete currentMembers[socket.id];
                toStreamerInCurrentSession().emit("stream:clientLeft", socket.id);
            }
        }
    });
});

app.use((req, res, next) => {
    next(createError(404));
});

app.use((err, req, res) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);
    res.render('error');
});

const port = normalizePort('7284');
app.set('port', port);
server.listen(port, () => {
    console.log(`Listening on port :${port}`);
});
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) return val;
    if (port >= 0) return port;

    return false;
}

function onError(error) {
    if (error.syscall !== 'listen') throw error;

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            //process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            //process.exit(1);
            break;
        default:
            throw error;
    }
}

function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    debug('Listening on ' + bind);
}

class Interaction {
    createSession() {
        const session = db.initSession();

        return {
            sessionId: session.id,
            ownerKey: session.ownerKey
        };
    }
}

module.exports = {
    interaction: new Interaction()
};

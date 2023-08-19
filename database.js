const crypto = require("crypto");

/**
 * @typedef {Object} StreamerInfo
 * @property {string} name
 * @property {string} socketId
 */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {?StreamerInfo} streamer
 * @property {Object<string, string>} members Maps socket IDs to usernames
 * @property {string} ownerKey
 * @property {"started"|"stopped"} state
 */

class Database {
    /** @type {Object<string, Session>} */
    sessions = {};

    /**
     * @returns {Session}
     */
    initSession() {
        const sessionId = crypto.randomUUID()
        /** @type {Session} */
        const session = {
            id: sessionId,
            streamer: null,
            members: {},
            ownerKey: crypto.randomBytes(32).toString("hex"),
            state: "stopped"
        };

        this.sessions[sessionId] = session;

        return session;
    }

    /**
     * @param sessionId {string}
     * @param ownerKey {string}
     * @param streamerInfo {StreamerInfo}
     */
    registerStreamerInfo(sessionId, ownerKey, streamerInfo) {
        const session = this.sessions[sessionId];

        if (!session || session.ownerKey !== ownerKey) {
            throw new Error("permission denied");
        }

        session.streamer = streamerInfo;
    }

    closeSession(sessionId) {
        delete this.sessions[sessionId];
    }
}

module.exports = Database;

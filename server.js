const express = require("express");

class OfferCallback {
    offerCb = () => undefined;
    answerCb;

    passAnswer(answer) {
        this.answerCb(answer);
    }
}

class IceCandidateCallback {
    sendCandidatesCallback = () => undefined;
    candidatesCallback;

    sendCandidates(candidates) {
        this.sendCandidatesCallback(candidates);
    }

    passCandidates(candidates) {
        this.candidatesCallback(candidates);
    }
}

const offerCallback = new OfferCallback();
const iceCandidateCallback = new IceCandidateCallback();

const app = express();
app.set("view engine", "ejs");
app.set("views", "views");

const PORT = 7284;
app.listen(PORT);

app.get("/", (req, res) => {
    res.render("viewer");
});

app.post("/offer", express.json(), (req, res) => {
    offerCallback.answerCb = answer => {
        res.json(answer);
    };
    offerCallback.offerCb(req.body);
});

app.post("/ice", express.json(), (req, res) => {
    iceCandidateCallback.candidatesCallback = candidates => {
        res.json(candidates);
    }
    iceCandidateCallback.sendCandidates(req.body);
});

module.exports = {offerCallback, iceCandidateCallback};

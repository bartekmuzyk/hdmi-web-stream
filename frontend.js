const startBtn = document.getElementById("start-btn");
const videoInputChooser = document.getElementById("video-input-chooser");
const audioInputChooser = document.getElementById("audio-input-chooser");

/**
 * @param devices {InputDeviceInfo[]}
 */
function onGotDevices(devices) {
    const inputs = devices.filter(device => device.deviceId !== "default" && device.kind !== "audiooutput");

    if (inputs.length === 0) {
        alert("Nie wykryto żadnego urządzenia wideo lub audio. Program nie będzie działać.");
        startBtn.innerText = "Brak urządzeń";
        return;
    }

    let videoInputCount = 0;
    let audioInputCount = 0;

    for (const input of inputs) {
        const optionElement = document.createElement("option");
        optionElement.value = input.deviceId;
        optionElement.innerText = input.label;

        switch (input.kind) {
            case "videoinput":
                videoInputCount++;
                videoInputChooser.appendChild(optionElement);
                break;
            case "audioinput":
                audioInputCount++;
                audioInputChooser.appendChild(optionElement);
                break;
        }
    }

    if (videoInputCount === 0) {
        alert("Nie wykryto żadnego urządzenia wideo. Program nie będzie działać.");
        startBtn.innerText = "Brak wideo";
        return;
    } else if (audioInputCount === 0) {
        alert("Nie wykryto żadnego urządzenia audio. Program nie będzie działać.");
        startBtn.innerText = "Brak audio";
        return;
    }

    startBtn.removeAttribute("disabled");
    startBtn.innerText = "Rozpocznij strumień";
}

let peerConnection = new RTCPeerConnection({
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
});

startBtn.onclick = async () => {
    console.log("video: " + videoInputChooser.value);
    console.log("audio: " + audioInputChooser.value);

    let iceCandidates = [];
    peerConnection.addEventListener("icecandidate", event => {
        console.log("new ice candidate: %o", event.candidate);
        iceCandidates.push(event.candidate);
    });

    window.desktopAppApi.onGotRtcOffer(async (event, offer) => {
        console.log("got offer: %o", offer);

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        console.log("sending answer: %o", answer);

        event.sender.send("rtc-answer", answer.toJSON());
    });

    window.desktopAppApi.onGotIceCandidates(async (event, candidates) => {
        console.log("got ice candidates")

        for (const candidate of candidates) {
            await peerConnection.addIceCandidate(candidate);
        }

        console.log("trying to send ice candidates");

        if (peerConnection.iceGatheringState === "complete") {
            console.log("sending ice candidates");
            event.sender.send("ice-candidates", iceCandidates);
        } else {
            peerConnection.addEventListener("icegatheringstatechange", event => {
                if (event.target.iceGatheringState === "complete") {
                    console.log("sending ice candidates");
                    event.sender.send("ice-candidates", iceCandidates);
                }
            });
        }
    });

    // await navigator.mediaDevices.getUserMedia({
    //     video: {
    //         deviceId: {
    //             exact: videoInputChooser.value
    //         }
    //     },
    //     audio: {
    //         deviceId: {
    //             exact: audioInputChooser.value
    //         }
    //     }
    // });
};

navigator.mediaDevices.enumerateDevices().then(onGotDevices);

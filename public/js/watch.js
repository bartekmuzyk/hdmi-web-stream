M.AutoInit(null);
M.Modal.init(document.querySelectorAll(".modal"), {
	dismissible: false
});

const splashScreen = document.getElementById("splash-screen");
const streamViewer = document.getElementById("stream-viewer");
const loadingText = document.getElementById("loading-text");
/** @type {HTMLVideoElement} */
const streamPlayer = document.getElementById("stream-player");
const watchBtnWrapper = document.getElementById("watch-btn-wrapper");
const watchBtn = document.getElementById("watch-btn");

let isWatching = false;
const socket = io(undefined, {
	autoConnect: false,
	auth: {
		username: "client"
	}
});

socket.on("connect", () => {
	console.log("connected. requesting state...");
	socket.emit("stream:requestState");
});

const ICEConfiguration = {
	iceServers: [
		{
			urls: "stun:stun.l.google.com:19302"
		}
	]
};
const peerConnection = new RTCPeerConnection(ICEConfiguration);

peerConnection.addEventListener("track", ev => {
	console.log("received streams %o", ev.streams);
	const [ remoteStream ] = ev.streams;
	streamPlayer.srcObject = remoteStream;
	streamPlayer.play();
	isWatching = true;
});

peerConnection.addEventListener("icecandidate", ev => {
	console.log("icecandidate event, sending to streamer");
	socket.emit("rtc:iceCandidateToStreamer", ev.candidate);
});

socket.on("rtc:answer", async answer => {
	console.log("got answer");
	const remoteDescription = new RTCSessionDescription(answer);
	await peerConnection.setRemoteDescription(remoteDescription);
	splashScreen.style.display = "none";
	streamViewer.style.display = "flex";
});

socket.on("rtc:iceCandidate", async (socketId, candidate) => {
	console.log("got ICE candidate");
	await peerConnection.addIceCandidate(candidate);
});

async function startRTCHandshake() {
	console.log("starting RTC handshake");
	peerConnection.addTransceiver("video");
	peerConnection.addTransceiver("audio");
	peerConnection.getTransceivers().forEach(t => t.direction = "recvonly");
	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	console.log("sending offer");
	socket.emit("rtc:offer", offer);
}

socket.on("stream:state", state => {
	console.log(`received state: ${state}`);

	if (state === "started") {
		loadingText.innerText = "Łączenie przez RTC...";
		startRTCHandshake();
	} else if (state === "stopped" && isWatching) {
		M.Modal.getInstance(document.getElementById("stream-ended-modal")).open();
	}
});

watchBtn.onclick = () => void setTimeout(startWatching, 100);

function startWatching() {
	watchBtnWrapper.setAttribute("data-clicked", "1");
	socket.connect();
	document.body.requestFullscreen({navigationUI: "hide"});
}

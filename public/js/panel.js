M.AutoInit(null);
M.Modal.init(document.querySelectorAll(".modal"), {
	dismissible: false,
	startingTop: "15%",
	endingTop: "15%"
});

/** @type {HTMLButtonElement} */
const goLiveBtn = document.getElementById("go-live-btn");
/** @type {HTMLButtonElement} */
const stopStreamBtn = document.getElementById("stop-stream-btn");
const liveStatus = document.getElementById("live-status");
const statusBar = document.getElementById("status-bar");
const errorMessageLabel = document.getElementById("error-message");
const connectionErrorModal = M.Modal.getInstance(document.getElementById("connection-error-modal"));
const disconnectReasonLabel = document.getElementById("disconnect-reason");
const disconnectionModal = M.Modal.getInstance(document.getElementById("disconnection-modal"));
const videoInputSelect = document.getElementById("video-input-select");
const audioInputSelect = document.getElementById("audio-input-select");

function createInputRadioButton(text, value, group) {
	const p = document.createElement("p");
	const label = document.createElement("label");
	const input = document.createElement("input");
	input.type = "radio";
	input.className = "with-gap";
	input.value = value;
	input.name = group;
	label.appendChild(input);
	const span = document.createElement("span");
	span.innerText = text;
	label.appendChild(span);
	p.appendChild(label);

	return p;
}

function getValueOfSelectedRadioButtonInGroup(group) {
	return document.querySelector(`input[type="radio"][name="${group}"]:checked`)?.value ?? null;
}

/**
 * @param devices {InputDeviceInfo[]}
 */
function onGotDevices(devices) {
	const inputs = devices.filter(device => device.deviceId !== "default" && device.kind !== "audiooutput");

	if (inputs.length === 0) {
		const refresh = confirm("Nie wykryto żadnego urządzenia wideo lub audio. Program nie będzie działać. Wciśnięcie Ok odświeży aplikację, Anuluj ją zamknie.");
		if (refresh) location.reload();
		else window.desktopAppApi.quit();
		return;
	}

	let videoInputCount = 0;
	let audioInputCount = 0;

	for (const input of inputs) {
		const optionElement = createInputRadioButton(input.label, input.deviceId, input.kind);

		switch (input.kind) {
			case "videoinput":
				videoInputCount++;
				videoInputSelect.appendChild(optionElement);
				break;
			case "audioinput":
				audioInputCount++;
				audioInputSelect.appendChild(optionElement);
				break;
		}
	}

	if (videoInputCount === 0) {
		const refresh = confirm("Nie wykryto żadnego urządzenia wideo. Program nie będzie działać. Wciśnięcie Ok odświeży aplikację, Anuluj ją zamknie.");
		if (refresh) location.reload();
		else window.desktopAppApi.quit();
	} else if (audioInputCount === 0) {
		const refresh = confirm("Nie wykryto żadnego urządzenia audio. Program nie będzie działać. Wciśnięcie Ok odświeży aplikację, Anuluj ją zamknie.");
		if (refresh) location.reload();
		else window.desktopAppApi.quit();
	}

	goLiveBtn.removeAttribute("disabled");
	M.toast({ html: "Gotowy", displayLength: 1000 });
}

/**
 * @param status {"stopped"|"progress"|"started"}
 */
function setStreamStateDisplay(status) {
	statusBar.setAttribute("data-livestatus", status);

	switch (status) {
		case "started": liveStatus.innerText = "Transmituję"; break;
		case "progress": liveStatus.innerText = "Czekaj..."; break;
		case "stopped": liveStatus.innerText = "Wstrzymany"; break;
	}
}

const params = new URLSearchParams(location.search);
const sessionId = params.get("sessionId");
const ownerKey = params.get("ownerKey");

if (!sessionId || !ownerKey) {
	location.assign("/");
}

const socket = io(undefined, {
	auth: {
		username: "HDMI",
		ownerKey
	},
	query: {
		sessionId
	}
});

socket.on("connect", () => {
	liveStatus.innerText = "Skanowanie urządzeń...";
	navigator.mediaDevices.enumerateDevices()
		.then(onGotDevices)
		.finally(() => {
			setStreamStateDisplay("stopped");
		});
});

socket.on("connect_error", err => {
	errorMessageLabel.innerText = err.message;
	connectionErrorModal.open();
});

socket.on("disconnect", reason => {
	if (reason !== "io client disconnect") {
		const sfx = new Audio("/sounds/disconnect sfx.mp3");
		sfx.volume = 0.6;
		disconnectReasonLabel.innerText = reason;
		disconnectionModal.open();
		sfx.play();
	}
});

socket.on("stream:state", state => {
	console.log(`state change: ${state}`)
	setStreamStateDisplay(state);

	if (state === "started") {
		goLiveBtn.style.display = "none";
		stopStreamBtn.style.display = "block";
	}
});

const ICEConfiguration = {
	iceServers: [
		{
			urls: "stun:stun.l.google.com:19302"
		}
	]
};
/**
 * Maps socket ID's to their respective WebRTC peer connections
 * @type {Object<string, RTCPeerConnection>}
 */
const peerConnections = {};
/** @type {?MediaStream} */
let currentStream = null;

socket.on("rtc:offer", async (offer, socketId) => {
	console.log("got offer");
	const peerConnection = new RTCPeerConnection(ICEConfiguration);
	peerConnections[socketId] = peerConnection;

	peerConnection.addEventListener("icecandidate", ev => {
		console.log(`icecandidate event. sending to socket ${socketId}`);
		socket.emit("rtc:iceCandidate", socketId, ev.candidate);
	});

	currentStream.getTracks().forEach(track => {
		console.log("adding track %o", track);
		peerConnection.addTrack(track, currentStream);
	});

	await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

	const answer = await peerConnection.createAnswer();
	answer.sdp = answer.sdp.replace("useinbandfec=1", "useinbandfec=1; stereo=1; maxaveragebitrate=510000");
	await peerConnection.setLocalDescription(answer);

	console.log("sending answer");
	socket.emit("rtc:answer", socketId, answer);
});

socket.on("rtc:iceCandidate", async (socketId, candidate) => {
	console.log(`got ICE candidate from ${socketId}`);
	await peerConnections[socketId].addIceCandidate(candidate);
});

socket.on("stream:clientLeft", socketId => {
	peerConnections[socketId].close();
	delete peerConnections[socketId];
	document.querySelector(`#viewers-list > div[data-socketid="${socketId}"]`).remove()
});

/**
 * @typedef {Object} StreamSource
 * @property {string} id id of the source. will begin with `window:` if the source is a window, and with `screen:` if it is a screen
 * @property {string} name app/screen name
 * @property {?string} icon icon data as a data URL. `undefined` if the source is a screen.
 */

goLiveBtn.onclick = async () => {
	const videoDeviceId = getValueOfSelectedRadioButtonInGroup("videoinput");
	if (videoDeviceId === null) {
		alert("Nie wybrano urządzenia wideo.");
		return;
	}

	const audioDeviceId = getValueOfSelectedRadioButtonInGroup("audioinput");
	if (audioDeviceId === null) {
		alert("Nie wybrano urządzenia audio.");
		return;
	}

	goLiveBtn.disabled = true;
	setStreamStateDisplay("progress");

	console.log(`video device id: ${videoDeviceId}`);
	console.log(`audio device id: ${audioDeviceId}`);

	currentStream = await navigator.mediaDevices.getUserMedia({
		video: {deviceId: {exact: videoDeviceId}},
		audio: {deviceId: {exact: audioDeviceId}},
	});
	socket.emit("stream:start");
	console.log(location.origin + "/ogladaj?id=" + sessionId);
};

stopStreamBtn.onclick = () => {
	stopStreamBtn.disabled = true;
	setStreamStateDisplay("progress");

	for (const [ socketId, peerConnection ] of Object.entries(peerConnections)) {
		peerConnection.close();
		delete peerConnections[socketId];
	}

	currentStream.getTracks().forEach(track => track.stop());
	socket.emit("stream:stop");

	setStreamStateDisplay("stopped");
	M.toast({ html: "Transmisja zakończona. Proszę czekać..." });
	location.reload();
};

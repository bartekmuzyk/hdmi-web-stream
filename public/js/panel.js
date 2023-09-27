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
const resolutionBtn = document.getElementById("resolution-btn");
const resolutionModal = document.getElementById("resolution-modal");
const resolutionWidthInput = document.getElementById("resolution-width-input");
const resolutionHeightInput = document.getElementById("resolution-height-input");
const resolutionSaveBtn = document.getElementById("resolution-save-btn");

if (!localStorage.getItem("res.width") || !localStorage.getItem("res.height")) {
	localStorage.setItem("res.width", "1280");
	localStorage.setItem("res.height", "720");
}

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
	p.onclick = () => {
		document.getElementsByTagName("html")[0].scrollTo({
			top: 0,
			behavior: "instant"
		});
	};

	return p;
}

function getValueOfSelectedRadioButtonInGroup(group) {
	const el = document.querySelector(`input[type="radio"][name="${group}"]:checked`);
	return el ? el.value : null;
}

/** @type {Object<string, MediaStream>} */
const videoDevicesStreams = {};

/**
 * @param devices {InputDeviceInfo[]}
 */
async function onGotDevices(devices) {
	const inputs = devices.filter(device => device.deviceId !== "default" && device.kind !== "audiooutput");

	if (inputs.length === 0) {
		const refresh = confirm("Nie wykryto żadnego urządzenia wideo lub audio. Program nie będzie działać. Wciśnięcie Ok odświeży aplikację, Anuluj ją zamknie.");
		if (refresh) location.reload();
		else window.desktopAppApi.quit();
		return;
	}

	let videoInputCount = 0;
	let audioInputCount = 0;

	audioInputSelect.appendChild(createInputRadioButton("Bez audio", "without", "audioinput"));

	const resolution = {
		width: parseInt(localStorage.getItem("res.width").trim()),
		height: parseInt(localStorage.getItem("res.height").trim())
	};

	if (isNaN(resolution.width)) resolution.width = 1280;
	if (isNaN(resolution.height)) resolution.height = 720;

	localStorage.setItem("res.width", resolution.width.toString());
	resolutionWidthInput.value = resolution.width.toString();
	localStorage.setItem("res.height", resolution.height.toString());
	resolutionHeightInput.value = resolution.height.toString();
	M.updateTextFields();

	for (const input of inputs) {
		const optionElement = createInputRadioButton(input.label, input.deviceId, input.kind);

		switch (input.kind) {
			case "videoinput":
				videoInputCount++;
				videoInputSelect.appendChild(optionElement);

				console.log(`getting stream for device ${input.label} (${input.deviceId})...`)
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId: {exact: input.deviceId},
						width: {ideal: resolution.width},
						height: {ideal: resolution.height},
						frameRate: 60
					},
					audio: false
				});
				videoDevicesStreams[input.deviceId] = stream;
				console.log("got it!");

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
	liveStatus.innerText = {
		"started": "Transmituję",
		"progress": "Czekaj...",
		"stopped": "Wstrzymany"
	}[status] ?? "Błąd";
}

const params = new URLSearchParams(location.search);
const ownerKey = params.get("ownerKey");

const socket = io(undefined, {
	auth: {
		username: "HDMI",
		ownerKey
	}
});

socket.on("connect", () => {
	liveStatus.innerText = "Skanowanie urządzeń...";
	navigator.mediaDevices.enumerateDevices()
		.then(onGotDevices)
		.then(() => {
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
});

goLiveBtn.onclick = async () => {
	const videoDeviceId = getValueOfSelectedRadioButtonInGroup("videoinput");
	if (videoDeviceId === null) {
		alert("Nie wybrano urządzenia wideo.");
		return;
	}

	const audioDeviceId = getValueOfSelectedRadioButtonInGroup("audioinput");
	if (audioDeviceId === null) {
		alert("Nie wybrano urządzenia audio. Strumień nie będzie zawierał dźwięku.");
	}

	goLiveBtn.disabled = true;
	document.getElementById("refresh-btn").disabled = true;
	resolutionBtn.disabled = true;
	setStreamStateDisplay("progress");

	console.log(`video device id: ${videoDeviceId}`);
	console.log(`audio device id: ${audioDeviceId}`);

	const videoStream = videoDevicesStreams[videoDeviceId].clone();
	console.log("got a clone of the video stream! adding audio tracks to it...");

	if (audioDeviceId !== null && audioDeviceId !== "without") {
		const audioStream = await navigator.mediaDevices.getUserMedia({
			video: false,
			audio: {
				deviceId: {exact: audioDeviceId},
				autoGainControl: false,
				channelCount: 2,
				echoCancellation: false,
				latency: 0,
				noiseSuppression: false,
				sampleRate: 48000,
				sampleSize: 16
			},
		});
		console.log("got audio stream!");

		for (const audioTrack of audioStream.getAudioTracks()) {
			videoStream.addTrack(audioTrack);
		}
	}

	currentStream = videoStream;
	socket.emit("stream:start");
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

resolutionBtn.onclick = () => {
	M.Modal.getInstance(resolutionModal).open();
}

resolutionSaveBtn.onclick = () => {
	localStorage.setItem("res.width", resolutionWidthInput.value);
	localStorage.setItem("res.height", resolutionHeightInput.value);
	location.reload();
};

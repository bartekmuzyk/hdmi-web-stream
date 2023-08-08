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

navigator.mediaDevices.enumerateDevices().then(onGotDevices);

startBtn.onclick = async () => {
    console.log(videoInputChooser.value);
    console.log(audioInputChooser.value);
    // navigator.mediaDevices.getUserMedia({
    //     video: true,
    //     audio: true
    // });
};
// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";
const demosSection = document.getElementById("demos");
let poseLandmarker = undefined;
let runningMode = "VIDEO";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";


// initial conditions
let standing = false;
let squat = true;
let sitting = false;
let standing_threshold = 50;
let sqaut_threshold = 15;
let sitting_threshold = -40;
let squat_count = 0;


// Before we can use PoseLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createPoseLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numPoses: 2
    });
    demosSection.classList.remove("invisible");
};
createPoseLandmarker();

/********************************************************************
// Demo : Continuously grab image from webcam stream and detect it.
********************************************************************/
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);
// Check if webcam access is supported.
const hasGetUserMedia = () => { var _a; return !!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia); };
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
function enableCam(event) {
    if (!poseLandmarker) {
        console.log("Wait! poseLandmaker not loaded yet.");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }
    // getUsermedia parameters.
    const constraints = {
        video: true
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
}

let get_vector = (knee_landmark,hip_landmark) => {
    let x = knee_landmark.x - hip_landmark.x;
    let y = knee_landmark.y - hip_landmark.y;

    let the_cosine = x/Math.sqrt((x*x) + (y*y));
    let the_asine = (y ? (y/Math.abs(y)):1)*Math.asin(Math.sqrt(1-(the_cosine*the_cosine)));
    the_asine = (180*the_asine)/Math.PI;

    // console.log("The amgle is: ",the_asine);
    return the_asine;
}

let lastVideoTime = -1;
async function predictWebcam() {
    canvasElement.style.height = videoHeight;
    video.style.height = videoHeight;
    canvasElement.style.width = videoWidth;
    video.style.width = videoWidth;


    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await poseLandmarker.setOptions({ runningMode: "VIDEO" });
    }
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            for (const landmark of result.landmarks) {
                let left_angle = get_vector(landmark[25],landmark[23]);
                let right_angle = get_vector(landmark[26],landmark[24]);
                // console.log("The left and right angle are: ", left_angle, right_angle)
                if(left_angle>=standing_threshold && right_angle>=standing_threshold){
                    if(!standing){
                        squat = false;
                        standing = true;
                        sitting = false;
                        console.log("Aap khade hogye hain");
                    }
                }
                if(left_angle<=sqaut_threshold && right_angle<=sqaut_threshold){
                    if(!squat && !sitting){
                        squat = true;
                        standing = false;
                        squat_count += 1;
                        console.log("Aap squat position mai hai and squat count = ",squat_count);
                    }
                }
                if(left_angle<sitting_threshold && right_angle<sitting_threshold){
                    if(!sitting){
                        sitting = true;
                        standing = false;
                        squat = false;
                        console.log("Aap baith gaye hain!!");
                    }
                }
                drawingUtils.drawLandmarks(landmark, {
                    radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
                });
                drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
            }
            canvasCtx.restore();
        });
    }
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}
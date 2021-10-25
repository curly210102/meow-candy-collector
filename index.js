"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jimp_1 = __importDefault(require("jimp"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const exec = util_1.promisify(child_process_1.exec);
async function checkADBPrepared() {
    try {
        const version = await exec("adb version")
            .then(({ stdout }) => stdout)
            .catch(() => {
            throw new Error("ADB is not installed.");
        });
        const result = await exec("adb devices -l", {
            encoding: "utf-8",
        }).then(({ stdout }) => stdout);
        const deviceCount = result.trim().split(/\n+/).length - 1;
        if (deviceCount === 0) {
            throw new Error("Haven't connect with any devices.");
        }
        console.log(`\x1b[32m${version}\nconnect with ${deviceCount} devices\x1b[0m`);
        return true;
    }
    catch (error) {
        console.log(`\x1b[31m${error}\x1b[0m`);
        return false;
    }
}
async function pullCurrentScreenShot() {
    await exec("adb shell screencap /sdcard/meow_candy.png");
    await exec("adb pull /sdcard/meow_candy.png ./images");
}
async function recognizeTapTarget(srcImgPath, targetImgPath) {
    const targetImage = await jimp_1.default.read(targetImgPath);
    targetImage.greyscale();
    const tWidth = targetImage.bitmap.width;
    const tHeight = targetImage.bitmap.height;
    const tCenterX = tWidth >> 1;
    const tCenterY = tHeight >> 1;
    const rect = [
        targetImage.getPixelColor(0, 0),
        targetImage.getPixelColor(tWidth, 0),
        targetImage.getPixelColor(tWidth, tHeight),
        targetImage.getPixelColor(0, tHeight),
        targetImage.getPixelColor(tCenterX, tCenterY),
    ];
    const image = await jimp_1.default.read(srcImgPath);
    image.greyscale();
    const sWidth = image.bitmap.width;
    const sHeight = image.bitmap.height;
    let matchedPoint = null;
    for (const { x, y } of image.scanIterator(0, 0, sWidth - tWidth, sHeight - tHeight)) {
        if (image.getPixelColor(x, y) === rect[0] &&
            image.getPixelColor(x + tWidth, y + tHeight) === rect[3] &&
            image.getPixelColor(x + tWidth, y) === rect[1] &&
            image.getPixelColor(x, y + tHeight) === rect[2]) {
            matchedPoint = [x, y];
            break;
        }
    }
    return matchedPoint;
}
async function doTap([x, y]) {
    await exec(`adb shell input tap ${x} ${y}`);
}
async function doBack() {
    await exec(`adb shell input keyevent 4`);
}
function wait(duration) {
    return new Promise((resolve) => {
        setTimeout(() => resolve("done"), duration);
    });
}
function actionInLayout(reference) {
    return new Promise(async (resolve, reject) => {
        await pullCurrentScreenShot();
        const target = await recognizeTapTarget("./images/meow_candy.png", reference);
        console.log(target);
        if (!target) {
            reject();
        }
        else {
            doTap(target);
            resolve(target);
        }
    });
}
async function viewRobot() {
    try {
        await actionInLayout("./images/view_button.png");
        await wait(20000);
        doBack();
        await wait(2000);
        await viewRobot();
    }
    catch (error) {
        await wait(3000);
        await viewRobot();
    }
}
(async () => {
    if (await checkADBPrepared()) {
        try {
            await actionInLayout("./images/panel_button.png");
            await wait(2000);
            await viewRobot();
        }
        catch (e) {
            console.log("Not Found Tap Target.");
        }
    }
})();

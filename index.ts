import Jimp from "jimp";
import { promisify } from "util";
import { exec as nodeExec } from "child_process";
const exec = promisify(nodeExec);

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
    console.log(
      `\x1b[32m${version}\nconnect with ${deviceCount} devices\x1b[0m`
    );
    return true;
  } catch (error) {
    console.log(`\x1b[31m${error}\x1b[0m`);
    return false;
  }
}

async function pullCurrentScreenShot() {
  await exec("adb shell screencap /sdcard/meow_candy.png");
  await exec("adb pull /sdcard/meow_candy.png ./images");
}

type TapTargetType = [number, number];

async function recognizeTapTarget(
  srcImgPath: string,
  targetImgPath: string
): Promise<TapTargetType | null> {
  const targetImage = await Jimp.read(targetImgPath);
  targetImage.greyscale();
  const tWidth = targetImage.bitmap.width;
  const tHeight = targetImage.bitmap.height;
  const rect = [
    targetImage.getPixelColor(0, 0),
    targetImage.getPixelColor(tWidth, 0),
    targetImage.getPixelColor(tWidth, tHeight),
    targetImage.getPixelColor(0, tHeight),
  ];

  const image = await Jimp.read(srcImgPath);
  image.greyscale();
  const sWidth = image.bitmap.width;
  const sHeight = image.bitmap.height;
  let matchedPoint: TapTargetType | null = null;
  for (const { x, y } of image.scanIterator(
    0,
    0,
    sWidth - tWidth,
    sHeight - tHeight
  )) {
    if (
      image.getPixelColor(x, y) === rect[0] &&
      image.getPixelColor(x + tWidth, y + tHeight) === rect[3] &&
      image.getPixelColor(x + tWidth, y) === rect[1] &&
      image.getPixelColor(x, y + tHeight) === rect[2] &&
      Jimp.diff(image.clone().crop(x, y, tWidth, tHeight), targetImage, 0.4)
        .percent < 0.15
    ) {
      matchedPoint = [x, y];
      break;
    }
  }

  return matchedPoint;
}

async function doTap([x, y]: TapTargetType) {
  await exec(`adb shell input tap ${x} ${y}`);
}

async function doBack() {
  await exec(`adb shell input keyevent 4`);
}

function wait(duration: number) {
  return new Promise((resolve) => {
    setTimeout(() => resolve("done"), duration);
  });
}

function actionInLayout(reference: string) {
  return new Promise(async (resolve, reject) => {
    await pullCurrentScreenShot();
    const target = await recognizeTapTarget(
      "./images/meow_candy.png",
      reference
    );
    console.log(target);
    if (!target) {
      reject();
    } else {
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
  } catch (error) {
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
    } catch (e) {
      console.log("Not Found Tap Target.");
    }
  }
})();
